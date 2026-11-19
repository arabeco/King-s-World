begin;

-- Keep retired memberships, receipts and XP history under their original IDs.
alter table public.world_players add column if not exists cozy_released boolean not null default false;

create unique index if not exists world_players_current_reign_key
  on public.world_players(world_id,user_id) where not cozy_released;
create unique index if not exists kw_cozy_player_states_current_reign_key
  on public.kw_cozy_player_states(world_id,user_id) where not (state_json ? 'ascension');
alter table public.world_players drop constraint if exists world_players_world_id_user_id_key;
alter table public.kw_cozy_player_states drop constraint if exists kw_cozy_player_states_world_id_user_id_key;

create or replace function public.kw_cozy_release_archived_membership() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.world_players p set cozy_released=true,status='archived',is_alive_cached=false
  where p.id=new.world_player_id and p.user_id=new.user_id and p.world_id=new.world_id
    and not p.is_ai and not p.cozy_released and p.status='alive';
  if not found then raise exception 'COZY_ASCENSION_UNAVAILABLE'; end if;
  return new;
end;
$$;
drop trigger if exists kw_cozy_release_archived_membership on public.kw_cozy_ascension_archives;
create trigger kw_cozy_release_archived_membership after insert on public.kw_cozy_ascension_archives
  for each row execute function public.kw_cozy_release_archived_membership();
revoke all on function public.kw_cozy_release_archived_membership() from public,anon,authenticated,service_role;

-- Install after 79, including any verified archives already created by that version.
update public.world_players p set cozy_released=true,status='archived',is_alive_cached=false
where not p.cozy_released and not p.is_ai and p.status='alive' and exists (
  select 1 from public.kw_cozy_ascension_archives a
  join public.kw_cozy_player_states s on s.world_player_id=a.world_player_id and s.state_json ? 'ascension'
  where a.world_player_id=p.id and a.world_id=p.world_id and a.user_id=p.user_id
);

create or replace function public.kw_premium_benefits(p_user_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  with access as (select public.kw_premium_active(p_user_id) active), memberships as (
    select count(*)::integer n from public.world_players p join public.worlds w on w.id=p.world_id
    where p.user_id=p_user_id and not p.is_ai and not p.cozy_released and w.rules_version=2 and w.status in ('open','running')
  ) select jsonb_build_object('active',active,'worldLimit',case when active then 5 else 1 end,'activeWorlds',n,
    'canCreate',n<case when active then 5 else 1 end,'canPasswordWorld',active,'adFree',active) from access,memberships;
$$;

create or replace function public.kw_cozy_membership_limit() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare active_count integer; world_limit integer;
begin
  if new.is_ai or new.cozy_released or not exists(select 1 from public.worlds where id=new.world_id and rules_version=2 and status in ('open','running')) then
    return new;
  end if;
  if tg_op='UPDATE' and old.user_id=new.user_id and old.world_id=new.world_id and not old.is_ai and not old.cozy_released then
    return new;
  end if;
  perform 1 from public.users where id=new.user_id for update;
  world_limit:=case when public.kw_premium_active(new.user_id) then 5 else 1 end;
  select count(*) into active_count from public.world_players p join public.worlds w on w.id=p.world_id
    where p.user_id=new.user_id and p.world_id<>new.world_id and not p.is_ai and not p.cozy_released
      and w.rules_version=2 and w.status in ('open','running');
  if active_count>=world_limit then raise exception 'COZY_ACTIVE_WORLD_LIMIT';end if;
  return new;
end;
$$;

create or replace function public.kw_cozy_join(
  p_world_id uuid, p_user_id uuid, p_join_code text default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  w public.worlds%rowtype;
  player_id uuid;
  prior_high integer;
begin
  select * into w from public.worlds where id=p_world_id for update;
  if not found or w.rules_version<>2 then raise exception 'COZY_WORLD_NOT_FOUND'; end if;
  if not w.persistent_cozy then return public.kw_cozy_join_before_persistent(p_world_id,p_user_id,p_join_code); end if;

  select id into player_id from public.world_players where world_id=w.id and user_id=p_user_id and not cozy_released;
  if found then return player_id; end if;
  if w.join_code is null or upper(trim(p_join_code)) is distinct from upper(w.join_code::text) then
    raise exception 'COZY_INVITE_REQUIRED';
  end if;
  if (select count(*) from public.world_players where world_id=w.id and not cozy_released)>=w.player_cap then
    raise exception 'COZY_WORLD_FULL';
  end if;
  if not exists(select 1 from public.users u where id=p_user_id
    and coalesce(to_jsonb(u)->>'account_status','active')='active'
    and to_jsonb(u)->>'deletion_requested_at' is null) then
    raise exception 'COZY_ACCOUNT_UNAVAILABLE';
  end if;

  select max(x.highest_influence) into prior_high from public.world_players p
    join public.kw_king_xp_progress x on x.world_player_id=p.id
    where p.user_id=p_user_id and p.world_id=w.id and p.cozy_released;
  insert into public.world_players(world_id,user_id,status,is_alive_cached)
    values(w.id,p_user_id,'alive',true) returning id into player_id;
  if prior_high is not null then
    insert into public.kw_king_xp_progress(world_player_id,highest_influence) values(player_id,prior_high);
  end if;
  -- Invalidate a world commit prepared against the prior roster.
  update public.kw_cozy_world_states set revision=revision+1,updated_at=now() where world_id=w.id;
  return player_id;
end;
$$;
revoke all on function public.kw_cozy_join(uuid,uuid,text), public.kw_premium_benefits(uuid),
  public.kw_cozy_membership_limit() from public,anon,authenticated;
grant execute on function public.kw_cozy_join(uuid,uuid,text), public.kw_premium_benefits(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
