begin;
create table if not exists public.kw_cozy_lobby_settings (
 world_id uuid primary key references public.worlds(id) on delete cascade,
 password_hash text,
 listed boolean not null default true
);
alter table public.kw_cozy_lobby_settings enable row level security;
revoke all on public.kw_cozy_lobby_settings from public, anon, authenticated;
grant select,insert,update,delete on public.kw_cozy_lobby_settings to service_role;
create or replace function public.kw_cozy_create_lobby(p_user_id uuid,p_name text,p_mode text,p_password_hash text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare created jsonb;
begin
 if p_password_hash is not null and length(p_password_hash)>256 then raise exception 'COZY_INVALID_PASSWORD'; end if;
 if p_mode='express' then created:=public.kw_cozy_create_economic(p_user_id,p_name,p_mode);
 else created:=public.kw_cozy_create(p_user_id,p_name,p_mode); end if;
 insert into public.kw_cozy_lobby_settings(world_id,password_hash) values((created->>'id')::uuid,p_password_hash);
 return created;
end $$;
revoke all on function public.kw_cozy_create_lobby(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.kw_cozy_create_lobby(uuid,text,text,text) to service_role;
commit;
