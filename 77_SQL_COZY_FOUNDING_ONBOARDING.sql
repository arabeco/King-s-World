begin;

alter table public.worlds
  add column if not exists founding_onboarding boolean not null default false;

create or replace function public.kw_cozy_create_founding(
  p_user_id uuid, p_name text, p_mode text, p_password_hash text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  created jsonb;
begin
  created := public.kw_cozy_create_lobby(p_user_id, p_name, p_mode, p_password_hash);
  update public.worlds
     set founding_onboarding = true
   where id = (created->>'id')::uuid
     and rules_version = 2 and economy_version = 3 and influence_version = 2
     and combat_mode = 'cozy';
  if not found then raise exception 'COZY_FOUNDING_RULES_REQUIRED'; end if;
  return created;
end;
$$;

revoke all on function public.kw_cozy_create_founding(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.kw_cozy_create_founding(uuid,text,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
