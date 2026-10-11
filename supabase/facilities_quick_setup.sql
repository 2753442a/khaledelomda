-- ==============================================================================
-- إعداد وتأسيس جدول وصلاحيات الأقسام والمرافق السريع (خفيف وآمن 100%)
-- ==============================================================================

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

-- تفعيل حماية RLS
alter table public.resort_facilities enable row level security;

drop policy if exists "Public read active facilities" on public.resort_facilities;
drop policy if exists "Public can view active resort_facilities" on public.resort_facilities;
create policy "Public read active facilities" on public.resort_facilities for select using (is_active = true or public.is_admin());

drop policy if exists "Admin manage facilities" on public.resort_facilities;
drop policy if exists "Admin manage resort_facilities" on public.resort_facilities;
create policy "Admin manage facilities" on public.resort_facilities for all using (public.is_admin());

-- إضافة مرافق وأقسام المنتجع الأساسية إن لم تكن موجودة
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

select 'تم تأسيس وتحديث أقسام ومرافق المنتجع وصلاحيات الإدارة بنجاح ✅' as result;
