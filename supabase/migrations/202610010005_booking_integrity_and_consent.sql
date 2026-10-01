alter table public.bookings
  add column if not exists accepted_terms_hash text,
  alter column accepted_terms_at drop default,
  alter column accepted_terms_at drop not null;

alter table public.bookings
  add constraint bookings_accepted_terms_hash_format
  check (accepted_terms_hash is null or accepted_terms_hash ~ '^[0-9a-f]{64}$');

create or replace function private.assert_required_booking_add_ons(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1
    from public.bookings b
    join public.unit_add_ons ua on ua.unit_id = b.unit_id
    join public.add_ons a on a.id = ua.add_on_id and a.active and a.required
    where b.id = p_booking_id
      and (
        exists (
          select 1 from public.package_add_ons pa
          where pa.package_id = b.package_id and pa.add_on_id = a.id
        ) or not exists (
          select 1 from public.package_add_ons any_pa where any_pa.add_on_id = a.id
        )
      )
      and not exists (
        select 1 from public.booking_items bi
        where bi.booking_id = b.id and bi.item_type = 'add_on' and bi.add_on_id = a.id
      )
  ) then
    raise exception 'A required service was not selected';
  end if;
end;
$$;

create or replace function private.guard_required_booking_add_ons()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'bookings' then
    perform private.assert_required_booking_add_ons(new.id);
  elsif tg_op = 'DELETE' then
    perform private.assert_required_booking_add_ons(old.booking_id);
  elsif tg_op = 'UPDATE' then
    perform private.assert_required_booking_add_ons(old.booking_id);
    perform private.assert_required_booking_add_ons(new.booking_id);
  else
    perform private.assert_required_booking_add_ons(new.booking_id);
  end if;
  return null;
end;
$$;

drop trigger if exists bookings_required_add_ons_guard on public.bookings;
create constraint trigger bookings_required_add_ons_guard
  after insert or update of unit_id, package_id on public.bookings
  deferrable initially deferred for each row
  execute function private.guard_required_booking_add_ons();

drop trigger if exists booking_items_required_add_ons_guard on public.booking_items;
create constraint trigger booking_items_required_add_ons_guard
  after insert or update or delete on public.booking_items
  deferrable initially deferred for each row
  execute function private.guard_required_booking_add_ons();

