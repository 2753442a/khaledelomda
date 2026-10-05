-- ============================================================
-- منتجع وبستان خالد العمدة — Database Migration Script
-- Run this in Supabase SQL Editor
-- (Idempotent: Safe to run multiple times without errors)
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. Resort Global Settings
-- ─────────────────────────────────────────────────────────────
create table if not exists resort_settings (
  id integer primary key default 1,
  resort_name text not null default 'منتجع وبستان خالد العمدة للاستثمار',
  deposit_percentage numeric not null default 25,
  default_check_in_time time not null default '15:30',
  default_check_out_time time not null default '11:30',
  bank_name text not null default 'مصرف الراجحي',
  bank_account_name text not null default 'خالد العمدة',
  bank_iban text not null default 'SA0000000000000000000000',
  contact_phone text not null default '0543034553',
  contact_whatsapp text not null default '0547382222',
  constraint single_row_check check (id = 1)
);

insert into resort_settings (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2. Profiles (Linked to Supabase Auth)
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  phone text unique not null,
  role text default 'customer' check (role in ('customer', 'admin')),
  is_flagged boolean default false,
  is_blacklisted boolean default false,
  cancellation_count integer default 0,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. Properties / Units
-- ─────────────────────────────────────────────────────────────
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  weekday_price numeric not null,
  weekend_price numeric not null,
  images text[] default '{}',
  video_url text,
  amenities text[] default '{}',
  max_guests integer default 50,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Insert initial property for the resort if not present
insert into properties (name, description, weekday_price, weekend_price, amenities, max_guests)
select
  'المنتجع الكامل',
  'استمتع بكامل مرافق المنتجع: بستان نخيل، مسبح مع ألعاب مائية، مجلس VIP، مجلس أرضي، غرفة ماستر، ومطبخ متكامل',
  3500,
  5000,
  ARRAY['بستان نخيل', 'مسبح', 'ألعاب مائية للأطفال', 'مجلس VIP', 'مجلس أرضي', 'غرفة ماستر', 'مطبخ كامل', 'ملعب أطفال جاف', 'بيرغولا خشبية', 'موقف سيارات'],
  200
where not exists (select 1 from properties where name = 'المنتجع الكامل');

-- ─────────────────────────────────────────────────────────────
-- 4. Central Addons (Shared Inventory)
-- ─────────────────────────────────────────────────────────────
create table if not exists addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null,
  total_inventory integer default 1,
  icon text default 'Zap',
  is_active boolean default true
);

-- Insert Electric Scooters if not present
insert into addons (name, description, price, total_inventory, icon)
select
  'سكوتر كهربائي',
  'سكوتر كهربائي للتنزه داخل المنتجع — متاح خلال ساعات الحجز فقط',
  150,
  3,
  'Zap'
where not exists (select 1 from addons where name = 'سكوتر كهربائي');

-- ─────────────────────────────────────────────────────────────
-- 5. Bookings
-- ─────────────────────────────────────────────────────────────
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete restrict,
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  booking_date date not null,
  check_in timestamptz not null,
  check_out timestamptz not null,
  total_amount numeric not null,
  deposit_amount numeric not null,
  payment_method text check (payment_method in ('bank_transfer', 'cash_on_arrival')),
  payment_receipt_url text,
  status text default 'pending_receipt' check (status in (
    'pending_receipt',
    'pending_verification',
    'confirmed',
    'cancelled',
    'completed',
    'expired'
  )),
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  constraint unique_property_date unique (property_id, booking_date)
);

-- ─────────────────────────────────────────────────────────────
-- 6. Booking Addons
-- ─────────────────────────────────────────────────────────────
create table if not exists booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  addon_id uuid references addons(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric not null
);

-- ─────────────────────────────────────────────────────────────
-- 7. 48-Hour Auto Purge Function
-- ─────────────────────────────────────────────────────────────
create or replace function purge_old_receipts()
returns void as $$
declare
  r record;
