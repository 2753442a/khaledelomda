create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')
  );
  return new;
end;
$$;

create or replace function public.consume_password_recovery(p_phone text, p_pin text, p_ip_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  account_id uuid;
  pin_matches boolean := false;
  phone_attempts integer;
  ip_attempts integer;
begin
  if p_pin !~ '^[0-9]{4}$' or p_ip_hash !~ '^[a-f0-9]{64}$' or normalized_phone = '' then
    return null;
  end if;

  select p.id into account_id from public.profiles p where p.phone = normalized_phone limit 1;

  insert into private.recovery_attempts (subject, attempts)
  values ('phone:' || normalized_phone, 1)
  on conflict (subject) do update set
    attempts = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.attempts + 1
      when private.recovery_attempts.blocked_until is not null then 1
      else private.recovery_attempts.attempts + 1
    end,
    blocked_until = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.blocked_until
      when private.recovery_attempts.blocked_until is not null then null
      when private.recovery_attempts.attempts + 1 >= 6 then now() + interval '15 minutes'
      else null
    end,
    updated_at = now()
  returning attempts into phone_attempts;

  insert into private.recovery_attempts (subject, attempts)
  values ('ip:' || p_ip_hash, 1)
  on conflict (subject) do update set
    attempts = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.attempts + 1
      when private.recovery_attempts.blocked_until is not null then 1
      else private.recovery_attempts.attempts + 1
    end,
    blocked_until = case
      when private.recovery_attempts.blocked_until > now() then private.recovery_attempts.blocked_until
      when private.recovery_attempts.blocked_until is not null then null
      when private.recovery_attempts.attempts + 1 >= 13 then now() + interval '30 minutes'
      else null
    end,
    updated_at = now()
  returning attempts into ip_attempts;

  if phone_attempts > 5 or ip_attempts > 12 or account_id is null then return null; end if;

  select extensions.crypt(p_pin, r.pin_hash) = r.pin_hash into pin_matches
  from private.account_recovery r where r.user_id = account_id;

  if coalesce(pin_matches, false) then
    delete from private.recovery_attempts where subject in ('phone:' || normalized_phone, 'ip:' || p_ip_hash);
    return account_id;
  end if;
  return null;
end;
$$;

notify pgrst, 'reload schema';
