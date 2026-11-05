-- Read-only fingerprints and prize RPC metadata, without exposing account or purchase data.
select jsonb_build_object(
 'users',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.users t),
 'worlds',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.worlds t),
 'players',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by id),'')) from public.world_players t),
 'states',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by world_player_id),'')) from public.kw_cozy_player_states t),
 'shared',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by world_id),'')) from public.kw_cozy_world_states t),
 'wallets',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id),'')) from public.kw_player_wallet t),
 'inventory',(select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by user_id,product_id),'')) from public.kw_player_inventory t),
 'receipts',(select md5(coalesce(string_agg(md5(jsonb_build_array(world_id,user_id,gems,product_ids,awarded_at)::text),'' order by world_id,user_id),'')) from public.kw_collection_season_rewards),
 'columns',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='kw_collection_season_rewards'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'hash',md5(p.prosrc),'anon',has_function_privilege('anon',p.oid,'execute'),'authenticated',has_function_privilege('authenticated',p.oid,'execute'),'service',has_function_privilege('service_role',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_collection_read','kw_collection_award_season','kw_collection_season_closed'))
) audit;
