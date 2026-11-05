-- Run only against the verified King's World project. Every test write is rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
set local role service_role;
do $$
declare
  owner_id uuid; ally_id uuid; v_world_id uuid; actor_id uuid; ally_player uuid;
  created jsonb; result jsonb; players jsonb; shared jsonb := '{"version":2,"claims":{},"deposits":{}}';
  started timestamptz;
begin
  select id into owner_id from public.users u where coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null order by id limit 1;
  select id into ally_id from public.users u where id<>owner_id and coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null order by id limit 1;
  if owner_id is null or ally_id is null then raise exception 'SMOKE_REQUIRES_TWO_EXISTING_ACTIVE_USERS'; end if;
  created:=public.kw_cozy_create(owner_id,'QA transacional - descartar','normal');
  v_world_id:=(created->>'id')::uuid;
  if (select season_mode from public.worlds where id=v_world_id)<>'classic' then raise exception 'CLASSIC_MODE_MISMATCH'; end if;
  if (select player_cap from public.worlds where id=v_world_id)<>20 then raise exception 'WORLD_CAP_MISMATCH'; end if;
  if (select influence_version from public.worlds where id=v_world_id)<>2 then raise exception 'ZERO_INFLUENCE_VERSION_MISSING'; end if;
  begin
    update public.worlds set influence_version=1 where id=v_world_id;
    raise exception 'INFLUENCE_VERSION_CHANGED';
  exception when others then if sqlerrm<>'COZY_INFLUENCE_VERSION_IMMUTABLE' then raise; end if; end;
  select id into actor_id from public.world_players wp where wp.world_id=v_world_id and wp.user_id=owner_id;
  if actor_id is null then raise exception 'CREATOR_MEMBERSHIP_MISSING'; end if;
  begin
    perform public.kw_cozy_join(v_world_id,ally_id,'WRONG-CODE');
    raise exception 'INVALID_INVITE_ACCEPTED';
  exception when others then if sqlerrm<>'COZY_INVITE_REQUIRED' then raise; end if; end;
  ally_player:=public.kw_cozy_join(v_world_id,ally_id,created->>'join_code');
  if public.kw_cozy_join(v_world_id,ally_id,created->>'join_code')<>ally_player then raise exception 'JOIN_NOT_IDEMPOTENT'; end if;
  begin
    perform public.kw_cozy_start(v_world_id,ally_id);
    raise exception 'NON_OWNER_START_ACCEPTED';
  exception when others then if sqlerrm<>'COZY_OWNER_REQUIRED' then raise; end if; end;
  perform public.kw_cozy_start(v_world_id,owner_id);
  select runtime_anchor_started_at into started from public.worlds where id=v_world_id;
  perform public.kw_cozy_start(v_world_id,owner_id);
  if (select runtime_anchor_started_at from public.worlds where id=v_world_id)<>started then raise exception 'START_CLOCK_REWOUND'; end if;
  if exists(select 1 from public.kw_tick_worlds() clock where clock.world_id=v_world_id) then raise exception 'LEGACY_CLOCK_TOUCHED_COZY'; end if;
  players:=jsonb_build_array(jsonb_build_object('playerId',actor_id,'expectedRevision',-1,'influence',100,'state',jsonb_build_object('version',2,'playerId',actor_id,'settledAt',0,'portalCrossedAt',null,'resources',jsonb_build_object('gold',100))));
  result:=public.kw_cozy_commit(v_world_id,owner_id,actor_id,-1,'running',shared,players,'remote-smoke-request',repeat('a',64),false);
  if result->>'status'<>'committed' then raise exception 'COMMIT_FAILED: %',result; end if;
  result:=public.kw_cozy_commit(v_world_id,owner_id,actor_id,-1,'running',shared,players,'remote-smoke-request',repeat('a',64),false);
  if result->>'status'<>'duplicate' then raise exception 'RECEIPT_NOT_IDEMPOTENT'; end if;
  result:=public.kw_cozy_commit(v_world_id,owner_id,actor_id,-1,'running',shared,players,'remote-smoke-stale',repeat('b',64),false);
  if result->>'status'<>'conflict' then raise exception 'STALE_COMMIT_ACCEPTED'; end if;
  begin
    perform public.kw_cozy_commit(v_world_id,ally_id,actor_id,0,'running',shared,players,'remote-smoke-spoof',repeat('c',64),false);
    raise exception 'ACTOR_SPOOF_ACCEPTED';
  exception when others then if sqlerrm<>'COZY_MEMBERSHIP_REQUIRED' then raise; end if; end;
  if has_function_privilege('anon','public.kw_cozy_create(uuid,text,text)','execute') or has_function_privilege('authenticated','public.kw_cozy_create(uuid,text,text)','execute') then raise exception 'CLIENT_RPC_EXPOSED'; end if;
  if has_table_privilege('anon','public.kw_cozy_player_states','select') or has_table_privilege('authenticated','public.kw_cozy_world_states','update') then raise exception 'CLIENT_SNAPSHOT_EXPOSED'; end if;
  if exists(select 1 from pg_class where oid in ('public.kw_cozy_world_states'::regclass,'public.kw_cozy_player_states'::regclass,'public.kw_cozy_commands'::regclass,'public.kw_cozy_rewards'::regclass) and not relrowsecurity) then raise exception 'RLS_MISSING'; end if;
  created:=public.kw_cozy_create(owner_id,'QA expresso - descartar','express');
  if (select season_mode from public.worlds where id=(created->>'id')::uuid)<>'express' then raise exception 'EXPRESS_MODE_MISMATCH'; end if;
end $$;
rollback;
select 'PASS: RPCs reais, convites, duas contas, início, CAS, recibos e permissões; todas as escritas de teste revertidas' as result;
