-- =============================================================
-- KingsWorld #3 — fix robusto do targeting de abandonada (sem record->record)
-- Rodar APOS 44. create-or-replace. Substitui kw_npc_decide_attacks.
--
-- BUG do 44: 'v_target := v_ab' (copia record->record) nao setava o alvo de
-- forma confiavel -> NPC quase nunca mirava abandonada (3 na historia, 0 claim).
-- FIX: alvo em VARIAVEIS ESCALARES (select into v_tsite,...). Expansao 60%:
-- pega a MAIOR abandonada que ele vence; senao jogador mais fraco.
-- =============================================================
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_att record; v_count int:=0;
  v_disp jsonb; v_hero_ok boolean; v_conquest boolean; v_frac numeric; v_att_power numeric;
  v_tsite uuid; v_ttile uuid; v_tcoord text; v_tis_ab boolean; v_tis_ai boolean;
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
    v_att_power := (v_att.militia_count + v_att.shooters_count*1.5 + v_att.scouts_count*0.5 + v_att.machinery_count*4) * 0.95;
    v_tsite := null; v_ttile := null; v_tcoord := null; v_tis_ab := false; v_tis_ai := false;

    if random() < 0.60 then
      select v.site_id, ms.tile_id, (t.q||':'||t.r), true, false
        into v_tsite, v_ttile, v_tcoord, v_tis_ab, v_tis_ai
        from public.villages v
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        where v.world_id=p_world_id and v.owner_world_player_id is null
          and v.origin_kind='abandoned_city' and v.destroyed_at is null
          and ((60 + coalesce((select sum(level) from public.village_structure_states vss
                               where vss.village_site_id=v.site_id),0)*150)
               * case when v.city_class='bastiao' then 1.6
                      when v.city_class='posto_avancado' then 1.2 else 1.0 end) <= v_att_power*0.85
        order by ((60 + coalesce((select sum(level) from public.village_structure_states vss
                               where vss.village_site_id=v.site_id),0)*150)
               * case when v.city_class='bastiao' then 1.6
                      when v.city_class='posto_avancado' then 1.2 else 1.0 end) desc
        limit 1;
    end if;

    if v_tsite is null then
      select v.site_id, ms.tile_id, (t.q||':'||t.r), false, coalesce(wp2.is_ai,false)
        into v_tsite, v_ttile, v_tcoord, v_tis_ab, v_tis_ai
        from public.world_players wp2
        join public.villages v on v.owner_world_player_id=wp2.id
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        join public.world_player_imperial_states ds on ds.world_player_id=wp2.id
        where wp2.world_id=p_world_id and wp2.status='alive' and wp2.id<>v_att.wp_id
        order by (coalesce(ds.militia_count,0) + random()*150) asc
        limit 1;
    end if;

    if v_tsite is null then continue; end if;

    v_hero_ok := v_att.npc_has_hero and (v_att.npc_hero_recovers_at is null or v_att.npc_hero_recovers_at <= now());
    v_conquest := (not v_tis_ab) and v_tis_ai and v_hero_ok
                  and v_att.militia_count >= 100 and random() < (0.4 + v_att.aggr);
    v_frac := case when v_conquest or v_tis_ab then 0.95
                   else greatest(0.4, least(0.85, 0.4 + v_att.aggr)) end;
    v_disp := jsonb_build_object(
       'militia',  floor(v_att.militia_count *v_frac),
       'shooters', floor(v_att.shooters_count*v_frac),
       'scouts',   floor(v_att.scouts_count  *v_frac),
       'machinery',floor(v_att.machinery_count*v_frac));
    insert into public.world_player_map_orders
      (world_id, world_player_id, origin_site_id, target_site_id, target_tile_id, target_coord,
       movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, meta_json)
    values (p_world_id, v_att.wp_id, v_att.origin, v_tsite, v_ttile, v_tcoord,
       'attack','attack', v_disp, 2, now()+interval '90 seconds', jsonb_build_object('with_hero', v_conquest));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('attacks_launched',v_count);
end; $$;
revoke all on function public.kw_npc_decide_attacks from public, authenticated, anon;
grant execute on function public.kw_npc_decide_attacks to service_role;
