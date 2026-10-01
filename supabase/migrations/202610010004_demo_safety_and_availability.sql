create or replace function public.get_unit_availability(p_unit_id uuid, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to > p_from + 89 then
    raise exception 'Date window must contain between 1 and 90 calendar days';
  end if;
  if not exists (select 1 from public.units u where u.id = p_unit_id and u.published)
     and not (select public.is_owner()) then
    raise exception 'Unit not found';
  end if;

  return query
    select b.starts_at, b.ends_at, 'booked'::text
    from public.bookings b
    where b.unit_id = p_unit_id
      and (b.status in ('confirmed', 'checked_in') or (b.status = 'pending'
        and (b.hold_expires_at > now() or b.payment_status = 'processing')))
      and b.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Riyadh')
      and b.ends_at > (p_from::timestamp at time zone 'Asia/Riyadh')
    union all
    select a.starts_at, a.ends_at, 'closed'::text
    from public.availability_blocks a
    where a.unit_id = p_unit_id
      and a.starts_at < ((p_to + 1)::timestamp at time zone 'Asia/Riyadh')
      and a.ends_at > (p_from::timestamp at time zone 'Asia/Riyadh');
end;
$$;

create or replace function private.guard_demo_mode_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.demo_mode and not new.demo_mode then
    if exists (
      select 1 from public.units
      where id in (
        '11111111-1111-4111-8111-111111111101'::uuid,
        '11111111-1111-4111-8111-111111111102'::uuid
      )
    ) or exists (
      select 1 from public.packages
      where id in (
        '22222222-2222-4222-8222-222222222201'::uuid,
        '22222222-2222-4222-8222-222222222202'::uuid
      )
    ) or exists (
      select 1 from public.add_ons where id = '33333333-3333-4333-8333-333333333301'::uuid
    ) or exists (
      select 1 from public.coupons where code = 'PREVIEW10'
    ) or exists (
      select 1 from public.faq_entries where question in (
        'هل هذه البيانات والأسعار حقيقية؟',
        'هل يمكنني إتمام الحجز أو الدفع؟',
        'كيف أستخدم الموقع بعد الإطلاق؟'
      )
    ) then
      raise exception 'Remove preview seed records before disabling demo mode';
    end if;

    if not exists (select 1 from public.units where published)
       or not exists (
         select 1 from public.packages p
         join public.package_units pu on pu.package_id = p.id
         join public.units u on u.id = pu.unit_id
         where p.active and u.published
       ) then
      raise exception 'Publish at least one real unit and an active package before disabling demo mode';
    end if;

    if (nullif(trim(new.phone), '') is null and nullif(trim(new.whatsapp), '') is null and nullif(trim(new.email), '') is null)
       or nullif(trim(new.address), '') is null
       or nullif(trim(new.terms), '') is null
       or nullif(trim(new.privacy_policy), '') is null
       or nullif(trim(new.cancellation_policy), '') is null
       or nullif(trim(new.refund_policy), '') is null then
      raise exception 'Add approved contact details, terms, privacy, cancellation and refund policies before disabling demo mode';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_demo_mode_transition on public.resort_settings;
create trigger guard_demo_mode_transition
  before update of demo_mode on public.resort_settings
  for each row execute function private.guard_demo_mode_transition();

notify pgrst, 'reload schema';
