-- Read-only world-mode metadata and data fingerprints; no identities or tokens.
select jsonb_build_object(
 'worlds',(select md5(coalesce(string_agg(md5((to_jsonb(t)-'combat_mode')::text),'' order by id),'')) from public.worlds t),
 'users',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.users t),
 'players',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.world_players t),
 'states',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by world_player_id),'')) from public.kw_cozy_player_states t),
 'shared',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by world_id),'')) from public.kw_cozy_world_states t),
 'wallets',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id),'')) from public.kw_player_wallet t),
 'inventory',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,product_id),'')) from public.kw_player_inventory t),
 'prizes',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by world_id,user_id),'')) from public.kw_collection_season_rewards t),
 'modes',(select jsonb_object_agg(mode,n) from (select coalesce(to_jsonb(w)->>'combat_mode','cozy') mode,count(*) n from public.worlds w group by 1) q),
 'column_exists',exists(select 1 from information_schema.columns where table_schema='public' and table_name='worlds' and column_name='combat_mode'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'hash',md5(p.prosrc),'anon',has_function_privilege('anon',p.oid,'execute'),'authenticated',has_function_privilege('authenticated',p.oid,'execute'),'service',has_function_privilege('service_role',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_combat_mode_immutable','kw_cozy_create_with_rules'))
) audit;
