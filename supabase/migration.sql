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
update resort_settings set default_check_in_time = '15:30', default_check_out_time = '11:30' where id = 1;

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
declare
  user_phone text;
  user_role text;
begin
  user_phone := coalesce(new.raw_user_meta_data->>'phone', split_part(new.email, '@', 1));
  if user_phone = '0556854162' then
    user_role := 'admin';
  else
    user_role := 'customer';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', case when user_role = 'admin' then 'إدارة المنتجع' else 'مستخدم جديد' end),
    user_phone,
    user_role
  )
  on conflict (id) do update set
    role = case when user_phone = '0556854162' then 'admin' else profiles.role end,
    phone = excluded.phone;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also ensure any existing profile with this phone is promoted to admin
update public.profiles set role = 'admin' where phone = '0556854162';

-- ─────────────────────────────────────────────────────────────
-- 10. Helper function to check admin without RLS recursion
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or phone = '0556854162')
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
drop policy if exists "Anyone read bookings" on bookings;
create policy "Anyone read bookings" on bookings
  for select using (true);

drop policy if exists "Users insert booking" on bookings;
create policy "Users insert booking" on bookings
  for insert with check (true);

drop policy if exists "Users update own booking" on bookings;
create policy "Users update own booking" on bookings
  for update using (customer_id = auth.uid() or public.is_admin());

drop policy if exists "Admin delete booking" on bookings;
create policy "Admin delete booking" on bookings
  for delete using (public.is_admin());

-- booking_addons policies
drop policy if exists "Users read own booking addons" on booking_addons;
drop policy if exists "Anyone read booking addons" on booking_addons;
create policy "Anyone read booking addons" on booking_addons
  for select using (true);

drop policy if exists "Users insert booking addons" on booking_addons;
create policy "Users insert booking addons" on booking_addons
  for insert with check (true);

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
-- 13. Water Tanker Delivery Service (وايت ماء حلو)
-- ─────────────────────────────────────────────────────────────
create table if not exists water_tanker_sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity_label text not null,
  price numeric not null,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);

insert into water_tanker_sizes (name, capacity_label, price, display_order)
values 
  ('وايت عايدي (حجم متوسط)', '12 طن - 12,000 لتر', 120, 1),
  ('وايت تريلا (حجم كبير)', '30 طن - 30,000 لتر', 250, 2)
on conflict do nothing;

