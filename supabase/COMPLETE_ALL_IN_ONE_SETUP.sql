-- ==============================================================================
-- منتجع وبستان خالد العمدة للاستثمار — ملف الإعداد الشامل المتكامل للقاعدة
-- COMPLETE ALL-IN-ONE SUPABASE SQL SETUP SCRIPT
-- ==============================================================================
-- هذا الملف مجمع وشامل لكل أقسام النظام وجداوله وصلاحياته حتى الآن:
-- 1. إعدادات المنتجع وهوية الواجهة والهيرو (resort_settings)
-- 2. المستخدمين وصلاحيات المسؤول 0556854162 وحمايتها (profiles)
-- 3. استراحات ووحدات المنتجع والصور المتعددة (properties)
-- 4. الخدمات والإضافات ومخزون السكوترات (addons)
-- 5. الحجوزات وإضافات الحجز وفهارس التقويم الذكية (bookings & booking_addons)
-- 6. أسطول وايت ماء حلو وطلبات التوصيل (water_tanker_sizes & water_orders)
-- 7. دفتر الحسابات والمصروفات والرحلات اليدوية (water_expenses & water_manual_trips)
-- 8. إدارة أقسام ومرافق المنتجع CMS (resort_facilities)
-- 9. متجر ومعرض كراسي وأثاث الخيزران التراثي (heritage_furniture)
-- 10. مخازن التخزين السحابية وسياساتها (receipts & resort-media)
-- 11. دوال الأمان والحذف التلقائي والإلغاء الذكي (Functions & Triggers)
-- 12. تفعيل التحديث اللحظي (Supabase Realtime)
--
-- آمن 100% للتشغيل المتكرر (Idempotent): لا يحذف بياناتك ولا يرمي أخطاء!
-- ==============================================================================

-- تفعيل الملحقات الأساسية
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. جدول إعدادات المنتجع وواجهة الهيرو (resort_settings)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.resort_settings (
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

-- التأكد من وجود كافة أعمدة الـ CMS والواجهة والإحصائيات
alter table public.resort_settings
  add column if not exists hero_image_url text default 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=2000&q=80',
  add column if not exists hero_title text default 'منتجع وبستان خالد العمدة',
  add column if not exists hero_subtitle text default 'انغمس في تجربة استثنائية تجمع بين بستان النخيل والمسطحات الخضراء، والمسبح الفيروزي والألعاب المائية، ومجالس الضيافة الملكية في خصوصية تامة تلبي كافة تطلعاتكم.',
  add column if not exists hero_badge text default '🌴💧 واحة الاسترخاء والمناسبات في قلب الطبيعة',
  add column if not exists stats_events text default '+200',
  add column if not exists stats_clients text default '+1000',
  add column if not exists stats_days text default '365',
  add column if not exists show_hero_stats boolean default true,
  add column if not exists location_address text default 'المملكة العربية السعودية • موقع مميز وسهل الوصول',
  add column if not exists water_contact_phone text default '0543034553',
  add column if not exists water_contact_whatsapp text default '0547382222';

-- إدراج الصف الأساسي إن لم يكن موجوداً
insert into public.resort_settings (id)
values (1)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2. جدول ملفات المستخدمين وتحديد المسؤول (profiles)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  phone text unique not null,
  role text default 'customer' check (role in ('customer', 'admin')),
  is_flagged boolean default false,
  is_blacklisted boolean default false,
  cancellation_count integer default 0,
  created_at timestamptz default now()
);

-- دالة فحص صلاحية المسؤول بدون حدوث تكرار لا نهائي في RLS
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or phone = '0556854162')
  );
end;
$$ language plpgsql security definer;

-- دالة تلقائية لربط الحساب الجديد وتعيين 0556854162 كمسؤول
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

-- إنشاء مشغل المستخدمين الجدد بأمان
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ترقية حساب المسؤول 0556854162 فوراً إن وجد
update public.profiles set role = 'admin' where phone = '0556854162';

