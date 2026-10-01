alter table public.resort_settings
  add column if not exists demo_mode boolean not null default false;

update public.resort_settings set online_payments_enabled = false where online_payments_enabled;
alter table public.resort_settings
  add constraint resort_settings_online_payments_disabled check (online_payments_enabled = false);

create index if not exists bookings_pending_hold_expiry_idx
  on public.bookings (hold_expires_at) where status = 'pending';

create or replace function private.sync_coupon_booking_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  previous_coupon uuid;
  next_coupon uuid;
  previous_counted boolean := false;
  next_counted boolean := false;
begin
  if tg_op <> 'INSERT' then
    previous_coupon := old.coupon_id;
    previous_counted := old.status in ('pending', 'confirmed', 'checked_in', 'completed');
  end if;
  if tg_op <> 'DELETE' then
    next_coupon := new.coupon_id;
    next_counted := new.status in ('pending', 'confirmed', 'checked_in', 'completed');
  end if;

  if previous_coupon is not null and (previous_coupon is distinct from next_coupon or not next_counted) and previous_counted then
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = previous_coupon;
  end if;
  if next_coupon is not null and (previous_coupon is distinct from next_coupon or not previous_counted) and next_counted then
    update public.coupons set used_count = used_count + 1 where id = next_coupon;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists booking_coupon_count on public.bookings;
create trigger booking_coupon_count after insert or update of coupon_id, status on public.bookings
  for each row execute function private.sync_coupon_booking_count();

create or replace function private.guard_booking_financial_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status = 'paid' and not exists (
    select 1 from public.payments p
    where p.booking_id = new.id and p.customer_id = new.customer_id
      and p.status = 'paid' and p.currency = 'SAR' and p.amount = new.total_amount
  ) then
    raise exception 'A matching recorded payment is required before marking this booking paid';
  end if;

  if new.payment_status = 'refunded' and not exists (
    select 1 from public.payments p
    where p.booking_id = new.id and p.customer_id = new.customer_id
      and p.status = 'refunded' and p.currency = 'SAR' and p.amount = new.total_amount
  ) then
    raise exception 'A matching recorded refund is required before marking this booking refunded';
  end if;

  if old.payment_status = 'paid' and new.payment_status not in ('paid', 'refunded') then
    raise exception 'A paid booking can only move to refunded after a refund is recorded';
  end if;
  if old.payment_status = 'refunded' and new.payment_status <> 'refunded' then
    raise exception 'A recorded refund cannot be reversed';
  end if;
  if new.payment_method = 'cash' and new.payment_status = 'processing' then
    raise exception 'Cash bookings cannot have a processing online payment';
  end if;
  if new.payment_method = 'online' and new.status in ('confirmed', 'checked_in', 'completed')
     and new.payment_status <> 'paid' then
    raise exception 'An online booking requires a recorded payment before confirmation';
  end if;
  if new.payment_method = 'bank_transfer' and new.status in ('confirmed', 'checked_in', 'completed')
     and new.payment_status <> 'paid' then
    raise exception 'A bank transfer must be recorded before confirmation';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_financial_state_guard on public.bookings;
create trigger booking_financial_state_guard before update of status, payment_status, total_amount, customer_id, payment_method
  on public.bookings for each row execute function private.guard_booking_financial_state();

create or replace function private.guard_demo_writes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.resort_settings where id and demo_mode) then
    raise exception 'This public preview is read-only';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists demo_booking_read_only on public.bookings;
create trigger demo_booking_read_only before insert on public.bookings
  for each row execute function private.guard_demo_writes();

drop trigger if exists demo_inquiry_read_only on public.inquiries;
create trigger demo_inquiry_read_only before insert on public.inquiries
  for each row execute function private.guard_demo_writes();

revoke update on public.bookings from authenticated;
grant update (status, hold_expires_at, payment_status, admin_note) on public.bookings to authenticated;
revoke insert, update, delete on public.payments from authenticated;

create or replace function public.record_manual_payment(p_booking_id uuid, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype;
begin
  if (select auth.uid()) is null or not (select public.is_owner()) then raise exception 'Owner access required'; end if;
  if char_length(coalesce(p_note, '')) > 500 then raise exception 'Payment note is too long'; end if;
  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or booking_row.payment_status not in ('unpaid', 'failed')
     or not (
       (booking_row.payment_method = 'cash' and booking_row.status in ('confirmed', 'checked_in', 'completed'))
       or (booking_row.payment_method = 'bank_transfer' and booking_row.status = 'pending'
         and booking_row.hold_expires_at > now())
     ) then
    raise exception 'This booking is not eligible for a manual payment record';
  end if;

  insert into public.payments (
    booking_id, customer_id, provider, provider_reference, amount, currency, status, provider_data
  ) values (
    booking_row.id, booking_row.customer_id, 'manual', 'manual:' || extensions.gen_random_uuid()::text,
    booking_row.total_amount, 'SAR', 'paid',
    jsonb_build_object('payment_method', booking_row.payment_method, 'recorded_by', (select auth.uid()),
      'note', left(trim(coalesce(p_note, '')), 500), 'recorded_at', now())
  );
  update public.bookings set payment_status = 'paid',
    status = case when booking_row.payment_method = 'bank_transfer' then 'confirmed' else status end,
    hold_expires_at = case when booking_row.payment_method = 'bank_transfer' then null else hold_expires_at end
    where id = booking_row.id;
end;
$$;

create or replace function public.record_manual_refund(p_booking_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  booking_row public.bookings%rowtype;
  payment_row_id uuid;
begin
  if (select auth.uid()) is null or not (select public.is_owner()) then raise exception 'Owner access required'; end if;
  if trim(coalesce(p_note, '')) = '' or char_length(p_note) > 500 then raise exception 'A short refund note is required'; end if;
  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or booking_row.payment_method not in ('cash', 'bank_transfer')
     or booking_row.status <> 'confirmed' or booking_row.starts_at <= now()
     or booking_row.payment_status <> 'paid' then
    raise exception 'This booking is not eligible for a manual refund record';
  end if;

  update public.payments set status = 'refunded', provider_data = provider_data || jsonb_build_object(
    'refund_recorded_by', (select auth.uid()), 'refund_note', trim(p_note), 'refunded_at', now()
  )
  where booking_id = booking_row.id and provider = 'manual' and status = 'paid'
  returning id into payment_row_id;
  if payment_row_id is null then raise exception 'No matching manual payment record exists'; end if;

  update public.bookings set payment_status = 'refunded' where id = booking_row.id;
end;
$$;

revoke all on function public.record_manual_payment(uuid, text) from public, anon;
revoke all on function public.record_manual_refund(uuid, text) from public, anon;
grant execute on function public.record_manual_payment(uuid, text) to authenticated;
grant execute on function public.record_manual_refund(uuid, text) to authenticated;

notify pgrst, 'reload schema';