create or replace function public.create_booking(
  p_unit_id uuid,
  p_package_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_guest_count integer,
  p_add_on_ids uuid[] default '{}',
  p_coupon_code text default null,
  p_payment_method text default 'cash'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  customer uuid := (select auth.uid());
  unit_row public.units%rowtype;
  package_row public.packages%rowtype;
  profile_row public.profiles%rowtype;
  add_on_row record;
  coupon_row public.coupons%rowtype;
  unit_amount_value numeric(10,2);
  package_amount_value numeric(10,2);
  addons_amount_value numeric(10,2) := 0;
  discount_value numeric(10,2) := 0;
  sub_total numeric(10,2);
  final_total numeric(10,2);
  booking_id uuid;
  normalized_coupon text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  start_local time;
  expired_coupon_uses integer := 0;
  cash_payment_enabled boolean;
  bank_transfer_payment_enabled boolean;
  transfer_hold_hours integer;
  transfer_bank_name text;
  transfer_beneficiary text;
  transfer_iban text;
  online_payment_enabled boolean;
begin
  if customer is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.resort_settings where id and demo_mode) then
    raise exception 'This public preview is read-only';
  end if;
  if p_starts_at <= now() or p_ends_at <= p_starts_at then raise exception 'Invalid booking time'; end if;
  if p_guest_count < 1 then raise exception 'Guest count must be positive'; end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'bank_transfer', 'online') then raise exception 'Invalid payment method'; end if;
  select cash_enabled, bank_transfer_enabled, bank_transfer_hold_hours, bank_name, bank_beneficiary, bank_iban, online_payments_enabled
    into cash_payment_enabled, bank_transfer_payment_enabled, transfer_hold_hours, transfer_bank_name, transfer_beneficiary, transfer_iban, online_payment_enabled
    from public.resort_settings where id;
  if p_payment_method = 'cash' and not coalesce(cash_payment_enabled, false) then
    raise exception 'Cash payment is currently unavailable';
  end if;
  if p_payment_method = 'bank_transfer' and (not coalesce(bank_transfer_payment_enabled, false)
    or trim(coalesce(transfer_bank_name, '')) = '' or trim(coalesce(transfer_beneficiary, '')) = ''
    or trim(coalesce(transfer_iban, '')) = '') then
    raise exception 'Bank transfer is not configured';
  end if;
  if p_payment_method = 'online' and not coalesce(online_payment_enabled, false) then
    raise exception 'Online payment is not configured';
  end if;

  select * into unit_row from public.units where id = p_unit_id and published for update;
  if not found then raise exception 'Unit is not available'; end if;
  if p_guest_count > unit_row.max_guests then raise exception 'Guest count exceeds unit capacity'; end if;
  if array_position(coalesce(p_add_on_ids, '{}'), null) is not null then
    raise exception 'Selected services are invalid';
  end if;

  update public.bookings set status = 'expired', hold_expires_at = null
    where status = 'pending' and payment_status in ('unpaid', 'failed') and hold_expires_at <= now();

  select p.* into package_row from public.packages p
    join public.package_units pu on pu.package_id = p.id
    where p.id = p_package_id and pu.unit_id = p_unit_id and p.active;
  if not found then raise exception 'Package is not available for this unit'; end if;
  if extract(epoch from (p_ends_at - p_starts_at)) / 60 <> package_row.duration_minutes then
    raise exception 'Booking duration does not match the selected package';
  end if;
  start_local := (p_starts_at at time zone 'Asia/Riyadh')::time;
  if start_local < package_row.start_window_start or start_local > package_row.start_window_end then
    raise exception 'Selected time is outside the package booking window';
  end if;
  if exists (
    select 1 from public.availability_blocks a
    where a.unit_id = p_unit_id and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then raise exception 'Selected time is closed'; end if;

  select * into profile_row from public.profiles where id = customer;
  if not found or trim(profile_row.full_name) = '' or trim(profile_row.phone) = '' then
    raise exception 'Complete your name and phone number before booking';
  end if;

  unit_amount_value := unit_row.base_price;
  package_amount_value := package_row.price;
  if exists (
    select 1 from public.add_ons a
    join public.unit_add_ons ua on ua.add_on_id = a.id and ua.unit_id = p_unit_id
    left join public.package_add_ons pa on pa.add_on_id = a.id and pa.package_id = p_package_id
    where a.active and a.required and (pa.add_on_id is not null or not exists (
      select 1 from public.package_add_ons any_pa where any_pa.add_on_id = a.id
    )) and not coalesce(a.id = any(coalesce(p_add_on_ids, '{}')), false)
  ) then raise exception 'A required service was not selected'; end if;

  if cardinality(coalesce(p_add_on_ids, '{}')) > 0 then
    for add_on_row in
      select distinct a.* from public.add_ons a
      where a.id = any(p_add_on_ids) and a.active
        and exists (select 1 from public.unit_add_ons ua where ua.unit_id = p_unit_id and ua.add_on_id = a.id)
        and (
          exists (select 1 from public.package_add_ons pa where pa.package_id = p_package_id and pa.add_on_id = a.id)
          or not exists (select 1 from public.package_add_ons pa where pa.add_on_id = a.id)
        )
    loop
      addons_amount_value := addons_amount_value + add_on_row.price;
    end loop;
    if (select count(distinct x) from unnest(p_add_on_ids) x) <> (
      select count(*) from public.add_ons a where a.id = any(p_add_on_ids) and a.active
        and exists (select 1 from public.unit_add_ons ua where ua.unit_id = p_unit_id and ua.add_on_id = a.id)
        and (exists (select 1 from public.package_add_ons pa where pa.package_id = p_package_id and pa.add_on_id = a.id)
          or not exists (select 1 from public.package_add_ons pa where pa.add_on_id = a.id))
    ) then raise exception 'One or more selected services are unavailable'; end if;
  end if;

  sub_total := unit_amount_value + package_amount_value + addons_amount_value;
  if normalized_coupon is not null then
    select * into coupon_row from public.coupons c
      where c.code = normalized_coupon and c.active for update;
    if not found then raise exception 'Coupon is invalid or unavailable'; end if;
    select count(*) into expired_coupon_uses from public.bookings b
      where b.coupon_id = coupon_row.id and b.status = 'pending'
        and b.payment_status in ('unpaid', 'failed') and b.hold_expires_at <= now();
    if (coupon_row.starts_at is not null and coupon_row.starts_at > now())
      or (coupon_row.ends_at is not null and coupon_row.ends_at <= now())
      or (coupon_row.max_uses is not null and coupon_row.used_count - expired_coupon_uses >= coupon_row.max_uses)
      or sub_total < coupon_row.minimum_amount
      or (coupon_row.unit_id is not null and coupon_row.unit_id <> p_unit_id)
      or (coupon_row.package_id is not null and coupon_row.package_id <> p_package_id)
    then raise exception 'Coupon is invalid or unavailable'; end if;
    discount_value := case when coupon_row.discount_type = 'percent'
      then round(sub_total * coupon_row.discount_value / 100, 2)
      else least(coupon_row.discount_value, sub_total) end;
  end if;
  final_total := sub_total - discount_value;
  if p_payment_method = 'online' and final_total <= 0 then
    raise exception 'Online payment is not available for a free booking';
  end if;

  insert into public.bookings (
    customer_id, unit_id, package_id, starts_at, ends_at, guest_count,
    guest_name, guest_phone, unit_name_snapshot, package_name_snapshot,
    unit_amount, package_amount, addons_amount, discount_amount, total_amount,
    coupon_id, status, payment_method, payment_status, hold_expires_at
  ) values (
    customer, p_unit_id, p_package_id, p_starts_at, p_ends_at, p_guest_count,
    profile_row.full_name, profile_row.phone, unit_row.name, package_row.name,
    unit_amount_value, package_amount_value, addons_amount_value, discount_value, final_total,
    case when normalized_coupon is null then null else coupon_row.id end,
    'pending', p_payment_method, case when p_payment_method = 'online' then 'processing' else 'unpaid' end,
    case when p_payment_method = 'bank_transfer'
      then now() + make_interval(hours => coalesce(transfer_hold_hours, 24))
      else now() + interval '15 minutes' end
  ) returning id into booking_id;

  insert into public.booking_items (booking_id, item_type, item_name, unit_price, total_price)
  values (booking_id, 'unit', unit_row.name, unit_amount_value, unit_amount_value),
         (booking_id, 'package', package_row.name, package_amount_value, package_amount_value);

  insert into public.booking_items (booking_id, item_type, item_name, unit_price, total_price, add_on_id)
  select booking_id, 'add_on', a.name, a.price, a.price, a.id
  from public.add_ons a where a.id = any(coalesce(p_add_on_ids, '{}'))
    and exists (select 1 from public.unit_add_ons ua where ua.unit_id = p_unit_id and ua.add_on_id = a.id);

  return booking_id;
end;
$$;

create or replace function public.create_booking_with_terms(
  p_unit_id uuid,
  p_package_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_guest_count integer,
  p_terms_accepted boolean,
  p_terms_text text,
  p_add_on_ids uuid[] default '{}',
  p_coupon_code text default null,
  p_payment_method text default 'cash'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_terms text;
  new_booking_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_terms_accepted is distinct from true then raise exception 'Terms acceptance is required'; end if;

  select case
    when nullif(trim(s.terms), '') is null or nullif(trim(s.cancellation_policy), '') is null then null
    else s.terms || E'\n\n' || s.cancellation_policy
  end into current_terms
  from public.resort_settings s where s.id for share;
  if current_terms is null or trim(current_terms) = '' then
    raise exception 'Booking terms and cancellation policy are not configured';
  end if;
  if p_terms_text is distinct from current_terms then
    raise exception 'Terms have changed; review and accept the current terms';
  end if;

  new_booking_id := public.create_booking(
    p_unit_id, p_package_id, p_starts_at, p_ends_at, p_guest_count,
    p_add_on_ids, p_coupon_code, p_payment_method
  );
  update public.bookings
    set accepted_terms_at = now(),
        accepted_terms_hash = encode(extensions.digest(convert_to(current_terms, 'UTF8'), 'sha256'), 'hex')
    where id = new_booking_id and customer_id = (select auth.uid());
  if not found then raise exception 'Unable to record terms acceptance'; end if;
  if p_payment_method = 'cash' then
    perform public.confirm_booking_cash(new_booking_id);
  end if;
  return new_booking_id;
end;
$$;

revoke all on function public.create_booking(uuid, uuid, timestamptz, timestamptz, integer, uuid[], text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_booking_with_terms(uuid, uuid, timestamptz, timestamptz, integer, boolean, text, uuid[], text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_booking_with_terms(uuid, uuid, timestamptz, timestamptz, integer, boolean, text, uuid[], text, text)
  to authenticated;

create or replace function public.confirm_booking_cash(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  booking_row public.bookings%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or (booking_row.customer_id <> (select auth.uid()) and not (select public.is_owner())) then
    raise exception 'Booking not found';
  end if;
  if booking_row.status <> 'pending' or booking_row.payment_method <> 'cash' then
    raise exception 'Booking cannot be confirmed with this payment method';
  end if;
  if booking_row.accepted_terms_hash is null then
    raise exception 'Current terms acceptance must be recorded before confirmation';
  end if;
  if booking_row.hold_expires_at is null or booking_row.hold_expires_at <= now() then
    raise exception 'Booking hold expired';
  end if;
  if not exists (select 1 from public.resort_settings where id and cash_enabled) then
    raise exception 'Cash payment is currently unavailable';
  end if;
  update public.bookings set status = 'confirmed', hold_expires_at = null where id = p_booking_id;
end;
$$;

revoke all on function public.confirm_booking_cash(uuid) from public, anon;
grant execute on function public.confirm_booking_cash(uuid) to authenticated;

create or replace function private.guard_pending_booking_hold()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.status = 'pending' and old.payment_status = 'processing' then
    if new.status = 'expired' then return null; end if;
    if new.status = 'cancelled' then
      raise exception 'Payment result is unresolved; do not release this booking hold';
    end if;
  end if;
  if new.status = 'pending' and (new.hold_expires_at is null or new.hold_expires_at <= now()) then
    raise exception 'A pending booking requires a future hold expiry';
  end if;
  return new;
end;
$$;

drop trigger if exists pending_booking_hold_guard on public.bookings;
create trigger pending_booking_hold_guard
  before insert or update of status, hold_expires_at on public.bookings
  for each row execute function private.guard_pending_booking_hold();

create or replace function private.guard_booking_status_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'pending' and new.status in ('confirmed', 'cancelled', 'expired'))
    or (old.status = 'confirmed' and new.status in ('checked_in', 'completed', 'cancelled'))
    or (old.status = 'checked_in' and new.status = 'completed')
  ) then
    raise exception 'Invalid booking status transition';
  end if;
  if old.status = 'pending' and new.status in ('expired', 'cancelled')
     and old.payment_status = 'processing' then
    if new.status = 'expired' then return null; end if;
    raise exception 'Payment result is unresolved; do not release this booking hold';
  end if;
  if old.payment_status = 'refunded' and new.status in ('confirmed', 'checked_in', 'completed') then
    raise exception 'A refunded booking cannot be reactivated';
  end if;
  if new.status = 'expired' and old.hold_expires_at is not null and old.hold_expires_at > now() then
    raise exception 'An active booking hold cannot expire early';
  end if;
  if new.status = 'cancelled' and new.payment_status = 'paid' then
    raise exception 'Refund the payment before cancelling this booking';
  end if;
  if new.status = 'confirmed' then
    if old.status = 'pending' and (old.hold_expires_at is null or old.hold_expires_at <= now()) then
      raise exception 'Booking hold expired';
    end if;
    if new.accepted_terms_hash is null then
      raise exception 'Current terms acceptance must be recorded before confirmation';
    end if;
  end if;
  if new.status = 'confirmed' and new.payment_method = 'cash' then
    if not exists (select 1 from public.resort_settings s where s.id and s.cash_enabled) then
      raise exception 'Cash payment is currently unavailable';
    end if;
  end if;
  if new.status = 'checked_in' and (new.starts_at > now() or new.ends_at <= now()) then
    raise exception 'A booking can only be checked in during its scheduled time';
  end if;
  if new.status = 'completed' and new.ends_at > now() then
    raise exception 'A future booking cannot be completed';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_status_transition_guard on public.bookings;
create trigger booking_status_transition_guard
  before update of status on public.bookings
  for each row execute function private.guard_booking_status_transition();

create or replace function public.owner_set_booking_status(p_booking_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  booking_row public.bookings%rowtype;
begin
  if (select auth.uid()) is null or not (select public.is_owner()) then
    raise exception 'Owner access required';
  end if;
  if p_status is null or p_status not in ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired') then
    raise exception 'Invalid booking status';
  end if;

  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if p_status = booking_row.status then return; end if;
  if not (
    (booking_row.status = 'pending' and p_status in ('confirmed', 'cancelled', 'expired'))
    or (booking_row.status = 'confirmed' and p_status in ('checked_in', 'completed', 'cancelled'))
    or (booking_row.status = 'checked_in' and p_status = 'completed')
  ) then
    raise exception 'Invalid booking status transition';
  end if;
  if p_status = 'expired' and booking_row.status <> 'pending' then
    raise exception 'Only pending bookings can expire';
  end if;
  if p_status = 'expired' and booking_row.hold_expires_at is not null and booking_row.hold_expires_at > now() then
    raise exception 'An active booking hold cannot expire early';
  end if;
  if p_status in ('expired', 'cancelled') and booking_row.payment_status = 'processing' then
    raise exception 'Payment result is unresolved; do not release this booking hold';
  end if;
  if p_status = 'expired' and booking_row.payment_status = 'paid' then
    raise exception 'A paid booking cannot expire';
  end if;
  if p_status = 'confirmed' and booking_row.status = 'pending'
     and (booking_row.hold_expires_at is null or booking_row.hold_expires_at <= now()) then
    raise exception 'Booking hold expired';
  end if;
  if p_status in ('confirmed', 'checked_in', 'completed')
     and booking_row.payment_status = 'refunded' then
    raise exception 'A refunded booking cannot be reactivated';
  end if;
  if p_status = 'cancelled' and booking_row.payment_status = 'paid' then
    raise exception 'Refund the payment before cancelling this booking';
  end if;

  if p_status = 'confirmed' and booking_row.payment_method = 'cash'
     and not exists (select 1 from public.resort_settings s where s.id and s.cash_enabled) then
    raise exception 'Cash payment is currently unavailable';
  end if;
  if p_status = 'checked_in' and (booking_row.starts_at > now() or booking_row.ends_at <= now()) then
    raise exception 'A booking can only be checked in during its scheduled time';
  end if;
  if p_status = 'completed' and booking_row.ends_at > now() then
    raise exception 'A future booking cannot be completed';
  end if;

  update public.bookings
    set status = p_status, hold_expires_at = null
    where id = booking_row.id;
end;
$$;

revoke update (status, hold_expires_at) on table public.bookings from authenticated;
revoke all on function public.owner_set_booking_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.owner_set_booking_status(uuid, text) to authenticated;

create or replace function private.guard_demo_guest_mutations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.resort_settings where id and demo_mode)
     and not (select public.is_owner()) then
    raise exception 'The public preview does not accept guest data changes';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists demo_guest_profile_update_guard on public.profiles;
create trigger demo_guest_profile_update_guard
  before update of full_name on public.profiles
  for each row execute function private.guard_demo_guest_mutations();

drop trigger if exists demo_guest_favorites_guard on public.favorites;
create trigger demo_guest_favorites_guard
  before insert or update or delete on public.favorites
  for each row execute function private.guard_demo_guest_mutations();

drop trigger if exists demo_guest_reviews_guard on public.reviews;
create trigger demo_guest_reviews_guard
  before insert or update or delete on public.reviews
  for each row execute function private.guard_demo_guest_mutations();

drop trigger if exists demo_guest_notifications_guard on public.notifications;
create trigger demo_guest_notifications_guard
  before update of read_at on public.notifications
  for each row execute function private.guard_demo_guest_mutations();

create or replace function private.guard_demo_booking_mutations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.resort_settings where id and demo_mode) then
    raise exception 'The public preview does not accept booking changes';
  end if;
  return new;
end;
$$;

drop trigger if exists demo_booking_update_guard on public.bookings;
create trigger demo_booking_update_guard
  before update of status, hold_expires_at, payment_status on public.bookings
  for each row execute function private.guard_demo_booking_mutations();

create or replace function public.guard_availability_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.units where id = new.unit_id for update;
  if exists (
    select 1 from public.bookings b
    where b.unit_id = new.unit_id
      and (b.status in ('confirmed', 'checked_in') or (b.status = 'pending'
        and (b.hold_expires_at > now() or b.payment_status = 'processing')))
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      and (tg_op = 'INSERT' or b.id <> old.id)
  ) then raise exception 'Availability block overlaps an active booking'; end if;
  return new;
end;
$$;

create or replace function public.get_unit_availability(p_unit_id uuid, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + 89 then
    raise exception 'Date window must contain between 1 and 90 calendar days';
  end if;
  if not exists (select 1 from public.units u where u.id = p_unit_id and u.published)
     and not (select public.is_owner()) then
    raise exception 'Unit not found';
  end if;

  return query
    select b.starts_at, b.ends_at, 'booked'::text
    from public.bookings b
    where b.unit_id = p_unit_id
      and (b.status in ('confirmed', 'checked_in') or (b.status = 'pending'
        and (b.hold_expires_at > now() or b.payment_status = 'processing')))
      and b.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Riyadh')
      and b.ends_at > (p_from::timestamp at time zone 'Asia/Riyadh')
    union all
    select a.starts_at, a.ends_at, 'closed'::text
    from public.availability_blocks a
    where a.unit_id = p_unit_id
      and a.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Riyadh')
      and a.ends_at > (p_from::timestamp at time zone 'Asia/Riyadh');
end;
$$;

grant execute on function public.get_unit_availability(uuid, date, date) to anon, authenticated;

create or replace function private.guard_demo_mode_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.demo_mode and not new.demo_mode then
    if exists (
      select 1 from public.units
      where id in (
        '11111111-1111-4111-8111-111111111101'::uuid,
        '11111111-1111-4111-8111-111111111102'::uuid
      ) or name ilike '%نموذج%' or short_description ilike '%تجريبي%' or description ilike '%تجريبي%'
    ) or exists (
      select 1 from public.packages
      where id in (
        '22222222-2222-4222-8222-222222222201'::uuid,
        '22222222-2222-4222-8222-222222222202'::uuid
      ) or name ilike '%نموذج%' or description ilike '%تجريبي%' or description ilike '%افتراضي%'
    ) or exists (
      select 1 from public.add_ons where id = '33333333-3333-4333-8333-333333333301'::uuid
        or name ilike '%نموذج%' or name ilike '%تجريبي%'
    ) or exists (
      select 1 from public.coupons where code = 'PREVIEW10'
    ) or exists (
      select 1 from public.faq_entries
      where question ilike '%نموذج%' or answer ilike '%بيانات تجريبية%' or answer ilike '%للمعاينة فقط%'
    ) then
      raise exception 'Remove preview seed records before disabling demo mode';
    end if;

    if not exists (select 1 from public.units where published)
       or not exists (
         select 1 from public.packages p
         join public.package_units pu on pu.package_id = p.id
         join public.units u on u.id = pu.unit_id
         where p.active and u.published
       ) then
      raise exception 'Publish at least one real unit and an active package before disabling demo mode';
    end if;

    if nullif(trim(new.name), '') is null or nullif(trim(new.tagline), '') is null
       or nullif(trim(new.about), '') is null or nullif(trim(new.arrival_instructions), '') is null
       or nullif(trim(new.late_policy), '') is null
       or (nullif(trim(new.phone), '') is null and nullif(trim(new.whatsapp), '') is null and nullif(trim(new.email), '') is null)
       or nullif(trim(new.address), '') is null or nullif(trim(new.terms), '') is null
       or nullif(trim(new.privacy_policy), '') is null or nullif(trim(new.cancellation_policy), '') is null
       or nullif(trim(new.refund_policy), '') is null then
      raise exception 'Complete resort identity, contact, address and approved guest policies before disabling demo mode';
    end if;

    if new.tagline ilike '%نموذج عرض%' or new.about ilike '%بيانات تجريبية%'
       or new.address ilike '%موقع تجريبي%' or new.cancellation_policy ilike '%تجريب%'
       or new.refund_policy ilike '%تجريب%' or new.terms ilike '%تجريب%'
       or new.privacy_policy ilike '%تجريب%' or new.late_policy ilike '%تجريب%'
       or new.arrival_instructions ilike '%غير مضافة بعد%' then
      raise exception 'Replace preview placeholder text before disabling demo mode';
    end if;

    if not new.cash_enabled and not new.bank_transfer_enabled then
      raise exception 'Enable at least one approved payment method before disabling demo mode';
    end if;
    if new.bank_transfer_enabled and (nullif(trim(new.bank_name), '') is null
      or nullif(trim(new.bank_beneficiary), '') is null or nullif(trim(new.bank_iban), '') is null) then
      raise exception 'Complete bank transfer details before enabling that payment method';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.consume_password_recovery(p_phone text, p_pin text, p_ip_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  account_id uuid;
  pin_matches boolean := false;
  phone_attempts integer;
  ip_attempts integer;
begin
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' or coalesce(p_ip_hash, '') !~ '^[a-f0-9]{64}$'
     or normalized_phone = '' then
    return null;
  end if;
  select p.id into account_id from public.profiles p where p.phone = normalized_phone limit 1;

  insert into private.recovery_attempts (subject, attempts) values ('phone:' || normalized_phone, 1)
  on conflict (subject) do update set
    attempts = case when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.attempts + 1
      when private.recovery_attempts.blocked_until is not null then 1 else private.recovery_attempts.attempts + 1 end,
    blocked_until = case when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.blocked_until
      when private.recovery_attempts.blocked_until is not null then null
      when private.recovery_attempts.attempts + 1 >= 6 then now() + interval '15 minutes' else null end,
    updated_at = now()
  returning attempts into phone_attempts;

  insert into private.recovery_attempts (subject, attempts) values ('ip:' || p_ip_hash, 1)
  on conflict (subject) do update set
    attempts = case when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.attempts + 1
      when private.recovery_attempts.blocked_until is not null then 1 else private.recovery_attempts.attempts + 1 end,
    blocked_until = case when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.blocked_until
      when private.recovery_attempts.blocked_until is not null then null
      when private.recovery_attempts.attempts + 1 >= 13 then now() + interval '30 minutes' else null end,
    updated_at = now()
  returning attempts into ip_attempts;

  if phone_attempts > 5 or ip_attempts > 12 or account_id is null then return null; end if;
  select extensions.crypt(p_pin, r.pin_hash) = r.pin_hash into pin_matches
    from private.account_recovery r where r.user_id = account_id;
  if coalesce(pin_matches, false) then
    delete from private.recovery_attempts where subject in ('phone:' || normalized_phone, 'ip:' || p_ip_hash);
    return account_id;
  end if;
  return null;
end;
$$;

revoke all on function private.assert_required_booking_add_ons(uuid) from public, anon, authenticated;
revoke all on function private.guard_required_booking_add_ons() from public, anon, authenticated;
revoke all on function private.guard_pending_booking_hold() from public, anon, authenticated;
revoke all on function private.guard_booking_status_transition() from public, anon, authenticated;
revoke all on function private.guard_demo_guest_mutations() from public, anon, authenticated;
revoke all on function private.guard_demo_booking_mutations() from public, anon, authenticated;
revoke all on function private.guard_demo_mode_transition() from public, anon, authenticated;
revoke all on function public.guard_availability_block() from public, anon, authenticated;
revoke all on function public.consume_password_recovery(text, text, text) from public, anon, authenticated;
grant execute on function public.consume_password_recovery(text, text, text) to service_role;
revoke all on function public.create_booking_with_terms(uuid, uuid, timestamptz, timestamptz, integer, boolean, text, uuid[], text, text)
  from public, anon;
revoke all on function public.owner_set_booking_status(uuid, text) from public, anon;

notify pgrst, 'reload schema';
