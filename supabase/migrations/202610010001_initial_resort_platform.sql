create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null unique,
  role text not null default 'customer' check (role in ('customer', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resort_settings (
  id boolean primary key default true check (id),
  name text not null default '',
  tagline text not null default '',
  about text not null default '',
  logo_path text,
  hero_path text,
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  address text not null default '',
  latitude double precision,
  longitude double precision,
  instagram_url text not null default '',
  map_url text not null default '',
  timezone text not null default 'Asia/Riyadh',
  currency text not null default 'SAR' check (currency = 'SAR'),
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 720),
  cancellation_policy text not null default '',
  refund_policy text not null default '',
  late_policy text not null default '',
  terms text not null default '',
  privacy_policy text not null default '',
  arrival_instructions text not null default '',
  cash_enabled boolean not null default true,
  bank_transfer_enabled boolean not null default false,
  bank_name text not null default '',
  bank_beneficiary text not null default '',
  bank_iban text not null default '',
  bank_transfer_hold_hours integer not null default 24 check (bank_transfer_hold_hours between 1 and 168),
  online_payments_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.resort_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null default '',
  description text not null default '',
  max_guests integer not null check (max_guests > 0),
  area_sqm numeric(8,2) check (area_sqm is null or area_sqm > 0),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  has_pool boolean not null default false,
  base_price numeric(10,2) not null default 0 check (base_price >= 0),
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.amenities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'sparkles',
  sort_order integer not null default 0
);

create table if not exists public.unit_amenities (
  unit_id uuid not null references public.units(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  primary key (unit_id, amenity_id)
);

create table if not exists public.unit_media (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique (unit_id, storage_path)
);

create unique index if not exists unit_one_cover_idx
  on public.unit_media (unit_id) where is_cover;

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes between 30 and 1440),
  start_window_start time not null default '10:00',
  start_window_end time not null default '20:00',
  price numeric(10,2) not null check (price >= 0),
  image_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_window_start < start_window_end)
);

create table if not exists public.package_units (
  package_id uuid not null references public.packages(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  primary key (package_id, unit_id)
);

create table if not exists public.package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  feature text not null,
  sort_order integer not null default 0
);

create table if not exists public.add_ons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_path text,
  active boolean not null default true,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.unit_add_ons (
  unit_id uuid not null references public.units(id) on delete cascade,
  add_on_id uuid not null references public.add_ons(id) on delete cascade,
  primary key (unit_id, add_on_id)
);

create table if not exists public.package_add_ons (
  package_id uuid not null references public.packages(id) on delete cascade,
  add_on_id uuid not null references public.add_ons(id) on delete cascade,
  primary key (package_id, add_on_id)
);

