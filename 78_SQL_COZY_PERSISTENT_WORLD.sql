begin;

alter table public.worlds
  add column if not exists persistent_cozy boolean not null default false;
alter table public.worlds alter column ends_at drop not null;
alter table public.worlds drop constraint if exists worlds_cozy_duration_check;
alter table public.worlds add constraint worlds_cozy_duration_check check (
  (not persistent_cozy and ends_at is not null) or
  (persistent_cozy and founding_onboarding and rules_version = 2
    and economy_version = 3 and influence_version = 2 and combat_mode = 'cozy'
    and status <> 'finalized' and ends_at is null and joins_closed_at is null)
);

create or replace function public.kw_cozy_persistent_calendar() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if old.persistent_cozy and not new.persistent_cozy then
      raise exception 'COZY_PERSISTENT_MODE_LOCKED';
    end if;
    if new.persistent_cozy and not old.persistent_cozy and (
      old.status <> 'open' or exists(select 1 from public.kw_cozy_world_states where world_id = old.id)
    ) then raise exception 'COZY_PERSISTENT_MODE_LOCKED'; end if;
  end if;
  if new.persistent_cozy then
    if new.status = 'finalized' then raise exception 'COZY_PERSISTENT_WORLD'; end if;
    new.ends_at := null;
    new.joins_closed_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists kw_cozy_persistent_calendar on public.worlds;
create trigger kw_cozy_persistent_calendar before insert or update on public.worlds
  for each row execute function public.kw_cozy_persistent_calendar();

create or replace function public.kw_cozy_create_persistent(
  p_user_id uuid, p_name text, p_mode text, p_password_hash text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  created jsonb;
  world_id uuid;
begin
  created := public.kw_cozy_create_founding(p_user_id, p_name, p_mode, p_password_hash);
  world_id := (created->>'id')::uuid;
  update public.worlds set persistent_cozy = true where id = world_id;
  perform public.kw_cozy_start(world_id, p_user_id);
  return created;
end;
$$;

do $$
begin
  if to_regprocedure('public.kw_cozy_join_before_persistent(uuid,uuid,text)') is null then
    alter function public.kw_cozy_join(uuid,uuid,text) rename to kw_cozy_join_before_persistent;
  end if;
end;
$$;

create or replace function public.kw_cozy_join(
  p_world_id uuid, p_user_id uuid, p_join_code text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  w public.worlds%rowtype;
  player_id uuid;
begin
  select * into w from public.worlds where id = p_world_id for update;
  if not found or w.rules_version <> 2 then raise exception 'COZY_WORLD_NOT_FOUND'; end if;
  if not w.persistent_cozy then
    return public.kw_cozy_join_before_persistent(p_world_id, p_user_id, p_join_code);
  end if;
  select id into player_id from public.world_players where world_id = w.id and user_id = p_user_id;
  if found then return player_id; end if;
  if w.join_code is null or upper(trim(p_join_code)) is distinct from upper(w.join_code::text) then
    raise exception 'COZY_INVITE_REQUIRED';
  end if;
  if (select count(*) from public.world_players where world_id = w.id) >= w.player_cap then
    raise exception 'COZY_WORLD_FULL';
  end if;
  if not exists(select 1 from public.users u where id = p_user_id
    and coalesce(to_jsonb(u)->>'account_status', 'active') = 'active'
    and to_jsonb(u)->>'deletion_requested_at' is null) then
    raise exception 'COZY_ACCOUNT_UNAVAILABLE';
  end if;
  insert into public.world_players (world_id, user_id, status, is_alive_cached)
    values (w.id, p_user_id, 'alive', true) returning id into player_id;
  return player_id;
end;
$$;

revoke all on function public.kw_cozy_persistent_calendar(), public.kw_cozy_create_persistent(uuid,text,text,text),
  public.kw_cozy_join(uuid,uuid,text), public.kw_cozy_join_before_persistent(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.kw_cozy_create_persistent(uuid,text,text,text), public.kw_cozy_join(uuid,uuid,text) to service_role;
revoke execute on function public.kw_cozy_join_before_persistent(uuid,uuid,text) from service_role;
notify pgrst, 'reload schema';
commit;
