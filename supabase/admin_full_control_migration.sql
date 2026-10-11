-- ============================================================
-- ترقية لوحة التحكم الكاملة وإدارة الصور والوسائط والمحتوى
-- Full Admin Control, Media Storage & CMS Migration Script
-- Run this in Supabase SQL Editor
-- (Idempotent: Safe to run multiple times without errors)
-- ============================================================

-- 1. Extend resort_settings table with dynamic Hero & Content CMS columns
alter table public.resort_settings
  add column if not exists hero_image_url text default 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=2000&q=80',
  add column if not exists hero_title text default 'منتجع وبستان خالد العمدة',
  add column if not exists hero_subtitle text default 'انغمس في تجربة استثنائية تجمع بين بستان النخيل والمسطحات الخضراء، والمسبح الفيروزي والألعاب المائية، ومجالس الضيافة الملكية في خصوصية تامة تلبي كافة تطلعاتكم.',
  add column if not exists hero_badge text default '🌴💧 واحة الاسترخاء والمناسبات في قلب الطبيعة',
  add column if not exists stats_events text default '+200',
  add column if not exists stats_clients text default '+1000',
  add column if not exists stats_days text default '365',
  add column if not exists location_address text default 'المملكة العربية السعودية • موقع مميز وسهل الوصول',
  add column if not exists water_contact_phone text default '0543034553',
  add column if not exists water_contact_whatsapp text default '0547382222';

-- Ensure single settings row exists and has defaults
insert into public.resort_settings (id)
values (1)
on conflict (id) do nothing;

-- 2. Create Storage Buckets for Uploads if not already present
insert into storage.buckets (id, name, public)
values ('resort-media', 'resort-media', true)
on conflict (id) do update set public = true;

-- Allow public read access on resort-media bucket
drop policy if exists "Public Access for resort-media" on storage.objects;
create policy "Public Access for resort-media" on storage.objects
  for select using (bucket_id = 'resort-media');

-- Allow authenticated and admin upload on resort-media bucket
drop policy if exists "Admin manage resort-media" on storage.objects;
create policy "Admin manage resort-media" on storage.objects
  for all using (bucket_id = 'resort-media');

-- 3. Ensure properties table supports multiple images
alter table public.properties
  add column if not exists images text[] default '{}',
  add column if not exists cover_image text;

-- Update initial property with cover image
update public.properties
set cover_image = 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80'
where cover_image is null;

-- Confirm success
select 'Migration for Admin Full Control completed successfully.' as status;
