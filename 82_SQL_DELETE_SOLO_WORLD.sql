begin;
-- Service-only: the HTTP layer supplies the authenticated account ID.
-- Locking the world serializes deletion with the normal join operation.
create or replace function public.kw_delete_solo_cozy_world(p_slug text,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.worlds%rowtype;
begin
  select * into w from public.worlds where slug=p_slug for update;
  if not found or w.rules_version<>2 then raise exception 'WORLD_DELETE_UNAVAILABLE'; end if;
  if w.created_by_user_id is distinct from p_user_id then raise exception 'WORLD_DELETE_OWNER_REQUIRED'; end if;
  if exists(select 1 from public.world_players p where p.world_id=w.id and p.is_ai is not true and p.user_id is distinct from p_user_id) then
    raise exception 'WORLD_DELETE_SHARED';
  end if;
  if not exists(select 1 from public.world_players p where p.world_id=w.id and p.user_id=p_user_id and p.is_ai is not true) then
    raise exception 'WORLD_DELETE_OWNER_REQUIRED';
  end if;
  delete from public.worlds where id=w.id;
  return jsonb_build_object('deleted',true);
end;
$$;
revoke all on function public.kw_delete_solo_cozy_world(text,uuid) from public,anon,authenticated;
grant execute on function public.kw_delete_solo_cozy_world(text,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