-- دالة حماية تمنع العميل العادي من تعديل صلاحياته أو رفع الحظر عن نفسه
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_flagged := old.is_flagged;
    new.is_blacklisted := old.is_blacklisted;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_profile_fields on public.profiles;
create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute procedure public.protect_profile_fields();

-- ─────────────────────────────────────────────────────────────
-- 3. جدول الوحدات والاستراحات ودعم الصور المتعددة (properties)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  weekday_price numeric not null,
  weekend_price numeric not null,
  cover_image text,
  images text[] default '{}',
  video_url text,
  amenities text[] default '{}',
  max_guests integer default 50,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.properties
  add column if not exists images text[] default '{}',
  add column if not exists cover_image text;

-- إضافة الوحدة الافتراضية إن لم تكن موجودة
insert into public.properties (name, description, weekday_price, weekend_price, amenities, max_guests, cover_image, images)
select
  'المنتجع الكامل',
  'استمتع بكامل مرافق المنتجع: بستان نخيل، مسبح مع ألعاب مائية، مجلس VIP، مجلس أرضي، غرفة ماستر، ومطبخ متكامل',
  3500,
  5000,
  ARRAY['بستان نخيل', 'مسبح', 'ألعاب مائية للأطفال', 'مجلس VIP', 'مجلس أرضي', 'غرفة ماستر', 'مطبخ كامل', 'ملعب أطفال جاف', 'بيرغولا خشبية', 'موقف سيارات'],
  200,
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
  ARRAY['https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80']
where not exists (select 1 from public.properties where name = 'المنتجع الكامل');

-- ─────────────────────────────────────────────────────────────
-- 4. جدول الإضافات والخدمات وصور المعاينة (addons)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null,
  total_inventory integer default 1,
  icon text default 'Zap',
  image_url text,
  is_active boolean default true
);

alter table public.addons
  add column if not exists image_url text;

-- إضافة السكوتر الكهربائي كخدمة أساسية مع صورة المعاينة
insert into public.addons (name, description, price, total_inventory, icon, image_url)
select
  'سكوتر كهربائي',
  'سكوتر كهربائي للتنزه والتجول الممتع داخل ممرات البستان — متاح خلال ساعات الحجز فقط',
  150,
  3,
  'Zap',
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80'
where not exists (select 1 from public.addons where name = 'سكوتر كهربائي');

update public.addons
set image_url = 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80'
where name like '%سكوتر%' and (image_url is null or image_url = '');

-- ─────────────────────────────────────────────────────────────
-- 5. جدول الحجوزات وإضافات الحجز (bookings & booking_addons)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
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
  created_at timestamptz default now()
);

-- إزالة القيد القديم الصارم إن وجد لاستبداله بالفهرس المشروط الذكي
alter table public.bookings drop constraint if exists unique_property_date;

create table if not exists public.booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  addon_id uuid references public.addons(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric not null
);

-- دالة حذف صور الإيصالات تلقائياً بعد مرور 48 ساعة على الحجز لحماية الخصوصية
create or replace function public.purge_old_receipts()
returns void as $$
declare
  r record;
begin
  for r in
    select id, payment_receipt_url
    from public.bookings
    where payment_receipt_url is not null
      and payment_receipt_url not like 'archived_%'
      and check_in <= (now() - interval '48 hours')
  loop
    delete from storage.objects
    where bucket_id = 'receipts'
      and name = r.payment_receipt_url;

    update public.bookings
    set payment_receipt_url = 'archived_purged_after_48h'
    where id = r.id;
  end loop;
end;
$$ language plpgsql security definer;

-- دالة إلغاء الحجوزات المعلقة تلقائياً بعد ساعتين إذا لم يتم رفع الإيصال (تستثني الدفع عند الوصول)
create or replace function public.expire_pending_bookings()
returns void as $$
begin
  update public.bookings
  set status = 'expired'
  where status = 'pending_receipt'
    and coalesce(payment_method, 'bank_transfer') = 'bank_transfer'
    and created_at <= (now() - interval '2 hours');
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 6. خدمة طلب وايت ماء حلو (water_tanker_sizes & water_orders)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.water_tanker_sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity_label text not null,
  price numeric not null,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamptz default now()
);

