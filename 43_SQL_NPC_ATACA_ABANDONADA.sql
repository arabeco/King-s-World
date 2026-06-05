-- =============================================================
-- KingsWorld #3 — NPC também DISPUTA cidades abandonadas
-- Rodar no SQL Editor (King's World!) APÓS 42 (precisa do ramo abandonado em
-- kw_resolve_attack). create-or-replace — supera a versão atual (do 40).
--
-- Mantém TUDO que a versão viva fazia:
--   * NPC ataca QUALQUER jogador vivo (NPC ou humano)
--   * humano = só RAIDE (with_hero=false, não conquista/elimina)
--   * NPC vs NPC = conquista possível (with_hero + agressão)
-- ADICIONA:
--   * cidades ABANDONADAS entram na lista de alvos (owner null)
--   * NPC tende a pegar o alvo MAIS FRACO (jogador fraco OU abandonada pequena)
--   * contra abandonada: ocupa (manda 95%, sem herói — o ramo do 42 resolve)
-- =============================================================
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_att record; v_target record; v_count int:=0; v_disp jsonb; v_hero_ok boolean; v_conquest boolean; v_frac numeric;
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
    -- candidatos: (a) vila de jogador vivo  +  (b) cidade abandonada. Pega o mais fraco (+ ruído).
    select * into v_target from (
      -- (a) jogador vivo (NPC ou humano), menos a si mesmo
      select v.site_id as target_site, ms.tile_id as target_tile, (t.q||':'||t.r) as target_coord,
             coalesce(ds.militia_count,0)::numeric as def_proxy,
             coalesce(wp2.is_ai,false) as target_is_ai, false as is_abandoned
        from public.world_players wp2
        join public.villages v on v.owner_world_player_id=wp2.id
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        join public.world_player_imperial_states ds on ds.world_player_id=wp2.id
        where wp2.world_id=p_world_id and wp2.status='alive' and wp2.id<>v_att.wp_id
      union all
      -- (b) cidade abandonada (sem dono); def_proxy = defesa estática do 42
      select v.site_id, ms.tile_id, (t.q||':'||t.r),
             ((60 + coalesce((select sum(level) from public.village_structure_states vss
                              where vss.village_site_id=v.site_id),0)*150)
              * case when v.city_class='bastiao' then 1.6
                     when v.city_class='posto_avancado' then 1.2 else 1.0 end)::numeric,
             false, true
        from public.villages v
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        where v.world_id=p_world_id and v.owner_world_player_id is null
          and v.origin_kind='abandoned_city' and v.destroyed_at is null
    ) cand
    order by (cand.def_proxy + random()*150) asc limit 1;
    if not found then continue; end if;

    v_hero_ok := v_att.npc_has_hero and (v_att.npc_hero_recovers_at is null or v_att.npc_hero_recovers_at <= now());
    -- conquista (with_hero) só contra NPC vivo; humano = raide; abandonada = ocupa (sem herói)
    v_conquest := (not v_target.is_abandoned) and v_target.target_is_ai and v_hero_ok
                  and v_att.militia_count >= 100 and random() < (0.4 + v_att.aggr);
    -- fração enviada: alta p/ conquistar/ocupar; senão raide proporcional à agressão
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

-- =============================================================
-- CONFERÊNCIA (depois de alguns minutos de tick):
--   -- abandonadas que JÁ foram ocupadas (deixaram de ser neutras):
--   select count(*) from public.world_player_map_orders where result_code='claimed';
--   -- abandonadas restantes (devem diminuir com o tempo):
--   select count(*) from public.villages where origin_kind='abandoned_city' and owner_world_player_id is null;
-- =============================================================
