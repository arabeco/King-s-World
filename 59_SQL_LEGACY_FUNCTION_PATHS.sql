-- Pin name resolution without replacing function bodies, grants or game rules.
-- Apply only after comparing audit-cozy-function-paths.sql with the local sources.
-- Every relation/type/helper in these legacy bodies is schema-qualified.
begin;
set local search_path = pg_catalog;
-- Fail closed when a remote body differs from the reviewed local implementation.
-- CRLF/LF differences alone are ignored; unknown revisions require a new review.
-- Accept checked-in bodies and the four live variants reviewed on 2026-10-31.
do $guard$
declare candidate record; function_oid oid;
begin
 for candidate in select signature,array_agg(body_hash) as body_hashes from (values
    ('public.set_updated_at()', '9b1889f56258bf9d6554213c05019c76'),
    ('public.is_friendly_target_site(uuid,uuid)', 'c27159ed96333ed6d65d79332b80301a'),
    ('public.enforce_capital_home_troops()', '646ab1971e0ab65840635fe655e438bd'),
    ('public.validate_donation_only_resource_movement()', 'cd1076f36633fc1330f023fe4dbba72d'),
    ('public.touch_user_entitlements_updated_at()', '9b1889f56258bf9d6554213c05019c76'),
    ('public.touch_village_structure_states_updated_at()', '9b1889f56258bf9d6554213c05019c76'),
    ('public.touch_village_city_states_updated_at()', '9b1889f56258bf9d6554213c05019c76'),
    ('public.touch_world_player_king_states_updated_at()', '9b1889f56258bf9d6554213c05019c76'),
    ('public.touch_world_player_exploration_states_updated_at()', '9b1889f56258bf9d6554213c05019c76'),
    ('public.generate_world_join_code()', '5dc6e692ebef94d18eee3afa0a2a8db0'),
    ('public.kw_npc_profile_growth(text)', 'b5c515a0dd070962badb537154a66612'),
    ('public.kw_player_power_score(bigint,bigint,bigint,bigint)', '3aa7554298afcd7b9ff5ab97b9789687')
,
    ('public.enforce_capital_home_troops()', 'c2cc2e470f04a4baaf557ccc50f2240d'),
    ('public.is_friendly_target_site(uuid,uuid)', 'c3b069704c0ada4680dfea9e15ce4b5d'),
    ('public.kw_npc_profile_growth(text)', '249552aa5f2fbb34ac3930db5532cded'),
    ('public.validate_donation_only_resource_movement()', '32da5bebe01bc4771d7d5f98e2e06b79')
 ) as reviewed(signature,body_hash) group by signature loop
  function_oid := to_regprocedure(candidate.signature);
  if function_oid is null then raise exception 'Reviewed legacy function does not exist: %',candidate.signature; end if;
  if not (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=function_oid) = any(candidate.body_hashes) then
   raise exception 'Legacy function body changed; review before hardening: %',candidate.signature;
  end if;
 end loop;
end;
$guard$;
alter function public.set_updated_at() set search_path = '';
alter function public.is_friendly_target_site(uuid, uuid) set search_path = '';
alter function public.enforce_capital_home_troops() set search_path = '';
alter function public.validate_donation_only_resource_movement() set search_path = '';
alter function public.touch_user_entitlements_updated_at() set search_path = '';
alter function public.touch_village_structure_states_updated_at() set search_path = '';
alter function public.touch_village_city_states_updated_at() set search_path = '';
alter function public.touch_world_player_king_states_updated_at() set search_path = '';
alter function public.touch_world_player_exploration_states_updated_at() set search_path = '';
alter function public.generate_world_join_code() set search_path = '';
alter function public.kw_npc_profile_growth(text) set search_path = '';
alter function public.kw_player_power_score(bigint, bigint, bigint, bigint) set search_path = '';
commit;