create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  minimum_amount numeric(10,2) not null default 0 check (minimum_amount >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  unit_id uuid references public.units(id) on delete cascade,
  package_id uuid references public.packages(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number bigint generated always as identity unique,
  customer_id uuid not null references auth.users(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  package_id uuid not null references public.packages(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guest_count integer not null check (guest_count > 0),
  guest_name text not null,
  guest_phone text not null,
  unit_name_snapshot text not null,
  package_name_snapshot text not null,
  unit_amount numeric(10,2) not null check (unit_amount >= 0),
  package_amount numeric(10,2) not null check (package_amount >= 0),
  addons_amount numeric(10,2) not null default 0 check (addons_amount >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank_transfer', 'online')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'processing', 'paid', 'failed', 'refunded')),
  hold_expires_at timestamptz,
  accepted_terms_at timestamptz not null default now(),
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (total_amount = unit_amount + package_amount + addons_amount - discount_amount),
  check (status <> 'cancelled' or payment_status <> 'paid')
);

alter table public.bookings drop constraint if exists bookings_no_overlapping_active;
alter table public.bookings add constraint bookings_no_overlapping_active
  exclude using gist (
    unit_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'checked_in'));

create table if not exists public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  item_type text not null check (item_type in ('unit', 'package', 'add_on')),
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  add_on_id uuid references public.add_ons(id) on delete set null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  provider text not null check (provider in ('moyasar', 'manual')),
  provider_reference text,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'SAR' check (currency = 'SAR'),
  status text not null default 'initiated' check (status in ('initiated', 'pending', 'paid', 'failed', 'refunded')),
  checkout_url text,
  provider_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table if not exists public.favorites (
  customer_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, unit_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  message text not null check (char_length(message) between 5 and 3000),
  unit_id uuid references public.units(id) on delete set null,
  package_id uuid references public.packages(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null check (kind in ('booking', 'reminder', 'offer', 'system')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.account_recovery (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.recovery_attempts (
  subject text primary key,
  attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists bookings_customer_created_idx on public.bookings (customer_id, created_at desc);
create index if not exists bookings_unit_start_idx on public.bookings (unit_id, starts_at);
create index if not exists bookings_status_start_idx on public.bookings (status, starts_at);
create index if not exists availability_blocks_unit_time_idx on public.availability_blocks using gist (unit_id, tstzrange(starts_at, ends_at, '[)'));
create index if not exists favorites_unit_idx on public.favorites (unit_id);
create index if not exists reviews_unit_status_created_idx on public.reviews (unit_id, status, created_at desc);
create index if not exists inquiries_status_created_idx on public.inquiries (status, created_at desc);
create index if not exists notifications_customer_created_idx on public.notifications (customer_id, created_at desc);
create index if not exists payments_booking_created_idx on public.payments (booking_id, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare row_id text;
begin
  row_id := case when tg_op = 'DELETE' then to_jsonb(old) ->> 'id' else to_jsonb(new) ->> 'id' end;
  insert into public.audit_logs (actor_id, action, table_name, record_id)
  values ((select auth.uid()), lower(tg_op), tg_table_name, coalesce(row_id, 'singleton'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['resort_settings', 'units', 'packages', 'add_ons', 'bookings', 'payments', 'availability_blocks', 'coupons', 'reviews', 'inquiries', 'faq_entries'] loop
    execute format('drop trigger if exists audit_changes on public.%I', table_name);
    execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function public.write_audit_log()', table_name);
  end loop;
end;
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'owner'
  );
$$;

create or replace function public.claim_first_owner(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('resort-first-owner'));
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'Owner setup has already been completed';
  end if;
  update public.profiles set role = 'owner' where id = p_user_id;
  if not found then raise exception 'Account profile not found'; end if;
end;
$$;
revoke all on function public.claim_first_owner(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'resort_settings', 'units', 'packages', 'add_ons', 'bookings',
    'payments', 'reviews', 'inquiries', 'faq_entries'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

create or replace function public.notify_booking_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (customer_id, booking_id, title, body, kind)
    values (new.customer_id, new.id, 'استلمنا طلب حجزك', 'سيراجع المنتجع تفاصيل الحجز ويحدّث حالته هنا.', 'booking');
  elsif new.status is distinct from old.status then
    insert into public.notifications (customer_id, booking_id, title, body, kind)
    values (
      new.customer_id,
      new.id,
      case new.status
        when 'confirmed' then 'تم تأكيد حجزك'
        when 'cancelled' then 'تم إلغاء الحجز'
        when 'completed' then 'نأمل أن تكون استمتعت بوقتك'
        else 'تحديث على حجزك'
      end,
      'رقم الحجز ' || new.booking_number::text || ' · ' || new.unit_name_snapshot,
      'booking'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists booking_notification on public.bookings;
create trigger booking_notification after insert or update of status on public.bookings
  for each row execute function public.notify_booking_change();

create or replace function public.guard_availability_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.units where id = new.unit_id for update;
  if exists (
    select 1 from public.bookings b
    where b.unit_id = new.unit_id
      and (b.status in ('confirmed', 'checked_in') or (b.status = 'pending' and b.hold_expires_at > now()))
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      and (tg_op = 'INSERT' or b.id <> old.id)
  ) then raise exception 'Availability block overlaps an active booking'; end if;
  return new;
end;
$$;

drop trigger if exists availability_block_guard on public.availability_blocks;
create trigger availability_block_guard before insert or update on public.availability_blocks
  for each row execute function public.guard_availability_block();

create or replace function public.set_recovery_pin(p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must contain four digits'; end if;
  insert into private.account_recovery (user_id, pin_hash)
  values (current_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 12)))
  on conflict (user_id) do update set
    pin_hash = excluded.pin_hash,
    updated_at = now();
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
  if p_pin !~ '^[0-9]{4}$' or p_ip_hash !~ '^[a-f0-9]{64}$' or normalized_phone = '' then
    return null;
  end if;

  select p.id into account_id from public.profiles p where p.phone = normalized_phone limit 1;

  insert into private.recovery_attempts (subject, attempts)
  values ('phone:' || normalized_phone, 1)
  on conflict (subject) do update set
    attempts = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.attempts + 1
      when private.recovery_attempts.blocked_until is not null then 1
      else private.recovery_attempts.attempts + 1
    end,
    blocked_until = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.blocked_until
      when private.recovery_attempts.blocked_until is not null then null
      when private.recovery_attempts.attempts + 1 >= 6 then now() + interval '15 minutes'
      else null
    end,
    updated_at = now()
  returning attempts into phone_attempts;

  insert into private.recovery_attempts (subject, attempts)
  values ('ip:' || p_ip_hash, 1)
  on conflict (subject) do update set
    attempts = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.attempts + 1
      when private.recovery_attempts.blocked_until is not null then 1
      else private.recovery_attempts.attempts + 1
    end,
    blocked_until = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.blocked_until
      when private.recovery_attempts.blocked_until is not null then null
      when private.recovery_attempts.attempts + 1 >= 13 then now() + interval '30 minutes'
      else null
    end,
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

revoke all on function public.consume_password_recovery(text, text, text) from public, anon, authenticated;
grant execute on function public.consume_password_recovery(text, text, text) to service_role;
revoke all on function public.set_recovery_pin(text) from public, anon;
grant execute on function public.set_recovery_pin(text) to authenticated;

create or replace function public.get_unit_availability(p_unit_id uuid, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + 90 then raise exception 'Date window must be between 1 and 90 days'; end if;
  if not exists (select 1 from public.units u where u.id = p_unit_id and u.published) and not (select public.is_owner()) then
    raise exception 'Unit not found';
  end if;
  update public.bookings set status = 'expired', hold_expires_at = null
    where status = 'pending' and payment_status in ('unpaid', 'failed') and hold_expires_at <= now();
  return query
    select b.starts_at, b.ends_at, 'booked'::text from public.bookings b
      where b.unit_id = p_unit_id and (
          b.status in ('confirmed', 'checked_in') or (b.status = 'pending'
            and (b.hold_expires_at > now() or b.payment_status = 'processing'))
        )
        and b.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Riyadh')
        and b.ends_at > (p_from::timestamp at time zone 'Asia/Riyadh')
    union all
    select a.starts_at, a.ends_at, 'closed'::text from public.availability_blocks a
      where a.unit_id = p_unit_id
        and a.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Riyadh')
        and a.ends_at > (p_from::timestamp at time zone 'Asia/Riyadh');
end;
$$;

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

create or replace function public.get_booking_quote(
  p_unit_id uuid,
  p_package_id uuid,
  p_add_on_ids uuid[] default '{}',
  p_coupon_code text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  unit_price numeric(10,2);
  package_price numeric(10,2);
  addons_price numeric(10,2) := 0;
  subtotal numeric(10,2);
  discount numeric(10,2) := 0;
  coupon public.coupons%rowtype;
  normalized_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  expired_coupon_uses integer := 0;
  requested_count integer := cardinality(coalesce(p_add_on_ids, '{}'));
  eligible_count integer := 0;
begin
  if array_position(coalesce(p_add_on_ids, '{}'), null) is not null then
    raise exception 'Selected services are invalid';
  end if;
  select u.base_price into unit_price from public.units u where u.id = p_unit_id and u.published;
  if not found then raise exception 'Unit is unavailable'; end if;
  select p.price into package_price from public.packages p
    join public.package_units pu on pu.package_id = p.id
    where p.id = p_package_id and pu.unit_id = p_unit_id and p.active;
  if not found then raise exception 'Package is unavailable'; end if;

  select count(distinct a.id), coalesce(sum(a.price), 0) into eligible_count, addons_price
  from public.add_ons a
  join public.unit_add_ons ua on ua.add_on_id = a.id and ua.unit_id = p_unit_id
  where a.active and a.id = any(coalesce(p_add_on_ids, '{}'))
    and (exists (select 1 from public.package_add_ons pa where pa.package_id = p_package_id and pa.add_on_id = a.id)
      or not exists (select 1 from public.package_add_ons pa where pa.add_on_id = a.id));
  if eligible_count <> requested_count then raise exception 'A selected service is unavailable'; end if;
  if exists (
    select 1 from public.add_ons a join public.unit_add_ons ua on ua.add_on_id = a.id and ua.unit_id = p_unit_id
    where a.active and a.required and not coalesce(a.id = any(coalesce(p_add_on_ids, '{}')), false)
      and (exists (select 1 from public.package_add_ons pa where pa.package_id = p_package_id and pa.add_on_id = a.id)
        or not exists (select 1 from public.package_add_ons pa where pa.add_on_id = a.id))
  ) then raise exception 'A required service was not selected'; end if;

  subtotal := unit_price + package_price + addons_price;
  if normalized_code is not null then
    select * into coupon from public.coupons c where c.code = normalized_code and c.active;
    if not found then raise exception 'Coupon is invalid or unavailable'; end if;
    select count(*) into expired_coupon_uses from public.bookings b
      where b.coupon_id = coupon.id and b.status = 'pending'
        and b.payment_status in ('unpaid', 'failed') and b.hold_expires_at <= now();
    if (coupon.starts_at is not null and coupon.starts_at > now())
      or (coupon.ends_at is not null and coupon.ends_at <= now())
      or (coupon.max_uses is not null and coupon.used_count - expired_coupon_uses >= coupon.max_uses)
      or subtotal < coupon.minimum_amount
      or (coupon.unit_id is not null and coupon.unit_id <> p_unit_id)
      or (coupon.package_id is not null and coupon.package_id <> p_package_id)
    then raise exception 'Coupon is invalid or unavailable'; end if;
    discount := case when coupon.discount_type = 'percent' then round(subtotal * coupon.discount_value / 100, 2)
      else least(coupon.discount_value, subtotal) end;
  end if;
  return jsonb_build_object('unit_amount', unit_price, 'package_amount', package_price,
    'addons_amount', addons_price, 'discount_amount', discount, 'total_amount', subtotal - discount,
    'currency', 'SAR');
end;
$$;

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
  if booking_row.hold_expires_at <= now() then raise exception 'Booking hold expired'; end if;
  if not exists (select 1 from public.resort_settings where id and cash_enabled) then
    raise exception 'Cash payment is currently unavailable';
  end if;
  update public.bookings set status = 'confirmed', hold_expires_at = null where id = p_booking_id;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  booking_row public.bookings%rowtype;
  hours_before integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into booking_row from public.bookings where id = p_booking_id for update;
  if not found or (booking_row.customer_id <> (select auth.uid()) and not (select public.is_owner())) then
    raise exception 'Booking not found';
  end if;
  if booking_row.status not in ('pending', 'confirmed') then raise exception 'Booking cannot be cancelled'; end if;
  if booking_row.payment_status = 'paid' then raise exception 'Paid bookings must be refunded before cancellation'; end if;
  select cancellation_hours into hours_before from public.resort_settings where id;
  if not (select public.is_owner()) and booking_row.starts_at <= now() + make_interval(hours => coalesce(hours_before, 24)) then
    raise exception 'Cancellation window has passed';
  end if;
  update public.bookings set status = 'cancelled', hold_expires_at = null where id = p_booking_id;
end;
$$;

create or replace function public.submit_review(p_booking_id uuid, p_rating integer, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  booking_row public.bookings%rowtype;
  review_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_rating not between 1 and 5 or char_length(coalesce(p_body, '')) > 2000 then raise exception 'Invalid review'; end if;
  select * into booking_row from public.bookings where id = p_booking_id and customer_id = (select auth.uid());
  if not found or booking_row.status <> 'completed' then raise exception 'A completed booking is required'; end if;
  insert into public.reviews (booking_id, customer_id, unit_id, rating, body)
  values (booking_row.id, booking_row.customer_id, booking_row.unit_id, p_rating, trim(coalesce(p_body, '')))
  returning id into review_id;
  return review_id;
end;
$$;

grant execute on function public.get_unit_availability(uuid, date, date) to anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, timestamptz, timestamptz, integer, uuid[], text, text) to authenticated;
grant execute on function public.get_booking_quote(uuid, uuid, uuid[], text) to anon, authenticated;
grant execute on function public.confirm_booking_cash(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
grant execute on function public.claim_first_owner(uuid) to service_role;

alter table public.profiles enable row level security;
alter table public.resort_settings enable row level security;
alter table public.units enable row level security;
alter table public.amenities enable row level security;
alter table public.unit_amenities enable row level security;
alter table public.unit_media enable row level security;
alter table public.packages enable row level security;
alter table public.package_units enable row level security;
alter table public.package_features enable row level security;
alter table public.add_ons enable row level security;
alter table public.unit_add_ons enable row level security;
alter table public.package_add_ons enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.coupons enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.inquiries enable row level security;
alter table public.notifications enable row level security;
alter table public.faq_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table private.account_recovery enable row level security;
alter table private.recovery_attempts enable row level security;

grant select on public.resort_settings, public.units, public.amenities, public.unit_amenities,
  public.unit_media, public.packages, public.package_units, public.package_features,
  public.add_ons, public.unit_add_ons, public.package_add_ons, public.reviews, public.faq_entries to anon, authenticated;
grant select on public.profiles, public.bookings, public.booking_items, public.payments,
  public.favorites, public.notifications, public.inquiries, public.audit_logs to authenticated;
grant insert (name, phone, message, customer_id, unit_id, package_id, booking_id) on public.inquiries to anon, authenticated;
grant insert (customer_id, unit_id) on public.favorites to authenticated;
grant insert (customer_id, booking_id, title, body, kind) on public.notifications to authenticated;
grant delete on public.favorites to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant update on public.bookings, public.payments, public.reviews, public.inquiries,
  public.resort_settings, public.units, public.amenities, public.unit_amenities, public.unit_media,
  public.packages, public.package_units, public.package_features, public.add_ons,
  public.unit_add_ons, public.package_add_ons, public.availability_blocks, public.coupons,
  public.faq_entries to authenticated;
grant insert, delete on public.units, public.amenities, public.unit_amenities, public.unit_media,
  public.packages, public.package_units, public.package_features, public.add_ons,
  public.unit_add_ons, public.package_add_ons, public.availability_blocks, public.coupons,
  public.faq_entries to authenticated;

create policy "profile read own or owner" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_owner()));
create policy "profile update own name" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "resort settings public read" on public.resort_settings for select to anon, authenticated using (true);
create policy "resort settings owner manage" on public.resort_settings for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "units published read" on public.units for select to anon, authenticated
  using (published or (select public.is_owner()));
create policy "units owner manage" on public.units for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "amenities public read" on public.amenities for select to anon, authenticated using (true);
create policy "amenities owner manage" on public.amenities for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "unit amenities public read" on public.unit_amenities for select to anon, authenticated using (true);
create policy "unit amenities owner manage" on public.unit_amenities for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "unit media public read" on public.unit_media for select to anon, authenticated
  using (exists (select 1 from public.units u where u.id = unit_id and u.published) or (select public.is_owner()));
create policy "unit media owner manage" on public.unit_media for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "packages active read" on public.packages for select to anon, authenticated
  using (active or (select public.is_owner()));
create policy "packages owner manage" on public.packages for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "package units public read" on public.package_units for select to anon, authenticated using (true);
create policy "package units owner manage" on public.package_units for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "package features public read" on public.package_features for select to anon, authenticated using (true);
create policy "package features owner manage" on public.package_features for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "add ons active read" on public.add_ons for select to anon, authenticated
  using (active or (select public.is_owner()));
create policy "add ons owner manage" on public.add_ons for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "unit add ons public read" on public.unit_add_ons for select to anon, authenticated using (true);
create policy "unit add ons owner manage" on public.unit_add_ons for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "package add ons public read" on public.package_add_ons for select to anon, authenticated using (true);
create policy "package add ons owner manage" on public.package_add_ons for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "availability owner read and manage" on public.availability_blocks for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "coupons owner read and manage" on public.coupons for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "bookings customer or owner read" on public.bookings for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_owner()));
create policy "bookings owner update" on public.bookings for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "booking items customer or owner read" on public.booking_items for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and (b.customer_id = (select auth.uid()) or (select public.is_owner()))));
create policy "payments customer or owner read" on public.payments for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_owner()));
create policy "payments owner manage" on public.payments for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "favorites own manage" on public.favorites for all to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy "reviews published read" on public.reviews for select to anon, authenticated
  using (status = 'published' or customer_id = (select auth.uid()) or (select public.is_owner()));
create policy "reviews customer submit" on public.reviews for insert to authenticated
  with check (customer_id = (select auth.uid()) and exists (
    select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'completed'
  ));
create policy "reviews owner manage" on public.reviews for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "inquiries public create" on public.inquiries for insert to anon, authenticated
  with check (status = 'new' and (customer_id is null or customer_id = (select auth.uid())));
create policy "inquiries owner read and manage" on public.inquiries for select to authenticated
  using ((select public.is_owner()));
create policy "inquiries owner update" on public.inquiries for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

create policy "notifications customer read" on public.notifications for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_owner()));
create policy "notifications customer mark read" on public.notifications for update to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy "notifications owner create" on public.notifications for insert to authenticated
  with check ((select public.is_owner()));

create policy "faq public read" on public.faq_entries for select to anon, authenticated
  using (published or (select public.is_owner()));
create policy "faq owner manage" on public.faq_entries for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "audit logs owner read" on public.audit_logs for select to authenticated
  using ((select public.is_owner()));

create policy "private recovery inaccessible" on private.account_recovery for all to authenticated using (false) with check (false);
create policy "private attempts inaccessible" on private.recovery_attempts for all to authenticated using (false) with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resort-media', 'resort-media', true, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "resort media public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'resort-media');
create policy "resort media owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'resort-media' and (select public.is_owner()));
create policy "resort media owner update" on storage.objects for update to authenticated
  using (bucket_id = 'resort-media' and (select public.is_owner()))
  with check (bucket_id = 'resort-media' and (select public.is_owner()));
create policy "resort media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resort-media' and (select public.is_owner()));

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to service_role;
grant usage on all sequences in schema public to service_role;

notify pgrst, 'reload schema';
