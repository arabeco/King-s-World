-- Local candidate: new Express worlds use 60 real days / 120 game days.
-- Existing rows keep their stored speed; starting/finalizing honors that speed.
-- Apply only together with the engine/server support for speed_multiplier.
begin;
do $$
declare target record; definition text; original text; replacement text;
begin
 for target in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('kw_cozy_create','kw_cozy_start','kw_cozy_commit') loop
  definition:=pg_get_functiondef(target.oid);
  if target.proname='kw_cozy_create' then
   original:=$s$duration := case when p_mode='express' then 30 else 120 end;$s$;
   replacement:=$s$duration := case when p_mode='express' then 60 else 120 end;$s$;
   if strpos(definition,original)=0 and strpos(definition,replacement)=0 then raise exception 'Unreviewed create duration'; end if;
   definition:=replace(definition,original,replacement);
   original:=$s$speed := case when p_mode='express' then 4 else 1 end;$s$;
   replacement:=$s$speed := case when p_mode='express' then 2 else 1 end;$s$;
  else
   original:=$s$case when w.season_mode = 'express' then 30 else 120 end$s$;
   replacement:=$s$case when w.season_mode = 'express' then case when w.speed_multiplier=2 then 60 else 30 end else 120 end$s$;
  end if;
  if strpos(definition,original)=0 and strpos(definition,replacement)=0 then raise exception 'Unreviewed rhythm in %',target.proname; end if;
  definition:=replace(definition,original,replacement);
  execute definition;
 end loop;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_cozy_create','kw_cozy_start','kw_cozy_commit'))<>3 then raise exception 'Expected three unique Cozy functions'; end if;
end $$;
commit;
