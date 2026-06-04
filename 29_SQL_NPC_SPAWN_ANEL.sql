-- =============================================================
-- KingsWorld #2 / 2a-tuning: re-spawn dos NPCs no ANEL EXTERNO
-- Rodar no Supabase SQL Editor (projeto King's World!) APÓS 28. Idempotente-ish
-- (re-posiciona os tiles de capital dos NPCs; rodar de novo só re-aleatoriza).
--
-- Design: aleatório, longe do centro (anel de raio 18..30), com distância
-- mínima entre reinos (não aglomerar). Centro (0,0) = jogador.
-- =============================================================

do $$
declare
  v_rec      record;
  v_q        int;
  v_r        int;
  v_angle    double precision;
  v_radius   double precision;
  v_try      int;
  v_ok       boolean;
  v_min_dist int := 4;    -- distância mínima (hex) entre quaisquer reinos
  v_r_inner  int := 18;   -- raio interno do anel (longe do centro)
  v_r_outer  int := 30;   -- raio externo do anel
begin
  for v_rec in
    select t.id as tile_id, t.world_id
    from public.world_players wp
    join public.villages v   on v.owner_world_player_id = wp.id
    join public.map_sites ms on ms.id = v.site_id
    join public.map_tiles t  on t.id = ms.tile_id
    where wp.is_ai = true
    order by random()          -- ordem aleatória de colocação
  loop
    v_ok := false;
    for v_try in 1..300 loop
      v_angle  := random() * 2 * pi();
      v_radius := v_r_inner + random() * (v_r_outer - v_r_inner);
      v_q := round(v_radius * cos(v_angle));
      v_r := round(v_radius * sin(v_angle));

      -- rejeita se ficar perto demais de QUALQUER outro tile (não aglomerar)
      if not exists (
        select 1 from public.map_tiles t2
        where t2.world_id = v_rec.world_id
          and t2.id <> v_rec.tile_id
          and ((abs(t2.q - v_q) + abs((t2.q + t2.r) - (v_q + v_r)) + abs(t2.r - v_r)) / 2) < v_min_dist
      ) then
        v_ok := true;
        exit;
      end if;
    end loop;

    if v_ok then
      update public.map_tiles set q = v_q, r = v_r where id = v_rec.tile_id;
    end if;
  end loop;
end $$;

-- =============================================================
-- Conferência (distribuição: raio e ângulo variados, sem cluster):
--   select wp.npc_profile, t.q, t.r,
--          round(sqrt(t.q*t.q + t.r*t.r)) as dist_aprox_centro
--   from public.world_players wp
--   join public.villages v on v.owner_world_player_id = wp.id
--   join public.map_sites ms on ms.id = v.site_id
--   join public.map_tiles t on t.id = ms.tile_id
--   where wp.is_ai = true order by dist_aprox_centro limit 20;
-- =============================================================
