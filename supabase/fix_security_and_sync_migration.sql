-- ==============================================================================
-- ترقية وإصلاح شامل لمنظومة الأمان والربط بين المستخدم ولوحة الإدارة
-- Fix Security, RLS Policies, Bookings Calendar Sync & Customer Permissions
-- متوافق وآمن للتنفيذ المتكرر (Idempotent) — قم بتشغيله في Supabase SQL Editor
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. إصلاح سياسات الحجوزات (Bookings) لمزامنة التقويم ورفع الإيصال والإلغاء
-- ─────────────────────────────────────────────────────────────

-- السماح للجميع بقراءة تواريخ الحجوزات لكي يظهر التقويم بشكل دقيق للمستخدمين والزوار
drop policy if exists "Users read own bookings" on public.bookings;
drop policy if exists "Anyone read bookings" on public.bookings;
create policy "Anyone read bookings" on public.bookings
  for select using (true);

-- السماح للمستخدمين والزوار بإنشاء الحجز
drop policy if exists "Users insert own bookings" on public.bookings;
drop policy if exists "Users insert booking" on public.bookings;
create policy "Users insert own bookings" on public.bookings
  for insert with check (true);

-- السماح للعميل بتحديث حجزه الخاص (رفع الإيصال أو الإلغاء) وللأدمن بالتحكم الكامل
drop policy if exists "Users update own booking" on public.bookings;
drop policy if exists "Admin manage bookings" on public.bookings;
create policy "Users update own booking" on public.bookings
  for update using (
    (auth.uid() is not null and customer_id = auth.uid()) or public.is_admin()
  );

-- حذف الحجوزات للأدمن فقط
drop policy if exists "Admin delete booking" on public.bookings;
create policy "Admin delete booking" on public.bookings
  for delete using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 2. تصحيح دالة الإلغاء التلقائي لحماية حجوزات "الدفع عند الوصول"
-- ─────────────────────────────────────────────────────────────
create or replace function public.expire_pending_bookings()
returns void as $$
begin
  -- يتم إنهاء الحجز تلقائياً فقط إذا كان تحويلاً بنكياً وتأخر العميل عن رفع الإيصال لأكثر من ساعتين
  -- مع استبعاد حجوزات الدفع عند الوصول (cash_on_arrival) حتى لا تُلغى بالخطأ
  update public.bookings
  set status = 'expired'
  where status = 'pending_receipt'
    and coalesce(payment_method, 'bank_transfer') = 'bank_transfer'
    and created_at <= (now() - interval '2 hours');
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 3. حماية جدول المستخدمين (Profiles) وسد ثغرة ترقية الصلاحيات
-- ─────────────────────────────────────────────────────────────

-- دالة حماية تمنع العميل العادي من تغيير حقل role أو رفع الحظر عن نفسه
create or replace function public.protect_profile_fields()
returns trigger as $$
begin
  -- إذا كان المستدعي ليس أدمن، امنع تعديل الصلاحيات أو حالات الحظر
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

-- تحديث سياسات جدول profiles
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. ربط طلبات وايت الماء الحلو (Water Orders) بملف العميل وسجل الطلبات
-- ─────────────────────────────────────────────────────────────
alter table public.water_orders enable row level security;

drop policy if exists "Anyone can insert water orders" on public.water_orders;
create policy "Anyone can insert water orders" on public.water_orders
  for insert with check (true);

drop policy if exists "Customers read own water orders" on public.water_orders;
create policy "Customers read own water orders" on public.water_orders
  for select using (
    (auth.uid() is not null and customer_id = auth.uid())
    or customer_phone in (select phone from public.profiles where id = auth.uid())
    or public.is_admin()
  );

drop policy if exists "Admin manage water orders" on public.water_orders;
create policy "Admin manage water orders" on public.water_orders
  for all using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 5. ضبط مخزن الإيصالات السحابي (Storage Buckets: receipts)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read receipts" on storage.objects;
create policy "Anyone can read receipts" on storage.objects
  for select using (bucket_id = 'receipts');

drop policy if exists "Authenticated users can upload receipts" on storage.objects;
drop policy if exists "Anyone can upload receipts" on storage.objects;
create policy "Anyone can upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts');

drop policy if exists "Users update own receipts" on storage.objects;
create policy "Users update own receipts" on storage.objects
  for update using (bucket_id = 'receipts');

-- التأكد من تفعيل التحديث اللحظي (Realtime) لجدولي bookings و water_orders بشكل آمن
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
end $$;

-- ─────────────────────────────────────────────────────────────
-- 6. تحسين قيد الحجز الفريد وفهارس الأداء (Partial Index & Performance)
-- ─────────────────────────────────────────────────────────────

-- إزالة القيد الفريد المطلق الذي يمنع إعادة حجز الأيام الملغية أو المنتهية
alter table public.bookings drop constraint if exists unique_property_date;

-- إنشاء فهرس فريد مشروط يسمح بإعادة حجز التواريخ طالما أن الحجز السابق ملغي أو منتهي
create unique index if not exists unique_active_booking 
on public.bookings(property_id, booking_date) 
where status not in ('cancelled', 'expired');

-- فهارس تحسين سرعة البحث والاستعلامات
create index if not exists idx_bookings_customer_id on public.bookings(customer_id);
create index if not exists idx_bookings_customer_phone on public.bookings(customer_phone);
create index if not exists idx_water_orders_customer_id on public.water_orders(customer_id);
create index if not exists idx_water_orders_customer_phone on public.water_orders(customer_phone);
create index if not exists idx_water_orders_created_at on public.water_orders(created_at desc);

select 'تم تطبيق إصلاحات الأمان ومزامنة التقويم والربط بين المستخدم والإدارة بنجاح ✅' as status;

