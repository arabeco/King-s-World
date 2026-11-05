-- Restrict existing global schedulers to server execution. No game data or formulas change.
begin;
do $$
declare scheduler text;
begin
  for scheduler in select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('kw_mark_due_orders_resolving','kw_tick_worlds') and p.pronargs=0
  loop
    execute format('alter function public.%I() set search_path = public, extensions, pg_temp',scheduler);
    execute format('revoke all on function public.%I() from public, anon, authenticated',scheduler);
    execute format('grant execute on function public.%I() to service_role',scheduler);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
