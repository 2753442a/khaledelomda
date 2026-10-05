-- ============================================================
-- خدمة وايت ماء حلو للمنازل والاستراحات — Water Tanker Delivery Migration
-- Run this in Supabase SQL Editor
-- (Idempotent: Safe to run multiple times without errors)
-- ============================================================

-- 1. Water Tanker Sizes & Pricing Managed by Admin
create table if not exists water_tanker_sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g., 'وايت عايدي', 'وايت تريلا'
  capacity_label text not null, -- e.g., '12 طن (12,000 لتر)', '30 طن'
  price numeric not null, -- e.g., 120, 250
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- Seed Initial Default Sizes
insert into water_tanker_sizes (name, capacity_label, price, display_order)
values 
  ('وايت عايدي (حجم متوسط)', '12 طن - 12,000 لتر', 120, 1),
  ('وايت تريلا (حجم كبير)', '30 طن - 30,000 لتر', 250, 2)
on conflict do nothing;

-- 2. Water Tanker Delivery Orders
create table if not exists water_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  tanker_size_id uuid references water_tanker_sizes(id) on delete restrict,
  tanker_size_name text not null, -- Snapshot of name at order time
  tanker_price numeric not null, -- Snapshot of price at order time
  district text not null, -- اسم الحي
  street_address text, -- الشارع / رقم المنزل
  google_maps_url text, -- رابط خرائط جوجل من الـ GPS
  tank_type text default 'أرضي' check (tank_type in ('أرضي', 'علوي', 'كلاهما')),
  payment_method text not null check (payment_method in ('cash', 'pos_on_delivery', 'bank_transfer')),
  status text default 'new' check (status in ('new', 'dispatched', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- 3. Row Level Security Policies
alter table water_tanker_sizes enable row level security;
alter table water_orders enable row level security;

-- Public can view active sizes, Admin has full CRUD
drop policy if exists "Public read active water sizes" on water_tanker_sizes;
create policy "Public read active water sizes" on water_tanker_sizes for select using (true);

drop policy if exists "Admin manage water sizes" on water_tanker_sizes;
create policy "Admin manage water sizes" on water_tanker_sizes for all using (public.is_admin());

-- Customers/Public can create orders, Admin has full control
drop policy if exists "Anyone can insert water orders" on water_orders;
create policy "Anyone can insert water orders" on water_orders for insert with check (true);

drop policy if exists "Customers read own water orders" on water_orders;
create policy "Customers read own water orders" on water_orders for select using (
  customer_id = auth.uid() or public.is_admin()
);

drop policy if exists "Admin manage water orders" on water_orders;
create policy "Admin manage water orders" on water_orders for all using (public.is_admin());
