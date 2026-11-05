-- Read-only collection/king/Premium readiness audit. Never reads tokens or payment payloads.
select jsonb_build_object(
 'project', 'wdmrdovkkrgzalnpqdxe',
 'tables', (select jsonb_agg(jsonb_build_object('name',name,'exists',to_regclass('public.'||name) is not null)) from unnest(array['kw_account_appearance','kw_collection_catalog','kw_player_wallet','kw_player_inventory','kw_gem_transactions','kw_king_xp_progress','kw_king_xp_events','kw_collection_season_rewards','user_entitlements']) name),
 'functions', (select jsonb_agg(jsonb_build_object('name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),'body_hash',md5(p.prosrc),'search_path',p.proconfig,'anon',has_function_privilege('anon',p.oid,'execute'),'authenticated',has_function_privilege('authenticated',p.oid,'execute'),'service',has_function_privilege('service_role',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_collection_read','kw_collection_buy','kw_account_appearance_save','kw_king_stats','kw_king_add_stat','kw_king_progress_xp','kw_collection_award_season','kw_premium_active','kw_premium_benefits','grant_kw_entitlement','kw_cozy_create_lobby')),
 'users_hash',(select md5(coalesce(string_agg(md5(to_jsonb(u)::text),'' order by id),'')) from public.users u),
 'user_count',(select count(*) from public.users)
) as audit;