begin
  for r in
    select id, payment_receipt_url
    from bookings
    where payment_receipt_url is not null
      and payment_receipt_url not like 'archived_%'
      and check_in <= (now() - interval '48 hours')
  loop
    -- Delete from storage
    delete from storage.objects
    where bucket_id = 'receipts'
      and name = r.payment_receipt_url;

    -- Mark as archived
    update bookings
    set payment_receipt_url = 'archived_purged_after_48h'
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 8. 2-Hour Auto-Expire Function
-- ─────────────────────────────────────────────────────────────
create or replace function expire_pending_bookings()
returns void as $$
begin
  update bookings
  set status = 'expired'
  where status = 'pending_receipt'
    and created_at <= (now() - interval '2 hours');
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 9. Auto-create Profile Trigger on User Signup
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    coalesce(new.raw_user_meta_data->>'phone', split_part(new.email, '@', 1)),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 10. Helper function to check admin without RLS recursion
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 11. Row Level Security Policies (Safe re-runs & No Recursion)
-- ─────────────────────────────────────────────────────────────

-- Enable RLS
alter table resort_settings enable row level security;
alter table profiles enable row level security;
alter table properties enable row level security;
alter table addons enable row level security;
alter table bookings enable row level security;
alter table booking_addons enable row level security;

-- resort_settings policies
drop policy if exists "Public read settings" on resort_settings;
create policy "Public read settings" on resort_settings
  for select using (true);

drop policy if exists "Admin update settings" on resort_settings;
create policy "Admin update settings" on resort_settings
  for update using (public.is_admin());

-- profiles policies
drop policy if exists "Users read own profile" on profiles;
create policy "Users read own profile" on profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile" on profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own profile" on profiles;
create policy "Users insert own profile" on profiles
  for insert with check (id = auth.uid() or public.is_admin());

drop policy if exists "Admin update any profile" on profiles;
create policy "Admin update any profile" on profiles
  for update using (public.is_admin());

-- properties policies: public read, admin write
drop policy if exists "Public read properties" on properties;
create policy "Public read properties" on properties
  for select using (true);

drop policy if exists "Admin insert properties" on properties;
create policy "Admin insert properties" on properties
  for insert with check (public.is_admin());

drop policy if exists "Admin update properties" on properties;
create policy "Admin update properties" on properties
  for update using (public.is_admin());

drop policy if exists "Admin delete properties" on properties;
create policy "Admin delete properties" on properties
  for delete using (public.is_admin());

drop policy if exists "Admin manage properties" on properties;

-- addons policies: public read, admin write
drop policy if exists "Public read addons" on addons;
create policy "Public read addons" on addons
  for select using (true);

drop policy if exists "Admin insert addons" on addons;
create policy "Admin insert addons" on addons
  for insert with check (public.is_admin());

drop policy if exists "Admin update addons" on addons;
create policy "Admin update addons" on addons
  for update using (public.is_admin());

drop policy if exists "Admin delete addons" on addons;
create policy "Admin delete addons" on addons
  for delete using (public.is_admin());

drop policy if exists "Admin manage addons" on addons;

-- bookings policies
drop policy if exists "Users read own bookings" on bookings;
create policy "Users read own bookings" on bookings
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists "Users insert booking" on bookings;
create policy "Users insert booking" on bookings
  for insert with check (customer_id = auth.uid() or public.is_admin());

drop policy if exists "Users update own booking" on bookings;
create policy "Users update own booking" on bookings
  for update using (customer_id = auth.uid() or public.is_admin());

drop policy if exists "Admin delete booking" on bookings;
create policy "Admin delete booking" on bookings
  for delete using (public.is_admin());

-- booking_addons policies
drop policy if exists "Users read own booking addons" on booking_addons;
create policy "Users read own booking addons" on booking_addons
  for select using (
    exists (
      select 1 from bookings b
      where b.id = booking_id and (
        b.customer_id = auth.uid() or public.is_admin()
      )
    )
  );

drop policy if exists "Users insert booking addons" on booking_addons;
create policy "Users insert booking addons" on booking_addons
  for insert with check (
    exists (
      select 1 from bookings b where b.id = booking_id and (b.customer_id = auth.uid() or public.is_admin())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 12. Storage Bucket & Policies (receipts)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload receipts" on storage.objects;
create policy "Authenticated users can upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

drop policy if exists "Anyone can read receipts" on storage.objects;
create policy "Anyone can read receipts" on storage.objects
  for select using (bucket_id = 'receipts');

-- ─────────────────────────────────────────────────────────────
-- SUCCESS ✅
-- ─────────────────────────────────────────────────────────────
