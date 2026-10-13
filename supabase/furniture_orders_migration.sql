-- ==============================================================================
-- إنشاء جدول وإعدادات منظومة طلبات أثاث التراث (furniture_orders)
-- Furniture Orders Schema, Indexes, RLS Policies & Realtime Sync
-- ==============================================================================

create table if not exists public.furniture_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null check (total_amount >= 0),
  city text not null default 'الرياض',
  district text not null,
  street_address text,
  google_maps_url text,
  delivery_type text not null default 'delivery' check (delivery_type in ('delivery', 'pickup')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'pos_on_delivery', 'bank_transfer')),
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipping', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- الفهارس لتسريع الاستعلام والفلترة
create index if not exists idx_furniture_orders_status on public.furniture_orders(status);
create index if not exists idx_furniture_orders_customer_id on public.furniture_orders(customer_id);
create index if not exists idx_furniture_orders_customer_phone on public.furniture_orders(customer_phone);
create index if not exists idx_furniture_orders_created_at on public.furniture_orders(created_at desc);

-- تفعيل سياسات الأمان RLS
alter table public.furniture_orders enable row level security;

-- 1. السماح للجميع بإنشاء طلب أثاث جديد
drop policy if exists "Anyone can insert furniture orders" on public.furniture_orders;
create policy "Anyone can insert furniture orders" on public.furniture_orders
  for insert with check (true);

-- 2. السماح للعميل بمشاهدة طلباته
drop policy if exists "Customers read own furniture orders" on public.furniture_orders;
create policy "Customers read own furniture orders" on public.furniture_orders
  for select using (
    customer_id = auth.uid() or
    customer_phone = (select phone from public.profiles where id = auth.uid()) or
    public.is_admin()
  );

-- 3. السماح للمشرفين بإدارة كافة الطلبات
drop policy if exists "Admin manage furniture orders" on public.furniture_orders;
create policy "Admin manage furniture orders" on public.furniture_orders
  for all using (public.is_admin());

-- تفعيل Realtime لمزامنة وصول الطلبات لحظياً
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'furniture_orders'
  ) then
    alter publication supabase_realtime add table public.furniture_orders;
  end if;
exception when others then
  null;
end $$;
