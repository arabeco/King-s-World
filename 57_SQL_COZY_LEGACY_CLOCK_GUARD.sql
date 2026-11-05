-- Preserve the historical clock for v1; Cozy seasons are settled by the server engine.
begin;
do $$
declare definition text;
begin
  if to_regprocedure('public.kw_tick_worlds()') is null then return; end if;
  select pg_get_functiondef('public.kw_tick_worlds()'::regprocedure) into definition;
  if position('cozy-v2-clock-guard' in definition)>0 then return; end if;
  if position('where runtime_started = true' in definition)=0 then
    raise exception 'LEGACY_CLOCK_UNRECOGNIZED: inspect its implementation before applying the guard';
  end if;
  definition:=replace(definition,'where runtime_started = true',E'where rules_version = 1 -- cozy-v2-clock-guard\n      and runtime_started = true');
  execute definition;
end $$;
commit;
