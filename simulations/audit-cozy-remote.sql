-- Read-only metadata. No player identities, balances or credentials are returned.
select jsonb_build_object(
  'world_count',(select count(*) from public.worlds),
  'participant_count',(select count(*) from public.world_players),
  'world_hash',(select md5(coalesce(string_agg(md5((to_jsonb(w)-'rules_version'-'influence_version')::text),'' order by id),'')) from public.worlds w),
  'player_state_hash',(select md5(coalesce(string_agg(md5(to_jsonb(p)::text),'' order by world_player_id),'')) from public.kw_cozy_player_states p),
  'reward_hash',(select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by world_id,world_player_id),'')) from public.kw_cozy_rewards r),
  'participant_hash',(select md5(coalesce(string_agg(md5(to_jsonb(p)::text),'' order by id),'')) from public.world_players p),
  'legacy_worlds',(select count(*) from public.worlds where rules_version=1),
  'cozy_worlds',(select count(*) from public.worlds where rules_version=2),
  'legacy_functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'body_hash',md5(p.prosrc))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_world_tick_v1','kw_abandoned_tick_v1')),
  'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'anon_select',has_table_privilege('anon',c.oid,'select'),'authenticated_update',has_table_privilege('authenticated',c.oid,'update'))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('kw_cozy_world_states','kw_cozy_player_states','kw_cozy_commands','kw_cozy_rewards')),
  'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'anon',has_function_privilege('anon',p.oid,'execute'),'authenticated',has_function_privilege('authenticated',p.oid,'execute'),'service',has_function_privilege('service_role',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'kw_cozy_%'),
  'schedulers',(select jsonb_agg(jsonb_build_object('name',p.proname,'body_hash',md5(p.prosrc),'search_path',p.proconfig,'anon',has_function_privilege('anon',p.oid,'execute'),'authenticated',has_function_privilege('authenticated',p.oid,'execute'),'service',has_function_privilege('service_role',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_tick_worlds','kw_mark_due_orders_resolving') and p.pronargs=0)
) as audit;
