-- ==============================================================================
-- قسم وأثاث الكراسي التراثية (Heritage Furniture & Chairs CMS)
-- متوافق مع Supabase SQL Editor وآمن 100% للتنفيذ المتكرر (Idempotent)
-- ==============================================================================

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

-- تفعيل حماية RLS
alter table public.heritage_furniture enable row level security;

-- سياسات القراءة العامة للمنتجات النشطة
drop policy if exists "Public read active heritage furniture" on public.heritage_furniture;
drop policy if exists "Public can view active heritage furniture" on public.heritage_furniture;
create policy "Public read active heritage furniture" on public.heritage_furniture
  for select using (is_active = true or public.is_admin());

-- صلاحيات الإدارة الكاملة للأدمن
drop policy if exists "Admin manage heritage furniture" on public.heritage_furniture;
create policy "Admin manage heritage furniture" on public.heritage_furniture
  for all using (public.is_admin());

-- إضافة المنتج التراثي الأولي إذا لم يكن موجوداً
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

-- تفعيل التحديث اللحظي Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.heritage_furniture;
  exception when others then null;
  end;
end $$;

select 'تم إنشاء جدول وصلاحيات قسم الكراسي والأثاث التراثي بنجاح ✅' as result;
