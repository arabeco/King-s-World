begin;
-- Depends on 11 (verified Play entitlements) and 65 (lobby settings).
create or replace function public.kw_premium_active(p_user uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_entitlements where user_id=p_user and provider='google_play'
  and product_id='premium_monthly' and status in ('active','grace_period','canceled') and expires_at>now())
$$;
create or replace function public.kw_premium_benefits(p_user_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with access as(select public.kw_premium_active(p_user_id) active), memberships as(
  select count(*)::integer n from public.world_players p join public.worlds w on w.id=p.world_id
  where p.user_id=p_user_id and not p.is_ai and w.rules_version=2 and w.status in ('open','running')
 ) select jsonb_build_object('active',active,'worldLimit',case when active then 5 else 1 end,'activeWorlds',n,
   'canCreate',n<case when active then 5 else 1 end,'canPasswordWorld',active,'adFree',active) from access,memberships
$$;

create or replace function public.kw_cozy_membership_limit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare active_count integer;world_limit integer;
begin
 if new.is_ai or not exists(select 1 from public.worlds where id=new.world_id and rules_version=2 and status in ('open','running')) then return new;end if;
 -- Existing members keep their worlds after expiry; this only gates new entries.
 if tg_op='UPDATE' and old.user_id=new.user_id and old.world_id=new.world_id and not old.is_ai then return new;end if;
 perform 1 from public.users where id=new.user_id for update;
 world_limit:=case when public.kw_premium_active(new.user_id) then 5 else 1 end;
 select count(*) into active_count from public.world_players p join public.worlds w on w.id=p.world_id
  where p.user_id=new.user_id and p.world_id<>new.world_id and not p.is_ai and w.rules_version=2 and w.status in ('open','running');
 if active_count>=world_limit then raise exception 'COZY_ACTIVE_WORLD_LIMIT';end if;
 return new;
end $$;
drop trigger if exists kw_cozy_membership_limit on public.world_players;
create trigger kw_cozy_membership_limit before insert or update of user_id,world_id,is_ai on public.world_players for each row execute function public.kw_cozy_membership_limit();

create or replace function public.kw_cozy_password_premium() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;
begin
 if new.password_hash is null then return new;end if;
 if tg_op='UPDATE' and new.password_hash is not distinct from old.password_hash then return new;end if;
 select created_by_user_id into owner_id from public.worlds where id=new.world_id;
 if owner_id is null or not public.kw_premium_active(owner_id) then raise exception 'COZY_PASSWORD_PREMIUM_REQUIRED';end if;
 return new;
end $$;
drop trigger if exists kw_cozy_password_premium on public.kw_cozy_lobby_settings;
create trigger kw_cozy_password_premium before insert or update of password_hash on public.kw_cozy_lobby_settings for each row execute function public.kw_cozy_password_premium();
revoke all on function public.kw_premium_active(uuid),public.kw_premium_benefits(uuid),public.kw_cozy_membership_limit(),public.kw_cozy_password_premium() from public,anon,authenticated;
grant execute on function public.kw_premium_benefits(uuid) to service_role;
commit;