create table if not exists water_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  tanker_size_id uuid references water_tanker_sizes(id) on delete restrict,
  tanker_size_name text not null,
  tanker_price numeric not null,
  district text not null,
  street_address text,
  google_maps_url text,
  tank_type text default 'أرضي' check (tank_type in ('أرضي', 'علوي', 'كلاهما')),
  payment_method text not null check (payment_method in ('cash', 'pos_on_delivery', 'bank_transfer')),
  status text default 'new' check (status in ('new', 'dispatched', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

alter table water_tanker_sizes enable row level security;
alter table water_orders enable row level security;

drop policy if exists "Public read active water sizes" on water_tanker_sizes;
create policy "Public read active water sizes" on water_tanker_sizes for select using (true);

drop policy if exists "Admin manage water sizes" on water_tanker_sizes;
create policy "Admin manage water sizes" on water_tanker_sizes for all using (public.is_admin());

drop policy if exists "Anyone can insert water orders" on water_orders;
create policy "Anyone can insert water orders" on water_orders for insert with check (true);

drop policy if exists "Customers read own water orders" on water_orders;
create policy "Customers read own water orders" on water_orders for select using (
  customer_id = auth.uid() or public.is_admin()
);

drop policy if exists "Admin manage water orders" on water_orders;
create policy "Admin manage water orders" on water_orders for all using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 14. Resort Facilities CMS (إدارة مرافق المنتجع)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.resort_facilities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  badge_text text,
  description text not null,
  image_url text not null,
  features text[] default '{}',
  privacy_note text default 'مشمول بكامل الخصوصية',
  cta_text text default 'احجز هذه الوحدة',
  display_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.resort_facilities enable row level security;

drop policy if exists "Public read active facilities" on public.resort_facilities;
create policy "Public read active facilities" on public.resort_facilities 
  for select using (is_active = true or public.is_admin());

drop policy if exists "Admin manage facilities" on public.resort_facilities;
create policy "Admin manage facilities" on public.resort_facilities 
  for all using (public.is_admin());

insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
values
  (
    'مسبح متدرج وألعاب مائية عائلية (Aqua Park)',
    'انتعاش وخصوصية مطلقة لجميع الأعمار',
    'انتعاش ومرح عائلي 🌊',
    'مسبح بتصميم انسيابي متدرج العمق مع بيرغولا خشبية مظللة وألعاب مائية ممتعة للأطفال، وفلترة آلية متطورة تضمن أعلى معايير النظافة والسلامة.',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
    array['ألعاب مائية للأطفال', 'بيرغولا خشبية مظللة', 'تعقيم وفلترة دورية', 'خصوصية عائلية كاملة'],
    'مشمول بكامل الخصوصية',
    1
  ),
  (
    'بستان النخيل وممرات المشي الطبيعية',
    'هدوء الواحة وسحر الإضاءة المسائية',
    'طبيعة خلابة وممرات واسعة 🌴',
    'أشجار نخيل باسقة ومسارات مشي حجرية فسيحة تتسع لحركة المركبات وتتيح لك الاستمتاع بنسيم الطبيعة العليل والتجول الممتع.',
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
    array['نخيل طبيعي مثمر', 'ممر سيارات فسيح', 'إضاءات ليلية ساحرة'],
    'مشمول بكامل الخصوصية',
    2
  ),
  (
    'المسطحات الخضراء والحديقة الدائرية',
    'مساحات مفتوحة مصممة للمناسبات الكبرى',
    'أفراح واحتفالات 🎪',
    'مسطح عشب طبيعي دائري رحب ومنسق بعناية، مثالي لتنظيم حفلات الزفاف، التخرج، واللقاءات العائلية الكبرى في الهواء الطلق.',
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
    array['عشب طبيعي منسق', 'سعة حفلات رحبة', 'جلسات خارجية راقية'],
    'مشمول بكامل الخصوصية',
    3
  ),
  (
    'مجالس الضيافة الملكية VIP',
    'أصالة الكرم وقمة الفخامة المعاصرة',
    'ضيافة وأصالة ☕',
    'مجلس VIP ملكي راقٍ مجهز بأحدث الديكورات وشاشات العرض الذكية، بالإضافة إلى مجلس أرضي شعبي كبير يعكس أصالة وكرم الضيافة السعودية.',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    array['مجلس VIP ملكي', 'مجلس أرضي كبير', 'تكييف مركزي متكامل', 'شاشات ذكية وصوتيات'],
    'مشمول بكامل الخصوصية',
    4
  ),
  (
    'أسطول السكوترات الكهربائية',
    'إضافة ترفيهية مميزة لجولات البستان',
    'مغامرة واستكشاف ⚡',
    'أسطول حديث من السكوترات الكهربائية المجهزة بخوذ الأمان، متاح للحجز الإضافي ليمنح ضيوفكم وأطفالكم جولات حرة ممتعة في ممرات البستان.',
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
    array['سكوترات حديثة سريعة', 'خوذ وأدوات سلامة', 'حجز إضافي فوري'],
    'إضافة اختيارية عند الحجز',
    5
  ),
  (
    'جناح الماستر والمطبخ الفندقي المتكامل',
    'أقصى درجات الراحة والتجهيزات المنزلية',
    'راحة متكاملة 🍳',
    'غرفة نوم رئيسية مريحة مؤثثة بأسلوب فندقي حديث، مع مطبخ متكامل بجميع أجهزة الطهي، الميكروويف، والثلاجة لتلبية كل احتياجات ضيوفكم.',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    array['سرير ماستر فندقي', 'مطبخ بجميع الأجهزة', 'دورات مياه فندقية'],
    'مشمول بكامل الخصوصية',
    6
  )
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- SUCCESS ✅
-- ─────────────────────────────────────────────────────────────
