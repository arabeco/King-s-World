-- New worlds only: one scoring/economy rule set, 120 game days, Express clock x4.
-- Existing worlds and their saved weights are never converted.
begin;
do $$
declare definition text;
begin
 alter table public.worlds drop constraint if exists worlds_economy_version_check;
 alter table public.worlds add constraint worlds_economy_version_check check(economy_version in (1,2,3));
 select pg_get_functiondef('public.kw_cozy_create_economic(uuid,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'FUNCTION public.kw_cozy_create_economic(','FUNCTION public.kw_cozy_create_unified(');
 definition:=replace(definition,'speed := case when p_mode=''express'' then 1 else 1 end;','speed := case when p_mode=''express'' then 4 else 1 end;');
 definition:=replace(definition,'set economy_version=2 where id=w.id and p_mode=''express''','set economy_version=3 where id=w.id');
 if strpos(definition,'FUNCTION public.kw_cozy_create_unified(')=0 or strpos(definition,'set economy_version=3 where id=w.id')=0 or strpos(definition,'speed := case when p_mode=''express'' then 4 else 1 end;')=0 then raise exception 'UNREVIEWED_UNIFIED_CREATE';end if;
 execute definition;
 select pg_get_functiondef('public.kw_cozy_create_lobby(uuid,text,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'public.kw_cozy_create_economic(','public.kw_cozy_create_unified(');
 definition:=replace(definition,'public.kw_cozy_create(','public.kw_cozy_create_unified(');
 if strpos(definition,'public.kw_cozy_create_unified(')=0 then raise exception 'UNREVIEWED_UNIFIED_LOBBY';end if;
 execute definition;
end $$;
revoke all on function public.kw_cozy_create_unified(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kw_cozy_create_unified(uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
