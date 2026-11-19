begin;

-- The completion command must either archive, award and release the slot together, or roll back.
create or replace function public.kw_cozy_commit_ascension(
  p_world_id uuid, p_user_id uuid, p_actor_player_id uuid,
  p_expected_shared_revision bigint, p_expected_world_status text,
  p_shared jsonb, p_players jsonb, p_request_id text default null,
  p_action_hash text default null, p_finalize boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  s jsonb;
  proof jsonb;
  founded bigint;
  completed bigint;
  result jsonb;
begin
  if p_request_id is null or p_action_hash is null or p_finalize then raise exception 'COZY_ASCENSION_INVALID_STATE'; end if;
  if not exists(select 1 from public.worlds where id=p_world_id and persistent_cozy and status='running') then
    raise exception 'COZY_ASCENSION_UNAVAILABLE';
  end if;
  select value->'state' into s from jsonb_array_elements(p_players)
    where value->>'playerId'=p_actor_player_id::text;
  if jsonb_typeof(s->'ascension') is distinct from 'object' or jsonb_typeof(s->'ascensionProofs') is distinct from 'object' then
    raise exception 'COZY_ASCENSION_PROOFS_REQUIRED';
  end if;
  founded := (s->>'createdAt')::bigint;
  completed := (s->>'finalizedAt')::bigint;
  select jsonb_object_agg(key,value) into proof from jsonb_each(s->'ascensionProofs')
    where key in ('expedition','provisions','council')
      and case when jsonb_typeof(value)='number' then (value#>>'{}')::numeric end between founded and completed;
  if proof is null or (select count(*) from jsonb_object_keys(proof))<2 then
    raise exception 'COZY_ASCENSION_PROOFS_REQUIRED';
  end if;
  result := public.kw_cozy_commit(p_world_id,p_user_id,p_actor_player_id,p_expected_shared_revision,
    p_expected_world_status,p_shared,p_players,p_request_id,p_action_hash,false);
  if result->>'status'='committed' then
    update public.kw_cozy_ascension_archives a set receipt=jsonb_set(a.receipt,'{proofs}',proof)
      where a.world_player_id=p_actor_player_id and a.user_id=p_user_id and a.world_id=p_world_id and a.founded_at_ms=founded
      and exists (select 1 from public.world_players p where p.id=p_actor_player_id and p.cozy_released and p.status='archived');
    if not found then raise exception 'COZY_ASCENSION_UNAVAILABLE'; end if;
  end if;
  return result;
end;
$$;

revoke all on function public.kw_cozy_commit_ascension(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean)
  from public,anon,authenticated;
grant execute on function public.kw_cozy_commit_ascension(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean)
  to service_role;
notify pgrst,'reload schema';
commit;
