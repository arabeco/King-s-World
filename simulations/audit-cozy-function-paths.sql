-- Metadata and function code only: no credentials or player records.
select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object(
  'name',p.proname,'signature',p.oid::regprocedure::text,
  'identity_args',pg_get_function_identity_arguments(p.oid),
  'definition',pg_get_functiondef(p.oid),'body_hash',md5(p.prosrc),
  'config',p.proconfig,'definer',p.prosecdef,
  'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
  'result',pg_get_function_result(p.oid)
 ) order by p.proname,p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname=any(array[
  'set_updated_at','is_friendly_target_site','enforce_capital_home_troops',
  'validate_donation_only_resource_movement','touch_user_entitlements_updated_at',
  'touch_village_structure_states_updated_at','touch_village_city_states_updated_at',
  'touch_world_player_king_states_updated_at','touch_world_player_exploration_states_updated_at',
  'generate_world_join_code','kw_npc_profile_growth','kw_player_power_score'])),
 'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,
  'anon_create',has_schema_privilege('anon',oid,'create'),
  'authenticated_create',has_schema_privilege('authenticated',oid,'create')))
  from pg_namespace where nspname in ('public','extensions')),
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname))
  from pg_extension e join pg_namespace n on n.oid=e.extnamespace)
) as audit;