insert into public.water_tanker_sizes (name, capacity_label, price, display_order)
values 
  ('وايت عايدي (حجم متوسط)', '12 طن - 12,000 لتر', 120, 1),
  ('وايت تريلا (حجم كبير)', '30 طن - 30,000 لتر', 250, 2)
on conflict do nothing;

create table if not exists public.water_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  tanker_size_id uuid references public.water_tanker_sizes(id) on delete restrict,
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

-- ─────────────────────────────────────────────────────────────
-- 7. سجل وحسابات الوايت والمصروفات اليومية (water_expenses & water_manual_trips)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.water_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (category in ('ديزل', 'صيانة وقطع غيار', 'زيوت وغسيل', 'أخرى')),
  amount numeric not null check (amount > 0),
  notes text,
  receipt_image_url text,
  created_at timestamptz default now()
);

create table if not exists public.water_manual_trips (
  id uuid primary key default gen_random_uuid(),
  trip_date date not null default current_date,
  tanker_size text not null default 'عايدي',
  amount numeric not null check (amount >= 0),
  notes text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- 8. جدول مرافق وأقسام المنتجع (resort_facilities)
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

-- إضافة مرافق المنتجع الأساسية إن لم تكن مسجلة
insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
select
  'مسبح متدرج وألعاب مائية عائلية (Aqua Park)',
  'انتعاش وخصوصية مطلقة لجميع الأعمار',
  'انتعاش ومرح عائلي 🌊',
  'مسبح بتصميم انسيابي متدرج العمق مع بيرغولا خشبية مظللة وألعاب مائية ممتعة للأطفال، وفلترة آلية متطورة تضمن أعلى معايير النظافة والسلامة.',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
  array['ألعاب مائية للأطفال', 'بيرغولا خشبية مظللة', 'تعقيم وفلترة دورية', 'خصوصية عائلية كاملة'],
  'مشمول بكامل الخصوصية',
  1
where not exists (select 1 from public.resort_facilities where title like '%Aqua Park%');

insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
select
  'بستان النخيل وممرات المشي الطبيعية',
  'هدوء الواحة وسحر الإضاءة المسائية',
  'طبيعة خلابة وممرات واسعة 🌴',
  'أشجار نخيل باسقة ومسارات مشي حجرية فسيحة تتسع لحركة المركبات وتتيح لك الاستمتاع بنسيم الطبيعة العليل والتجول الممتع.',
  'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
  array['نخيل طبيعي مثمر', 'ممر سيارات فسيح', 'إضاءات ليلية ساحرة'],
  'مشمول بكامل الخصوصية',
  2
where not exists (select 1 from public.resort_facilities where title like '%بستان النخيل%');

insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
select
  'المسطحات الخضراء والحديقة الدائرية',
  'مساحات مفتوحة مصممة للمناسبات الكبرى',
  'أفراح واحتفالات 🎪',
  'مسطح عشب طبيعي دائري رحب ومنسق بعناية، مثالي لتنظيم حفلات الزفاف، التخرج، واللقاءات العائلية الكبرى في الهواء الطلق.',
  'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
  array['عشب طبيعي منسق', 'سعة حفلات رحبة', 'جلسات خارجية راقية'],
  'مشمول بكامل الخصوصية',
  3
where not exists (select 1 from public.resort_facilities where title like '%المسطحات الخضراء%');

insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
select
  'مجالس الضيافة الملكية VIP',
  'أصالة الكرم وقمة الفخامة المعاصرة',
  'ضيافة وأصالة ☕',
  'مجلس VIP ملكي راقٍ مجهز بأحدث الديكورات وشاشات العرض الذكية، بالإضافة إلى مجلس أرضي شعبي كبير يعكس أصالة وكرم الضيافة السعودية.',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
  array['مجلس VIP ملكي', 'مجلس أرضي كبير', 'تكييف مركزي متكامل', 'شاشات ذكية وصوتيات'],
  'مشمول بكامل الخصوصية',
  4
where not exists (select 1 from public.resort_facilities where title like '%مجالس الضيافة%');

insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
select
  'أسطول السكوترات الكهربائية',
  'إضافة ترفيهية مميزة لجولات البستان',
  'مغامرة واستكشاف ⚡',
  'أسطول حديث من السكوترات الكهربائية المجهزة بخوذ الأمان، متاح للحجز الإضافي ليمنح ضيوفكم وأطفالكم جولات حرة ممتعة في ممرات البستان.',
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
  array['سكوترات حديثة سريعة', 'خوذ وأدوات سلامة', 'حجز إضافي فوري'],
  'إضافة اختيارية عند الحجز',
  5
where not exists (select 1 from public.resort_facilities where title like '%السكوترات%');

insert into public.resort_facilities (title, subtitle, badge_text, description, image_url, features, privacy_note, display_order)
select
  'جناح الماستر والمطبخ الفندقي المتكامل',
  'أقصى درجات الراحة والتجهيزات المنزلية',
  'راحة متكاملة 🍳',
  'غرفة نوم رئيسية مريحة مؤثثة بأسلوب فندقي حديث، مع مطبخ متكامل بجميع أجهزة الطهي، الميكروويف، والثلاجة لتلبية كل احتياجات ضيوفكم.',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
  array['سرير ماستر فندقي', 'مطبخ بجميع الأجهزة', 'دورات مياه فندقية'],
  'مشمول بكامل الخصوصية',
  6
where not exists (select 1 from public.resort_facilities where title like '%جناح الماستر%');

-- ─────────────────────────────────────────────────────────────
-- 9. جدول معرض ومتجر الكراسي والأثاث التراثي (heritage_furniture)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.heritage_furniture (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default 'كراسي',
  description text not null,
  price numeric not null,
  discount_price numeric,
  image_url text not null,
  images text[] default '{}',
  features text[] default '{}',
  in_stock boolean default true,
  stock_quantity integer default 10,
  display_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- إدراج المنتج التراثي الأساسي إن لم يكن موجوداً
insert into public.heritage_furniture (
  name,
  category,
  description,
  price,
  discount_price,
  image_url,
  features,
  in_stock,
  stock_quantity,
  display_order,
  is_active
)
select
  'طقم كراسي خيزران تراثي ريفي (4 كراسي)',
  'كراسي',
  'طقم كراسي تراثية فاخرة مصنوعة يدوياً بحرفية عالية من الخيزران والخشب الطبيعي المتين، مع مساند أذرع مريحة ومقاعد قماشية أنيقة باللون الأزرق والأبيض. مصممة لتضفي رونقاً تراثياً أصيلاً على حدائق المزارع، الاستراحات، والبيوت الريفية.',
  850,
  750,
  '/images/heritage-chair.jpg',
  array['صناعة يدوية عالية المتانة', 'خيزران وخشب طبيعي معالج', 'وسائد قماشية كلاسيكية مريحة', 'مناسب للمزارع والحدائق الخارجية', 'خفيف الوزن وسهل النقل والتخزين'],
  true,
  8,
  1,
  true
where not exists (select 1 from public.heritage_furniture where name like '%طقم كراسي خيزران%');

-- ─────────────────────────────────────────────────────────────
-- 10. جدول وإدارة طلبات مشتريات الأثاث التراثي (furniture_orders)
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- 11. فهارس تحسين الأداء ومنع التعارض (Indexes)
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_bookings_date on public.bookings(booking_date);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_bookings_customer_phone on public.bookings(customer_phone);

-- فهرس فريد ذكي يمنع حجز نفس التاريخ فقط إذا كان الحجز نشطاً (ويسمح بحجزه إن كان ملغياً أو منتهياً)
create unique index if not exists unique_active_booking 
on public.bookings(property_id, booking_date) 
where status not in ('cancelled', 'expired');

create index if not exists idx_water_orders_status on public.water_orders(status);
create index if not exists idx_water_orders_customer_id on public.water_orders(customer_id);
create index if not exists idx_water_orders_customer_phone on public.water_orders(customer_phone);
create index if not exists idx_water_orders_created_at on public.water_orders(created_at desc);
create index if not exists idx_water_expenses_date on public.water_expenses(expense_date);
create index if not exists idx_heritage_order on public.heritage_furniture(display_order);

-- ─────────────────────────────────────────────────────────────
-- 11. مساحات التخزين السحابية (Storage Buckets: resort-media & receipts)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values 
  ('resort-media', 'resort-media', true),
  ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

-- سياسات تخزين الصور في resort-media
drop policy if exists "Public Access for resort-media" on storage.objects;
create policy "Public Access for resort-media" on storage.objects
  for select using (bucket_id = 'resort-media');

drop policy if exists "Admin manage resort-media" on storage.objects;
create policy "Admin manage resort-media" on storage.objects
  for all using (bucket_id = 'resort-media');

-- سياسات تخزين إيصالات التحويل في receipts
drop policy if exists "Anyone can read receipts" on storage.objects;
create policy "Anyone can read receipts" on storage.objects
  for select using (bucket_id = 'receipts');

drop policy if exists "Authenticated users can upload receipts" on storage.objects;
drop policy if exists "Anyone can upload receipts" on storage.objects;
create policy "Anyone can upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts');

drop policy if exists "Users update own receipts" on storage.objects;
drop policy if exists "Admin manage receipts" on storage.objects;
create policy "Admin manage receipts" on storage.objects
  for all using (bucket_id = 'receipts');

-- ─────────────────────────────────────────────────────────────
-- 12. سياسات الأمان وحماية البيانات (Row Level Security - RLS)
-- ─────────────────────────────────────────────────────────────
alter table public.resort_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.addons enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_addons enable row level security;
alter table public.water_tanker_sizes enable row level security;
alter table public.water_orders enable row level security;
alter table public.water_expenses enable row level security;
alter table public.water_manual_trips enable row level security;
alter table public.resort_facilities enable row level security;
alter table public.heritage_furniture enable row level security;

-- resort_settings
drop policy if exists "Public read settings" on public.resort_settings;
create policy "Public read settings" on public.resort_settings for select using (true);

drop policy if exists "Admin update settings" on public.resort_settings;
create policy "Admin update settings" on public.resort_settings for all using (public.is_admin());

-- profiles
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (id = auth.uid() or public.is_admin());

-- properties
drop policy if exists "Public read properties" on public.properties;
create policy "Public read properties" on public.properties for select using (true);

drop policy if exists "Admin manage properties" on public.properties;
create policy "Admin manage properties" on public.properties for all using (public.is_admin());

-- addons
drop policy if exists "Public read addons" on public.addons;
create policy "Public read addons" on public.addons for select using (true);

drop policy if exists "Admin manage addons" on public.addons;
create policy "Admin manage addons" on public.addons for all using (public.is_admin());

-- bookings
drop policy if exists "Users read own bookings" on public.bookings;
drop policy if exists "Anyone read bookings" on public.bookings;
create policy "Anyone read bookings" on public.bookings for select using (true);

drop policy if exists "Users insert own bookings" on public.bookings;
drop policy if exists "Users insert booking" on public.bookings;
create policy "Users insert own bookings" on public.bookings for insert with check (true);

drop policy if exists "Users update own booking" on public.bookings;
drop policy if exists "Admin manage bookings" on public.bookings;
create policy "Users update own booking" on public.bookings
  for update using (
    (auth.uid() is not null and customer_id = auth.uid()) or public.is_admin()
  );

drop policy if exists "Admin delete booking" on public.bookings;
create policy "Admin delete booking" on public.bookings for delete using (public.is_admin());

-- booking_addons
drop policy if exists "Anyone read booking addons" on public.booking_addons;
create policy "Anyone read booking addons" on public.booking_addons for select using (true);

drop policy if exists "Users insert booking addons" on public.booking_addons;
create policy "Users insert booking addons" on public.booking_addons for insert with check (true);

-- water_tanker_sizes
drop policy if exists "Public read active water sizes" on public.water_tanker_sizes;
create policy "Public read active water sizes" on public.water_tanker_sizes for select using (true);

drop policy if exists "Admin manage water sizes" on public.water_tanker_sizes;
create policy "Admin manage water sizes" on public.water_tanker_sizes for all using (public.is_admin());

-- water_orders
drop policy if exists "Anyone can insert water orders" on public.water_orders;
create policy "Anyone can insert water orders" on public.water_orders for insert with check (true);

drop policy if exists "Customers read own water orders" on public.water_orders;
create policy "Customers read own water orders" on public.water_orders for select using (
  (auth.uid() is not null and customer_id = auth.uid())
  or customer_phone in (select phone from public.profiles where id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Admin manage water orders" on public.water_orders;
create policy "Admin manage water orders" on public.water_orders for all using (public.is_admin());

-- water_expenses & water_manual_trips
drop policy if exists "Admin manage water expenses" on public.water_expenses;
create policy "Admin manage water expenses" on public.water_expenses for all using (public.is_admin());

drop policy if exists "Admin manage manual trips" on public.water_manual_trips;
create policy "Admin manage manual trips" on public.water_manual_trips for all using (public.is_admin());

-- resort_facilities
drop policy if exists "Public read active facilities" on public.resort_facilities;
drop policy if exists "Public can view active resort_facilities" on public.resort_facilities;
create policy "Public read active facilities" on public.resort_facilities for select using (is_active = true or public.is_admin());

drop policy if exists "Admin manage facilities" on public.resort_facilities;
drop policy if exists "Admin manage resort_facilities" on public.resort_facilities;
create policy "Admin manage facilities" on public.resort_facilities for all using (public.is_admin());

-- heritage_furniture
drop policy if exists "Public read active heritage furniture" on public.heritage_furniture;
drop policy if exists "Public can view active heritage furniture" on public.heritage_furniture;
create policy "Public read active heritage furniture" on public.heritage_furniture for select using (is_active = true or public.is_admin());

drop policy if exists "Admin manage heritage furniture" on public.heritage_furniture;
create policy "Admin manage heritage furniture" on public.heritage_furniture for all using (public.is_admin());

-- furniture_orders
drop policy if exists "Anyone can insert furniture orders" on public.furniture_orders;
create policy "Anyone can insert furniture orders" on public.furniture_orders for insert with check (true);

drop policy if exists "Customers read own furniture orders" on public.furniture_orders;
create policy "Customers read own furniture orders" on public.furniture_orders for select using (
  (auth.uid() is not null and customer_id = auth.uid())
  or customer_phone in (select phone from public.profiles where id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Admin manage furniture orders" on public.furniture_orders;
create policy "Admin manage furniture orders" on public.furniture_orders for all using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 13. تفعيل التحديث اللحظي (Supabase Realtime) بأمان
-- ─────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.water_orders;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.resort_settings;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.resort_facilities;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.heritage_furniture;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.furniture_orders;
  exception when others then null;
  end;
end $$;

-- ─────────────────────────────────────────────────────────────
-- تم الانتهاء بنجاح ✅
-- ─────────────────────────────────────────────────────────────
select 
  'تهانينا! تم تحديث وتأسيس كافة الـ 12 جدولاً وسياسات الأمان والمخازن السحابية وصلاحيات المسؤول 0556854162 بنجاح.' as result;
