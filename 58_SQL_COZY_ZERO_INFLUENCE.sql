-- Existing seasons retain their influence model. Future seasons start with zero prestige.
begin;
alter table public.worlds add column if not exists influence_version integer not null default 1;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.worlds'::regclass and conname='worlds_influence_version_check') then
  alter table public.worlds add constraint worlds_influence_version_check check(influence_version in (1,2));
 end if;
end $$;
alter table public.worlds alter column influence_version set default 2;
create or replace function public.kw_cozy_preserve_influence_version()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.influence_version is distinct from old.influence_version then raise exception 'COZY_INFLUENCE_VERSION_IMMUTABLE'; end if;
 return new;
end $$;
revoke all on function public.kw_cozy_preserve_influence_version() from public,anon,authenticated;
grant execute on function public.kw_cozy_preserve_influence_version() to service_role;
drop trigger if exists kw_cozy_influence_version_immutable on public.worlds;
create trigger kw_cozy_influence_version_immutable before update of influence_version on public.worlds
for each row execute function public.kw_cozy_preserve_influence_version();
notify pgrst, 'reload schema';
commit;
