-- King's World v2: isolated, authoritative cooperative seasons.
-- Additive migration. No legacy save is converted or deleted.
-- Apply only to the King's World Supabase project, before deploying the v2 web app.
begin;

alter table public.worlds add column if not exists rules_version integer not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'worlds_rules_version_check' and conrelid = 'public.worlds'::regclass) then
    alter table public.worlds add constraint worlds_rules_version_check check (rules_version in (1, 2));
  end if;
end $$;

create table if not exists public.kw_cozy_world_states (
  world_id uuid primary key references public.worlds(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state_json jsonb not null check (jsonb_typeof(state_json) = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.kw_cozy_player_states (
  world_player_id uuid primary key references public.world_players(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state_json jsonb not null check (jsonb_typeof(state_json) = 'object'),
  influence integer not null default 0 check (influence between 0 and 2500),
  updated_at timestamptz not null default now(),
  unique (world_id, user_id)
);
create index if not exists kw_cozy_player_states_world_idx on public.kw_cozy_player_states(world_id);
create table if not exists public.kw_cozy_commands (
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  request_id text not null check (length(request_id) between 8 and 128),
  action_hash text not null check (length(action_hash) = 64),
  created_at timestamptz not null default now(),
  primary key (world_player_id, request_id)
);
create table if not exists public.kw_cozy_rewards (
  world_id uuid not null references public.worlds(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  world_name text not null,
  player_name text not null,
  finished boolean not null default false,
  portal_crossed_at timestamptz,
  final_rank integer check (final_rank > 0),
  final_score integer check (final_score between 0 and 2500),
  xp integer not null default 0 check (xp >= 0),
  trophy boolean not null default false,
  awarded_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
create index if not exists kw_cozy_rewards_user_idx on public.kw_cozy_rewards(user_id);

-- These tables are accessed only by the authenticated Next server's service role.
-- In particular, no client may upload a snapshot or award itself XP.
alter table public.kw_cozy_world_states enable row level security;
alter table public.kw_cozy_player_states enable row level security;
alter table public.kw_cozy_commands enable row level security;
alter table public.kw_cozy_rewards enable row level security;
revoke all on public.kw_cozy_world_states, public.kw_cozy_player_states, public.kw_cozy_commands, public.kw_cozy_rewards from anon, authenticated;
grant select, insert, update, delete on public.kw_cozy_world_states, public.kw_cozy_player_states, public.kw_cozy_commands, public.kw_cozy_rewards to service_role;

-- One world lock orders joins, starts, and gameplay commits. The membership
-- check and capacity check therefore cannot be bypassed by concurrent joins.
create or replace function public.kw_cozy_join(p_world_id uuid, p_user_id uuid, p_join_code text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.worlds%rowtype; player_id uuid;
begin
  select * into w from public.worlds where id = p_world_id for update;
  if not found or w.rules_version <> 2 then raise exception 'COZY_WORLD_NOT_FOUND'; end if;
  select id into player_id from public.world_players where world_id = w.id and user_id = p_user_id;
  if found then return player_id; end if;
  if w.status <> 'open' or w.joins_closed_at is not null then raise exception 'COZY_JOINS_CLOSED'; end if;
  if w.created_by_user_id is distinct from p_user_id and
     (p_join_code is null or upper(trim(p_join_code)) <> upper(w.join_code::text)) then
    raise exception 'COZY_INVITE_REQUIRED';
  end if;
  if (select count(*) from public.world_players where world_id = w.id) >= w.player_cap then raise exception 'COZY_WORLD_FULL'; end if;
  if not exists (select 1 from public.users u where id = p_user_id and coalesce(to_jsonb(u)->>'account_status','active') = 'active' and to_jsonb(u)->>'deletion_requested_at' is null) then raise exception 'COZY_ACCOUNT_UNAVAILABLE'; end if;
  insert into public.world_players(world_id, user_id, status, is_alive_cached)
  values(w.id, p_user_id, 'alive', true) returning id into player_id;
  return player_id;
end $$;

-- World plus creator membership are one transaction: failed onboarding never
-- leaves an orphan campaign in the lobby.
create or replace function public.kw_cozy_create(p_user_id uuid,p_name text,p_mode text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.worlds%rowtype; instant timestamptz := clock_timestamp(); duration integer; speed integer;
begin
  if not exists(select 1 from public.users u where id=p_user_id and coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null) then raise exception 'COZY_ACCOUNT_UNAVAILABLE'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 40 or p_mode is null or p_mode not in ('normal','express') then raise exception 'COZY_INVALID_WORLD'; end if;
  duration := case when p_mode='express' then 30 else 120 end;
  speed := case when p_mode='express' then 4 else 1 end;
  insert into public.worlds(slug,name,status,registration_opens_at,starts_at,phase_2_starts_at,ends_at,
    player_cap,map_width,map_height,base_move_time_minutes,road_move_time_minutes,runtime_started,runtime_real_time_enabled,
    runtime_anchor_day,join_code,created_by_user_id,rules_version,season_mode,speed_multiplier)
  values('reino-'||substr(gen_random_uuid()::text,1,8),trim(p_name),'open',instant,instant+interval '1 day',
    instant+make_interval(days=>1+duration/6),instant+make_interval(days=>1+duration),20,81,81,
    greatest(1,round(45.0/speed)),greatest(1,round(15.0/speed)),false,false,0,
    public.generate_world_join_code(),p_user_id,2,case when p_mode='express' then 'express' else 'classic' end,speed) returning * into w;
  perform public.kw_cozy_join(w.id,p_user_id,null);
  return jsonb_build_object('id',w.id,'slug',w.slug,'join_code',w.join_code);
end $$;
revoke all on function public.kw_cozy_create(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kw_cozy_create(uuid,text,text) to service_role;

create or replace function public.kw_cozy_start(p_world_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare w public.worlds%rowtype; instant timestamptz := clock_timestamp(); days integer;
begin
  select * into w from public.worlds where id = p_world_id for update;
  if not found or w.rules_version <> 2 then raise exception 'COZY_WORLD_NOT_FOUND'; end if;
  if w.created_by_user_id is distinct from p_user_id then raise exception 'COZY_OWNER_REQUIRED'; end if;
  if not exists (select 1 from public.world_players where world_id = w.id and user_id = p_user_id and status = 'alive') then raise exception 'COZY_MEMBERSHIP_REQUIRED'; end if;
  if w.status = 'running' then return; end if; -- retries never restart the clock
  if w.status <> 'open' then raise exception 'COZY_WORLD_CLOSED'; end if;
  days := case when w.season_mode = 'express' then 30 else 120 end;
  update public.worlds set status = 'running', starts_at = instant,
    phase_2_starts_at = instant + make_interval(days => days / 6), ends_at = instant + make_interval(days => days),
    joins_closed_at = instant, manual_start_at = instant, runtime_started = true,
    runtime_real_time_enabled = true, runtime_anchor_day = 1, runtime_anchor_started_at = instant,
    day_number = 1, updated_at = instant where id = w.id;
end $$;

-- Optimistic transaction: both the shared world (claims, finite deposits,
-- support) and every changed player snapshot commit together or not at all.
-- p_players is produced by the server engine, never copied from HTTP input.
create or replace function public.kw_cozy_commit(
  p_world_id uuid, p_user_id uuid, p_actor_player_id uuid,
  p_expected_shared_revision bigint, p_expected_world_status text,
  p_shared jsonb, p_players jsonb, p_request_id text default null,
  p_action_hash text default null, p_finalize boolean default false
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  w public.worlds%rowtype; current_shared bigint; item jsonb; existing_revision bigint;
  player_id uuid; player_user uuid; old_hash text; s jsonb; i integer; rank_value integer;
  at_ms numeric; world_end timestamptz; xp_value integer;
begin
  select * into w from public.worlds where id = p_world_id for update;
  if not found or w.rules_version <> 2 then raise exception 'COZY_WORLD_NOT_FOUND'; end if;
  if not exists (select 1 from public.world_players where id = p_actor_player_id and world_id = p_world_id and user_id = p_user_id) then raise exception 'COZY_MEMBERSHIP_REQUIRED'; end if;
  if p_request_id is not null then
    select action_hash into old_hash from public.kw_cozy_commands where world_player_id = p_actor_player_id and request_id = p_request_id;
    if found then
      if old_hash <> p_action_hash then raise exception 'COZY_REQUEST_REUSED'; end if;
      return jsonb_build_object('status', 'duplicate');
    end if;
    if w.status <> 'running' then raise exception 'COZY_WORLD_CLOSED'; end if;
    if not exists (select 1 from public.world_players where id = p_actor_player_id and status = 'alive') then raise exception 'COZY_PLAYER_INACTIVE'; end if;
  end if;
  if w.status::text <> p_expected_world_status then return jsonb_build_object('status', 'conflict'); end if;
  select revision into current_shared from public.kw_cozy_world_states where world_id = p_world_id;
  current_shared := coalesce(current_shared, -1);
  if current_shared <> p_expected_shared_revision then return jsonb_build_object('status', 'conflict'); end if;
  if jsonb_typeof(p_shared) <> 'object' or p_shared->>'version' <> '2' or jsonb_typeof(p_players) <> 'array' then raise exception 'COZY_INVALID_STATE'; end if;
  if jsonb_array_length(p_players) > 50 then raise exception 'COZY_INVALID_STATE'; end if;
  if (select count(distinct value->>'playerId') from jsonb_array_elements(p_players)) <> jsonb_array_length(p_players) then raise exception 'COZY_INVALID_STATE'; end if;
  for item in select value from jsonb_array_elements(p_players) loop
    player_id := (item->>'playerId')::uuid;
    select user_id into player_user from public.world_players where id = player_id and world_id = p_world_id;
    if not found then raise exception 'COZY_INVALID_PLAYER'; end if;
    select revision into existing_revision from public.kw_cozy_player_states where world_player_id = player_id;
    if coalesce(existing_revision, -1) <> (item->>'expectedRevision')::bigint then return jsonb_build_object('status', 'conflict'); end if;
    s := item->'state';
    if s->>'playerId' is distinct from player_id::text or s->>'version' <> '2' or jsonb_typeof(s) <> 'object' then raise exception 'COZY_INVALID_STATE'; end if;
    if (s->>'settledAt')::numeric > extract(epoch from clock_timestamp()) * 1000 + 5000 then raise exception 'COZY_FUTURE_STATE'; end if;
  end loop;
  -- A finalized season cannot be re-opened by a stale browser/server request.
  if w.status = 'finalized' then return jsonb_build_object('status', 'closed'); end if;
  if p_finalize then
    world_end := coalesce(w.runtime_anchor_started_at, w.starts_at) +
      make_interval(days => case when w.season_mode = 'express' then 30 else 120 end);
    if w.status <> 'running' or clock_timestamp() < world_end then raise exception 'COZY_SEASON_NOT_FINISHED'; end if;
    -- Every previously initialized player must participate in the same final snapshot.
    if exists(select 1 from public.kw_cozy_player_states ps where ps.world_id = p_world_id and not exists(
      select 1 from jsonb_array_elements(p_players) x where x->>'playerId' = ps.world_player_id::text)) then raise exception 'COZY_INCOMPLETE_FINALIZATION'; end if;
  end if;
  insert into public.kw_cozy_world_states(world_id,revision,state_json)
  values(p_world_id,current_shared + 1,p_shared)
  on conflict(world_id) do update set revision = excluded.revision,state_json = excluded.state_json,updated_at = now();
  for item in select value from jsonb_array_elements(p_players) loop
    player_id := (item->>'playerId')::uuid;
    select user_id into player_user from public.world_players where id = player_id;
    s := item->'state';
    insert into public.kw_cozy_player_states(world_player_id,world_id,user_id,revision,state_json,influence)
    values(player_id,p_world_id,player_user,(item->>'expectedRevision')::bigint + 1,s,(item->>'influence')::integer)
    on conflict(world_player_id) do update set revision = excluded.revision,state_json = excluded.state_json,influence = excluded.influence,updated_at = now();
    at_ms := nullif(s->>'portalCrossedAt','')::numeric;
    if at_ms is not null then
      insert into public.kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,portal_crossed_at)
      values(p_world_id,player_user,player_id,w.name,s->>'playerName',to_timestamp(at_ms/1000))
      on conflict(world_id,user_id) do nothing;
    end if;
  end loop;
  if p_finalize then
    rank_value := 0;
    for item in select value from jsonb_array_elements(p_players)
      order by (value->>'influence')::integer desc, (value->'state'->>'portalCrossedAt')::numeric asc nulls last, value->>'playerId' asc loop
      rank_value := rank_value + 1;
      player_id := (item->>'playerId')::uuid;
      select user_id into player_user from public.world_players where id = player_id;
      s := item->'state';
      xp_value := greatest(0, coalesce((s->>'seasonXp')::integer, 100)) + greatest(0, 110 - rank_value * 10);
      insert into public.kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,portal_crossed_at,final_rank,final_score,xp,trophy)
      values(p_world_id,player_user,player_id,w.name,s->>'playerName',true,to_timestamp((s->>'portalCrossedAt')::numeric/1000),rank_value,(item->>'influence')::integer,xp_value,rank_value=1)
      on conflict(world_id,user_id) do update set finished = true, final_rank = excluded.final_rank,final_score = excluded.final_score,xp = excluded.xp,trophy = excluded.trophy;
    end loop;
    update public.worlds set status = 'finalized', phase = 'closed', day_number = 120, finalized_at = world_end, updated_at = now() where id = p_world_id;
  end if;
  if p_request_id is not null then
    insert into public.kw_cozy_commands(world_player_id,request_id,action_hash) values(p_actor_player_id,p_request_id,p_action_hash);
  end if;
  return jsonb_build_object('status','committed','revision',current_shared + 1);
end $$;

-- Read receipts are metadata, including before opening and after the season ends.
-- Keep this separate from the economic commit, which must remain closed.
create or replace function public.kw_cozy_read_reports(
  p_world_id uuid, p_user_id uuid, p_actor_player_id uuid,
  p_expected_shared_revision bigint, p_expected_player_revision bigint,
  p_read_at numeric, p_request_id text, p_action_hash text
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  w public.worlds%rowtype; ps public.kw_cozy_player_states%rowtype;
  current_shared bigint; old_hash text;
begin
  select * into w from public.worlds where id = p_world_id for update;
  if not found or w.rules_version <> 2 then raise exception 'COZY_WORLD_NOT_FOUND'; end if;
  if not exists(select 1 from public.world_players where id=p_actor_player_id and world_id=p_world_id and user_id=p_user_id) then raise exception 'COZY_MEMBERSHIP_REQUIRED'; end if;
  if p_request_id is null or length(p_request_id) not between 8 and 128 or p_action_hash is null or length(p_action_hash) <> 64 then raise exception 'COZY_INVALID_RECEIPT'; end if;
  select action_hash into old_hash from public.kw_cozy_commands where world_player_id=p_actor_player_id and request_id=p_request_id;
  if found then
    if old_hash is distinct from p_action_hash then raise exception 'COZY_REQUEST_REUSED'; end if;
    return jsonb_build_object('status','duplicate');
  end if;
  select * into ps from public.kw_cozy_player_states where world_player_id=p_actor_player_id and world_id=p_world_id and user_id=p_user_id;
  if not found then return jsonb_build_object('status','conflict'); end if;
  select revision into current_shared from public.kw_cozy_world_states where world_id=p_world_id;
  if current_shared is null or current_shared is distinct from p_expected_shared_revision or ps.revision is distinct from p_expected_player_revision then return jsonb_build_object('status','conflict'); end if;
  if p_read_at is null or not (p_read_at >= 0 and p_read_at <= extract(epoch from clock_timestamp()) * 1000 + 5000) then raise exception 'COZY_INVALID_RECEIPT'; end if;
  update public.kw_cozy_player_states
    set state_json=jsonb_set(state_json,'{readAt}',to_jsonb(greatest(coalesce((state_json->>'readAt')::numeric,0),p_read_at))),
        revision=revision+1, updated_at=now()
    where world_player_id=p_actor_player_id;
  update public.kw_cozy_world_states set revision=revision+1,updated_at=now() where world_id=p_world_id;
  insert into public.kw_cozy_commands(world_player_id,request_id,action_hash) values(p_actor_player_id,p_request_id,p_action_hash);
  return jsonb_build_object('status','committed','revision',current_shared+1);
end $$;
revoke all on function public.kw_cozy_read_reports(uuid,uuid,uuid,bigint,bigint,numeric,text,text) from public,anon,authenticated;
grant execute on function public.kw_cozy_read_reports(uuid,uuid,uuid,bigint,bigint,numeric,text,text) to service_role;

create or replace function public.kw_cozy_account(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'account', (select jsonb_build_object('xp',coalesce(sum(xp),0),'level',1 + floor(sqrt(coalesce(sum(xp),0)/100.0)),
      'seals',count(*) filter(where portal_crossed_at is not null),'trophies',count(*) filter(where trophy),'seasons',count(*) filter(where finished))
      from public.kw_cozy_rewards where user_id = p_user_id),
    'history',coalesce((select jsonb_agg(row_to_json(h)) from (
      select world_id as "worldId",world_name as "worldName",final_rank as "rank",final_score as "score",xp,
        portal_crossed_at is not null as seal,trophy,finished,awarded_at as "awardedAt"
      from public.kw_cozy_rewards where user_id = p_user_id order by awarded_at desc limit 50) h),'[]'::jsonb),
    'hallOfFame',coalesce((select jsonb_agg(row_to_json(h)) from (
      select world_id as "worldId",world_name as "worldName",player_name as "playerName",final_score as "score",awarded_at as "awardedAt"
      from public.kw_cozy_rewards where trophy order by awarded_at desc limit 30) h),'[]'::jsonb)
  );
$$;

revoke all on function public.kw_cozy_join(uuid,uuid,text), public.kw_cozy_start(uuid,uuid), public.kw_cozy_commit(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean), public.kw_cozy_account(uuid) from public, anon, authenticated;
grant execute on function public.kw_cozy_join(uuid,uuid,text), public.kw_cozy_start(uuid,uuid), public.kw_cozy_commit(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean), public.kw_cozy_account(uuid) to service_role;

-- Keep the previous SQL simulator intact for v1 worlds. Version 2 uses the
-- server engine's chronological settlement, including offline catch-up.
do $$ begin
  if to_regprocedure('public.kw_world_tick(uuid)') is not null and to_regprocedure('public.kw_world_tick_v1(uuid)') is null then
    alter function public.kw_world_tick(uuid) rename to kw_world_tick_v1;
  end if;
  if to_regprocedure('public.kw_abandoned_tick(uuid)') is not null and to_regprocedure('public.kw_abandoned_tick_v1(uuid)') is null then
    alter function public.kw_abandoned_tick(uuid) rename to kw_abandoned_tick_v1;
  end if;
end $$;
create or replace function public.kw_world_tick(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists(select 1 from public.worlds where id=p_world_id and rules_version=1) and to_regprocedure('public.kw_world_tick_v1(uuid)') is not null then
    return public.kw_world_tick_v1(p_world_id);
  end if;
  return jsonb_build_object('skipped',true,'reason','cozy_server_engine');
end $$;
create or replace function public.kw_abandoned_tick(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists(select 1 from public.worlds where id=p_world_id and rules_version=1) and to_regprocedure('public.kw_abandoned_tick_v1(uuid)') is not null then
    return public.kw_abandoned_tick_v1(p_world_id);
  end if;
  return jsonb_build_object('skipped',true,'reason','cozy_server_engine');
end $$;
revoke all on function public.kw_world_tick(uuid), public.kw_abandoned_tick(uuid) from public, anon, authenticated;
grant execute on function public.kw_world_tick(uuid), public.kw_abandoned_tick(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
