-- =============================================================
-- KingsWorld #2 / fatia 2a: NPC visível no mapa (cria base do zero)
-- Rodar no Supabase SQL Editor (projeto King's World wdmrdovkkrgzalnpqdxe!)
-- APÓS 27. Idempotente.
--
-- Descoberta: o mapa compartilhado é quase vazio (poucos tiles) e não tem
-- capital_slot — o mapa jogável é gerado no cliente. MAS o StrategicMap
-- recebe sites={world.boardSites} e desenha; e boardSites (lib/world-data.ts
-- ~1273) renderiza villages com owner como reino rival. Então damos a cada
-- NPC um tile + site + village próprios → ele aparece no mapa.
--
-- Idempotente: só NPC alive com current_capital_site_id null.
-- =============================================================

do $$
declare
  v_world uuid;
  v_biome text;
  v_npc   record;
  v_tile  uuid;
  v_site  uuid;
  v_class public.city_class;
  v_idx   int;
  v_q     int;
  v_r     int;
begin
  for v_world in
    select distinct world_id
    from public.world_players
    where is_ai and status = 'alive' and current_capital_site_id is null
  loop
    -- reusa um biome_type válido já existente no mundo (evita chutar valor)
    select coalesce((select biome_type from public.map_tiles where world_id = v_world limit 1), 'plains')
      into v_biome;

    v_idx := 0;
    for v_npc in
      select wp.id as wp_id, wp.npc_profile, coalesce(u.username, 'IA') as username
      from public.world_players wp
      join public.users u on u.id = wp.user_id
      where wp.world_id = v_world and wp.is_ai and wp.status = 'alive'
        and wp.current_capital_site_id is null
    loop
      -- acha um coord livre (cluster afastado da origem, 12 por faixa)
      loop
        v_q := 4 + (v_idx % 12) * 2;   -- 4..26
        v_r := 4 + (v_idx / 12) * 2;   -- faixas 4,6,8,10...
        v_idx := v_idx + 1;
        exit when not exists (
          select 1 from public.map_tiles t
          where t.world_id = v_world and t.q = v_q and t.r = v_r
        );
        exit when v_idx > 5000; -- trava de segurança
      end loop;

      insert into public.map_tiles (world_id, q, r, biome_type, terrain_type)
      values (v_world, v_q, v_r, v_biome, 'normal')
      returning id into v_tile;

      insert into public.map_sites (world_id, tile_id, site_type, status)
      values (v_world, v_tile, 'village', 'active')
      returning id into v_site;

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
        (v_site, v_world, v_npc.wp_id, v_npc.wp_id,
         'Reino ' || v_npc.username, 'capital', 'Capital', v_class, true,
         'claimed_city', 'ashen_fields', true, 'eligible');

      update public.world_players
        set current_capital_site_id = v_site, updated_at = now()
      where id = v_npc.wp_id;
    end loop;
  end loop;
end $$;

-- =============================================================
-- Conferência: NPCs agora com base no mapa (com coord)
--   select wp.npc_profile, v.name, v.city_class, t.q, t.r
--   from public.world_players wp
--   join public.villages v   on v.owner_world_player_id = wp.id
--   join public.map_sites ms on ms.id = v.site_id
--   join public.map_tiles t  on t.id = ms.tile_id
--   where wp.is_ai = true
--   order by wp.power_score_cached desc limit 15;
-- =============================================================
