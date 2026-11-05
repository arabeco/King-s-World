begin;
-- Existing worlds stay Cozy. No existing season is converted to PvP.
alter table public.worlds add column if not exists combat_mode text not null default 'cozy' check(combat_mode in ('cozy','competitive'));
create or replace function public.kw_combat_mode_immutable() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.combat_mode is distinct from old.combat_mode and (old.rules_version<>2 or old.status<>'open' or new.status<>'open' or exists(select 1 from public.kw_cozy_player_states where world_id=old.id) or exists(select 1 from public.world_players where world_id=old.id and user_id is distinct from old.created_by_user_id)) then raise exception 'COZY_COMBAT_MODE_LOCKED';end if;
 return new;
end $$;
drop trigger if exists kw_combat_mode_immutable on public.worlds;
create trigger kw_combat_mode_immutable before update of combat_mode on public.worlds for each row execute function public.kw_combat_mode_immutable();
create or replace function public.kw_cozy_create_with_rules(p_user_id uuid,p_name text,p_mode text,p_combat_mode text,p_password_hash text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare created jsonb;
begin
 if p_combat_mode is null or p_combat_mode not in ('cozy','competitive') then raise exception 'COZY_INVALID_COMBAT_MODE';end if;
 created:=public.kw_cozy_create_lobby(p_user_id,p_name,p_mode,p_password_hash);
 update public.worlds set combat_mode=p_combat_mode where id=(created->>'id')::uuid;
 return created;
end $$;
revoke all on function public.kw_combat_mode_immutable(),public.kw_cozy_create_with_rules(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.kw_cozy_create_with_rules(uuid,text,text,text,text) to service_role;
commit;
