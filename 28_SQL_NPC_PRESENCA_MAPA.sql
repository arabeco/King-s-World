-- =============================================================
-- KingsWorld #2 / fatia 2a: NPC visível no mapa
-- Rodar no Supabase SQL Editor APÓS 27. Idempotente.
--
-- Dá a cada NPC alive SEM capital uma `villages` row num `capital_slot` livre.
-- O payload do mundo (boardSites em lib/world-data.ts ~1273) JÁ renderiza
-- villages com owner_world_player_id como reino rival ("Inimigo"/nome do NPC).
-- Por isso NÃO precisa mudar StrategicMap nem o cliente.
--
-- Idempotente: só pega NPC com current_capital_site_id null e slot sem villages.
-- =============================================================

do $$
declare
  v_npc   record;
  v_site  uuid;
  v_class public.city_class;
begin
  for v_npc in
    select wp.id as wp_id, wp.world_id, wp.npc_profile,
           coalesce(u.username, 'IA') as username
    from public.world_players wp
    join public.users u on u.id = wp.user_id
    where wp.is_ai = true
      and wp.status = 'alive'
      and wp.current_capital_site_id is null
  loop
    -- acha um capital_slot ATIVO e livre (sem villages) nesse mundo
    select ms.id into v_site
    from public.map_sites ms
    join public.map_site_profiles mp on mp.site_id = ms.id
    where ms.world_id = v_npc.world_id
      and mp.site_kind = 'capital_slot'
      and ms.status = 'active'
      and not exists (select 1 from public.villages v where v.site_id = ms.id)
    limit 1;

    if v_site is null then
      continue; -- sem slot livre nesse mundo, pula
    end if;

    -- perfil -> city_class (balanced/desconhecido vira neutral)
    v_class := (case v_npc.npc_profile
                  when 'metropole'      then 'metropole'
                  when 'posto_avancado' then 'posto_avancado'
                  when 'bastiao'        then 'bastiao'
                  when 'celeiro'        then 'celeiro'
                  else 'neutral'
                end)::public.city_class;

    insert into public.villages
      (site_id, world_id, owner_world_player_id, founder_world_player_id,
       name, village_type, settlement_role, city_class, city_class_locked,
       origin_kind, terrain_kind, is_original_capital, capital_eligibility_status)
    values
      (v_site, v_npc.world_id, v_npc.wp_id, v_npc.wp_id,
       'Reino ' || v_npc.username, 'capital', 'Capital', v_class, true,
       'claimed_city', 'ashen_fields', true, 'eligible')
    on conflict (site_id) do nothing;

    update public.world_players
      set current_capital_site_id = v_site, updated_at = now()
    where id = v_npc.wp_id;
  end loop;
end $$;

-- =============================================================
-- Conferência (NPCs agora com base no mapa, com coord):
--   select wp.npc_profile, v.name, v.city_class, t.q, t.r
--   from public.world_players wp
--   join public.villages v   on v.owner_world_player_id = wp.id
--   join public.map_sites ms on ms.id = v.site_id
--   join public.map_tiles t  on t.id = ms.tile_id
--   where wp.is_ai = true
--   order by wp.power_score_cached desc
--   limit 15;
-- =============================================================
