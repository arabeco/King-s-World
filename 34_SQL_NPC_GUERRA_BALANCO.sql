-- =============================================================
-- KingsWorld #2 / 2c-balanço: guerra pega fogo (mira o fraco + conquista viável)
-- Rodar no SQL Editor (King's World!) APÓS 33. create-or-replace.
--
-- Problema: alvos aleatórios + defensor com vantagem = atacante nunca vence.
-- Fix: NPC mira o rival mais FRACO (com ruído) → forte vence o fraco com
-- baixa perda → sobreviventes altos → conquista acontece. Só muda o alvo.
-- (kw_resolve_attack/garrison continuam do 33; ajustar depois se preciso.)
-- =============================================================

-- DECIDE: mira o mais fraco -----------------------------------------------
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_att record; v_target record; v_count int:=0; v_disp jsonb; v_hero_ok boolean; v_conquest boolean; v_frac numeric;
begin
  for v_att in
    select wp.id as wp_id, wp.current_capital_site_id as origin, s.militia_count,s.shooters_count,s.scouts_count,s.machinery_count,
           wp.npc_has_hero, wp.npc_hero_recovers_at
    from public.world_players wp join public.world_player_imperial_states s on s.world_player_id=wp.id
    where wp.world_id=p_world_id and wp.is_ai and wp.status='alive'
      and wp.current_capital_site_id is not null and s.militia_count>=80 and random()<0.15
      and not exists (select 1 from public.world_player_map_orders o where o.world_player_id=wp.id and o.status in ('traveling','resolving'))
  loop
    -- alvo: rival mais FRACO (militia baixa), com ruído pra não focarem todos no mesmo
    select v.site_id as target_site, ms.tile_id as target_tile, (t.q||':'||t.r) as target_coord into v_target
      from public.world_players wp2
      join public.villages v on v.owner_world_player_id=wp2.id
      join public.map_sites ms on ms.id=v.site_id
      join public.map_tiles t on t.id=ms.tile_id
      join public.world_player_imperial_states ds on ds.world_player_id=wp2.id
      where wp2.world_id=p_world_id and wp2.is_ai and wp2.status='alive' and wp2.id<>v_att.wp_id
      order by (ds.militia_count + random()*150) asc limit 1;
    if not found then continue; end if;
    v_hero_ok := v_att.npc_has_hero and (v_att.npc_hero_recovers_at is null or v_att.npc_hero_recovers_at <= now());
    v_conquest := v_hero_ok and v_att.militia_count >= 200 and random() < 0.6;
    v_frac := case when v_conquest then 0.95 else 0.6 end;
    v_disp := jsonb_build_object('militia',floor(v_att.militia_count*v_frac),'shooters',floor(v_att.shooters_count*v_frac),
                                 'scouts',floor(v_att.scouts_count*v_frac),'machinery',floor(v_att.machinery_count*v_frac));
    insert into public.world_player_map_orders
      (world_id, world_player_id, origin_site_id, target_site_id, target_tile_id, target_coord,
       movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, meta_json)
    values (p_world_id, v_att.wp_id, v_att.origin, v_target.target_site, v_target.target_tile, v_target.target_coord,
       'attack', 'attack', v_disp, 2, now()+interval '90 seconds', jsonb_build_object('with_hero', v_conquest));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('attacks_launched',v_count);
end; $$;
revoke all on function public.kw_npc_decide_attacks from public, authenticated, anon;
grant execute on function public.kw_npc_decide_attacks to service_role;
