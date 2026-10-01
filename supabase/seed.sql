-- Preview-only content. Keep demo_mode enabled until every value is replaced with approved resort data.
update public.resort_settings set
  name = 'منتجع و استراحة خالد العمدة',
  tagline = 'نموذج عرض لتجربة منتجع سعودي',
  about = 'هذه بيانات تجريبية لعرض شكل الموقع وتدفق الحجز. الموقع والأسعار والمرافق ليست معلومات تشغيلية معتمدة.',
  address = 'موقع تجريبي · أضف العنوان الفعلي قبل الإطلاق',
  phone = '',
  whatsapp = '',
  email = '',
  latitude = null,
  longitude = null,
  map_url = '',
  cancellation_hours = 24,
  cancellation_policy = 'سياسة تجريبية فقط. استبدلها بالنص المعتمد قبل استقبال الحجوزات.',
  refund_policy = 'سياسة استرداد تجريبية فقط. استبدلها بالنص المعتمد قبل استقبال الحجوزات.',
  late_policy = 'تعليمات تجريبية فقط. أضف تعليمات الوصول الفعلية قبل الإطلاق.',
  terms = 'الشروط والأحكام التجريبية للمعاينة فقط؛ لا تنشئ هذه النسخة حجوزات حقيقية.',
  privacy_policy = 'هذه نسخة تجريبية. لا ترسل معلومات شخصية أو تشغيلية من نموذج العرض.',
  arrival_instructions = 'بيانات الوصول الفعلية غير مضافة بعد.',
  cash_enabled = true,
  bank_transfer_enabled = false,
  bank_name = '',
  bank_beneficiary = '',
  bank_iban = '',
  bank_transfer_hold_hours = 24,
  online_payments_enabled = false,
  demo_mode = true,
  updated_at = now()
where id;

insert into public.units (
  id, slug, name, short_description, description, max_guests, area_sqm,
  bedrooms, bathrooms, has_pool, base_price, published, sort_order
) values
  ('11111111-1111-4111-8111-111111111101', 'wadi-pool-villa', 'فيلا الوادي · نموذج',
   'مساحة تجريبية لعرض تفاصيل الوحدة والمرافق.',
   'وصف توضيحي فقط. هذه الوحدة والسعر والموقع أمثلة للمعاينة وليست عرضًا حقيقيًا للحجز.',
   8, 180, 3, 2, true, 350, true, 1),
  ('11111111-1111-4111-8111-111111111102', 'wadi-garden-suite', 'جناح الحديقة · نموذج',
   'خيار تجريبي أصغر ضمن بيانات العرض.',
   'وصف توضيحي فقط. هذه الوحدة والسعر والموقع أمثلة للمعاينة وليست عرضًا حقيقيًا للحجز.',
   4, 95, 1, 1, false, 220, true, 2)
on conflict (id) do nothing;

insert into public.amenities (name, icon, sort_order) values
  ('مسبح خاص', 'waves', 1),
  ('جلسة خارجية', 'sun', 2),
  ('مطبخ تجهيز', 'utensils', 3),
  ('مواقف خاصة', 'car', 4)
on conflict (name) do nothing;

insert into public.unit_amenities (unit_id, amenity_id)
select u.id, a.id from public.units u cross join public.amenities a
where u.id = '11111111-1111-4111-8111-111111111101'
  and a.name in ('مسبح خاص', 'جلسة خارجية', 'مطبخ تجهيز', 'مواقف خاصة')
on conflict do nothing;

insert into public.unit_amenities (unit_id, amenity_id)
select u.id, a.id from public.units u cross join public.amenities a
where u.id = '11111111-1111-4111-8111-111111111102'
  and a.name in ('جلسة خارجية', 'مطبخ تجهيز', 'مواقف خاصة')
on conflict do nothing;

insert into public.packages (
  id, name, description, duration_minutes, start_window_start, start_window_end,
  price, active, sort_order
) values
  ('22222222-2222-4222-8222-222222222201', 'إقامة نهارية · نموذج',
   'باقة وأسعار افتراضية لشرح شكل الاختيار.', 360, '10:00', '17:00', 450, true, 1),
  ('22222222-2222-4222-8222-222222222202', 'إقامة مسائية · نموذج',
   'باقة وأسعار افتراضية لشرح شكل الاختيار.', 480, '14:00', '18:00', 600, true, 2)
on conflict (id) do nothing;

insert into public.package_units (package_id, unit_id)
select p.id, u.id from public.packages p cross join public.units u
where p.id in ('22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222202')
  and u.id in ('11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111102')
on conflict do nothing;

insert into public.package_features (package_id, feature, sort_order)
select p.id, f.feature, f.sort_order from public.packages p
cross join (values ('وصف تجريبي للمدة والسعر', 1), ('لا يمثل توفرًا حقيقيًا', 2)) as f(feature, sort_order)
where p.id in ('22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222202')
  and not exists (select 1 from public.package_features existing where existing.package_id = p.id and existing.feature = f.feature);

insert into public.add_ons (id, name, description, price, active, required, sort_order)
values ('33333333-3333-4333-8333-333333333301', 'ضيافة ترحيبية · نموذج', 'خيار توضيحي فقط.', 75, true, false, 1)
on conflict (id) do nothing;

insert into public.unit_add_ons (unit_id, add_on_id)
select u.id, a.id from public.units u cross join public.add_ons a
where u.id in ('11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111102')
  and a.id = '33333333-3333-4333-8333-333333333301'
on conflict do nothing;

insert into public.package_add_ons (package_id, add_on_id)
select p.id, a.id from public.packages p cross join public.add_ons a
where p.id in ('22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222202')
  and a.id = '33333333-3333-4333-8333-333333333301'
on conflict do nothing;

insert into public.coupons (code, discount_type, discount_value, minimum_amount, max_uses, active)
values ('PREVIEW10', 'percent', 10, 0, 100, true)
on conflict (code) do nothing;

insert into public.faq_entries (question, answer, published, sort_order)
select f.question, f.answer, true, f.sort_order from (values
  ('هل هذه البيانات والأسعار حقيقية؟', 'لا، هذه بيانات تجريبية للمعاينة فقط وليست عرضًا تشغيليًا.', 1),
  ('هل يمكنني إتمام الحجز أو الدفع؟', 'لا. الحجز والاستفسارات متوقفة في نسخة المعاينة، ولا يوجد دفع إلكتروني.', 2),
  ('كيف أستخدم الموقع بعد الإطلاق؟', 'استبدل الوحدات والأسعار والسياسات ومعلومات التواصل بالبيانات المعتمدة من لوحة المالك.', 3)
) as f(question, answer, sort_order)
where not exists (select 1 from public.faq_entries existing where existing.question = f.question);
