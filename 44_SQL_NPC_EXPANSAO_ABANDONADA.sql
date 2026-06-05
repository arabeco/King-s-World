-- =============================================================
-- KingsWorld #3 — fix: NPC realmente DISPUTA abandonada (impulso de expansão)
-- Rodar no SQL Editor (King's World!) APÓS 43. create-or-replace.
--
-- BUG do 43: alvo escolhido por "o mais fraco de todos" (def_proxy asc). Como há
-- dezenas de vilas de jogadores com milícia baixa, a abandonada (defesa >=810)
-- nunca era a mais fraca -> nunca escolhida. claimed ficava 0.
--
-- FIX: 45% das vezes o NPC busca EXPANSÃO — escolhe a MAIOR cidade abandonada
-- que ele ainda consegue VENCER (def <= 0.85*poder dele). Senão (ou se não há
-- abandonada viável) cai no comportamento normal: raide/conquista no jogador
-- mais fraco. Mantém: humano=raide, NPC=conquista, abandonada=ocupa (95%).
-- =============================================================
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_att record; v_target record; v_ab record; v_count int:=0;
  v_disp jsonb; v_hero_ok boolean; v_conquest boolean; v_frac numeric; v_att_power numeric;
begin
  for v_att in
    select wp.id as wp_id, wp.current_capital_site_id as origin,
           s.militia_count,s.shooters_count,s.scouts_count,s.machinery_count,
           wp.npc_has_hero, wp.npc_hero_recovers_at, coalesce(wp.npc_aggression,0.15) as aggr
    from public.world_players wp join public.world_player_imperial_states s on s.world_player_id=wp.id
    where wp.world_id=p_world_id and wp.is_ai and wp.status='alive'
      and wp.current_capital_site_id is not null and s.militia_count>=80
      and random() < coalesce(wp.npc_aggression,0.15)
      and not exists (select 1 from public.world_player_map_orders o
                      where o.world_player_id=wp.id and o.status in ('traveling','resolving'))
  loop
    -- poder do atacante (com os 95% que ele tende a mandar), sem skill (heurística)
    v_att_power := (v_att.militia_count + v_att.shooters_count*1.5 + v_att.scouts_count*0.5 + v_att.machinery_count*4) * 0.95;

    -- DEFAULT: jogador vivo mais fraco (NPC ou humano), menos a si mesmo
    select v.site_id as target_site, ms.tile_id as target_tile, (t.q||':'||t.r) as target_coord,
           coalesce(ds.militia_count,0)::numeric as def_proxy,
           coalesce(wp2.is_ai,false) as target_is_ai, false as is_abandoned
      into v_target
      from public.world_players wp2
      join public.villages v on v.owner_world_player_id=wp2.id
      join public.map_sites ms on ms.id=v.site_id
      join public.map_tiles t on t.id=ms.tile_id
      join public.world_player_imperial_states ds on ds.world_player_id=wp2.id
      where wp2.world_id=p_world_id and wp2.status='alive' and wp2.id<>v_att.wp_id
      order by (coalesce(ds.militia_count,0) + random()*150) asc limit 1;

    -- EXPANSÃO (45%): prefere a MAIOR abandonada que ele consegue vencer
    if random() < 0.45 then
      select v.site_id as target_site, ms.tile_id as target_tile, (t.q||':'||t.r) as target_coord,
             ((60 + coalesce((select sum(level) from public.village_structure_states vss
                              where vss.village_site_id=v.site_id),0)*150)
              * case when v.city_class='bastiao' then 1.6
                     when v.city_class='posto_avancado' then 1.2 else 1.0 end)::numeric as def_proxy,
             false as target_is_ai, true as is_abandoned
        into v_ab
        from public.villages v
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        where v.world_id=p_world_id and v.owner_world_player_id is null
          and v.origin_kind='abandoned_city' and v.destroyed_at is null
          and ((60 + coalesce((select sum(level) from public.village_structure_states vss
                               where vss.village_site_id=v.site_id),0)*150)
               * case when v.city_class='bastiao' then 1.6
                      when v.city_class='posto_avancado' then 1.2 else 1.0 end) <= v_att_power*0.85
        order by def_proxy desc limit 1;
      if found then v_target := v_ab; end if;
    end if;

    if v_target.target_site is null then continue; end if;

    v_hero_ok := v_att.npc_has_hero and (v_att.npc_hero_recovers_at is null or v_att.npc_hero_recovers_at <= now());
    -- conquista (with_hero) só contra NPC vivo; humano = raide; abandonada = ocupa (sem herói)
    v_conquest := (not v_target.is_abandoned) and v_target.target_is_ai and v_hero_ok
                  and v_att.militia_count >= 100 and random() < (0.4 + v_att.aggr);
    v_frac := case when v_conquest or v_target.is_abandoned then 0.95
                   else greatest(0.4, least(0.85, 0.4 + v_att.aggr)) end;
    v_disp := jsonb_build_object(
       'militia',  floor(v_att.militia_count *v_frac),
       'shooters', floor(v_att.shooters_count*v_frac),
       'scouts',   floor(v_att.scouts_count  *v_frac),
       'machinery',floor(v_att.machinery_count*v_frac));
    insert into public.world_player_map_orders
      (world_id, world_player_id, origin_site_id, target_site_id, target_tile_id, target_coord,
       movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, meta_json)
    values (p_world_id, v_att.wp_id, v_att.origin, v_target.target_site, v_target.target_tile, v_target.target_coord,
       'attack','attack', v_disp, 2, now()+interval '90 seconds', jsonb_build_object('with_hero', v_conquest));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('attacks_launched',v_count);
end; $$;
revoke all on function public.kw_npc_decide_attacks from public, authenticated, anon;
grant execute on function public.kw_npc_decide_attacks to service_role;
