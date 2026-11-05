-- Supersedes the 60-day candidate for NEW worlds only. Existing rows remain v1.
begin;
alter table public.worlds add column if not exists economy_version smallint not null default 1 check(economy_version in (1,2));
do $$
declare definition text; target record; original text; replacement text;
begin
 for target in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_cozy_create','kw_cozy_start','kw_cozy_commit') loop
  definition:=pg_get_functiondef(target.oid);
  if target.proname='kw_cozy_create' then
   if strpos(definition,'set economy_version=2')>0 then raise exception 'In-place economic create already installed; review legacy compatibility'; end if;
   definition:=replace(definition,'FUNCTION public.kw_cozy_create(','FUNCTION public.kw_cozy_create_economic(');
   if strpos(definition,'FUNCTION public.kw_cozy_create_economic(')=0 then raise exception 'Unexpected create signature'; end if;
   definition:=replace(definition,$s$duration := case when p_mode='express' then 60 else 120 end;$s$,$s$duration := case when p_mode='express' then 30 else 120 end;$s$);
   definition:=replace(definition,$s$speed := case when p_mode='express' then 4 else 1 end;$s$,$s$speed := case when p_mode='express' then 1 else 1 end;$s$);
   definition:=replace(definition,$s$speed := case when p_mode='express' then 2 else 1 end;$s$,$s$speed := case when p_mode='express' then 1 else 1 end;$s$);
   original:='perform public.kw_cozy_join(w.id,p_user_id,null);';
   replacement:=$s$update public.worlds set economy_version=2 where id=w.id and p_mode='express'; perform public.kw_cozy_join(w.id,p_user_id,null);$s$;
   if strpos(definition,'set economy_version=2')=0 then
    if strpos(definition,original)=0 then raise exception 'Unreviewed create function'; end if;
    definition:=replace(definition,original,replacement);
   end if;
   if strpos(definition,$s$duration := case when p_mode='express' then 30 else 120 end;$s$)=0 or strpos(definition,$s$speed := case when p_mode='express' then 1 else 1 end;$s$)=0 then raise exception 'Unreviewed create rhythm'; end if;
  else
   if strpos(definition,'w.economy_version=2')=0 then
    original:=$s$case when w.season_mode = 'express' then case when w.speed_multiplier=2 then 60 else 30 end else 120 end$s$;
    replacement:=$s$case when w.economy_version=2 and w.season_mode='express' then 30 else case when w.season_mode = 'express' then case when w.speed_multiplier=2 then 60 else 30 end else 120 end end$s$;
    if strpos(definition,original)=0 then
     original:=$s$case when w.season_mode = 'express' then 30 else 120 end$s$;
     replacement:=$s$case when w.economy_version=2 and w.season_mode='express' then 30 else case when w.season_mode = 'express' then 30 else 120 end end$s$;
    end if;
    if strpos(definition,original)=0 then raise exception 'Unreviewed rhythm in %',target.proname; end if;
    definition:=replace(definition,original,replacement);
   end if;
  end if;
  execute definition;
 end loop;
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kw_cozy_create','kw_cozy_start','kw_cozy_commit'))<>3 then raise exception 'Expected three unique functions'; end if;
end $$;
revoke all on function public.kw_cozy_create_economic(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kw_cozy_create_economic(uuid,text,text) to service_role;
create or replace function public.kw_cozy_economy_version_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.economy_version is distinct from old.economy_version and exists(select 1 from public.world_players where world_id=old.id) then
  raise exception 'COZY_ECONOMY_VERSION_IMMUTABLE';
 end if;
 return new;
end $$;
revoke all on function public.kw_cozy_economy_version_guard() from public,anon,authenticated;
drop trigger if exists kw_cozy_economy_version_guard on public.worlds;
create trigger kw_cozy_economy_version_guard before update of economy_version on public.worlds for each row execute function public.kw_cozy_economy_version_guard();
notify pgrst,'reload schema';
commit;
