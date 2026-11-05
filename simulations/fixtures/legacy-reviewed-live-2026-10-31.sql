-- Reviewed from project wdmrdovkkrgzalnpqdxe on 2026-10-31. Test fixture only.
-- Bodies are preserved in production; migration 59 only changes function configuration.
CREATE OR REPLACE FUNCTION public.enforce_capital_home_troops()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_owner_id uuid;
  v_village_type public.village_type;
  v_capital_mode boolean;
begin
  if new.stationing_type <> 'home' then
    return new;
  end if;

  select v.owner_world_player_id, v.village_type, w.capital_troop_pool_mode
    into v_owner_id, v_village_type, v_capital_mode
  from public.villages v
  join public.worlds w on w.id = v.world_id
  where v.site_id = new.site_id
    and v.destroyed_at is null
  limit 1;

  if v_capital_mode and v_village_type <> 'capital' then
    raise exception 'Modo tropa-central ativo: apenas capital pode manter tropas home.';
  end if;

  if v_owner_id is not null and new.owner_world_player_id <> v_owner_id then
    raise exception 'Owner da stack difere do owner da aldeia.';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.is_friendly_target_site(p_actor_world_player_id uuid, p_target_site_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_actor_tribe_id uuid;
  v_target_owner_id uuid;
  v_target_tribe_id uuid;
begin
  select wp.tribe_id into v_actor_tribe_id
  from public.world_players wp
  where wp.id = p_actor_world_player_id;

  select v.owner_world_player_id, wp.tribe_id
    into v_target_owner_id, v_target_tribe_id
  from public.villages v
  left join public.world_players wp on wp.id = v.owner_world_player_id
  where v.site_id = p_target_site_id
    and v.destroyed_at is null
  limit 1;

  if v_target_owner_id is not null then
    if v_target_owner_id = p_actor_world_player_id then
      return true;
    end if;
    if v_actor_tribe_id is not null and v_target_tribe_id = v_actor_tribe_id then
      return true;
    end if;
    return false;
  end if;

  select tc.tribe_id into v_target_tribe_id
  from public.tribe_citadels tc
  where tc.site_id = p_target_site_id
    and tc.status in ('planned', 'building', 'active')
  limit 1;

  if v_target_tribe_id is not null and v_actor_tribe_id = v_target_tribe_id then
    return true;
  end if;

  return false;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.kw_npc_profile_growth(p_profile text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_profile
    when 'metropole' then 0.55 when 'posto_avancado' then 0.50
    when 'bastiao' then 0.45 when 'celeiro' then 0.50 else 0.48 end;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_donation_only_resource_movement()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_actor_world_player_id uuid;
  v_target_site_id uuid;
  v_movement_type public.movement_type;
  v_support_donation_only boolean;
begin
  select m.actor_world_player_id, m.target_site_id, m.movement_type, w.support_donation_only
    into v_actor_world_player_id, v_target_site_id, v_movement_type, v_support_donation_only
  from public.movements m
  join public.worlds w on w.id = m.world_id
  where m.id = new.movement_id
  limit 1;

  if v_movement_type in ('support', 'transport', 'supply')
     and v_support_donation_only
     and v_target_site_id is not null
     and not public.is_friendly_target_site(v_actor_world_player_id, v_target_site_id) then
    raise exception 'Movimento de apoio/recurso invalido: alvo nao amigavel.';
  end if;

  return new;
end;
$function$
;