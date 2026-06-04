-- =============================================================
-- KingsWorld #2 / 2c-fix: NPCs ganham exército + crescimento de milícia
-- que não arredonda pra 0. Roda no SQL Editor (King's World!) APÓS 30.
--
-- Diagnóstico: max milícia NPC = 50 (valor inicial) — nunca cresceu, então
-- ninguém atingia o limiar de ataque (80). O power_score crescia (soma valores
-- maiores), mas milícia += (v_gain*0.3)::bigint arredondava pra 0.
-- =============================================================

-- 1. One-time: dá exército de combate aos NPCs pra a guerra começar JÁ
update public.world_player_imperial_states s
set militia_count   = 150 + floor(random() * 300)::bigint,   -- 150..450
    shooters_count  = 30  + floor(random() * 80)::bigint,
    scouts_count    = 10  + floor(random() * 30)::bigint,
    updated_at = now()
from public.world_players wp
where wp.id = s.world_player_id and wp.is_ai and wp.status = 'alive';

-- 2. Patch kw_npc_tick: milícia cresce de forma confiável (não arredonda pra 0)
create or replace function public.kw_npc_tick(p_world_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_npc record; v_count int := 0; v_elapsed numeric; v_gain numeric;
begin
  for v_npc in
    select wp.id as wp_id, wp.npc_profile, s.npc_growth_anchor_at,
           coalesce(s.materials_capacity,8000) as mcap, coalesce(s.supplies_capacity,8000) as scap
    from public.world_players wp
    join public.world_player_imperial_states s on s.world_player_id = wp.id
    where wp.world_id = p_world_id and wp.is_ai and wp.status = 'alive'
    for update of s
  loop
    v_elapsed := greatest(0, extract(epoch from (now() - coalesce(v_npc.npc_growth_anchor_at, now()))));
    if v_elapsed <= 0 then continue; end if;
    v_gain := kw_npc_profile_growth(v_npc.npc_profile) * v_elapsed;

    update public.world_player_imperial_states s set
      materials_stock = least(v_npc.mcap, s.materials_stock + (v_gain*1.2)::bigint),
      supplies_stock  = least(v_npc.scap, s.supplies_stock + (v_gain*1.0)::bigint),
      -- milícia: pelo menos +1 por tick com tropa, escala com o ganho
      militia_count   = s.militia_count + greatest(1, round(v_gain*0.5))::bigint,
      npc_growth_anchor_at = now(), updated_at = now()
    where s.world_player_id = v_npc.wp_id;

    update public.world_players set
      power_score_cached = power_score_cached + greatest(1, round(v_gain))::bigint, updated_at = now()
    where id = v_npc.wp_id;

    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('world_id', p_world_id, 'npcs_grown', v_count, 'ticked_at', now());
end;
$$;
revoke all on function public.kw_npc_tick from public, authenticated, anon;
grant execute on function public.kw_npc_tick to service_role;

-- =============================================================
-- Conferência: agora deve ter NPCs aptos (milícia>=80), e em 1-2 min, ataques.
--   select count(*) filter (where militia_count>=80) as aptos, max(militia_count)
--   from public.world_player_imperial_states s
--   join public.world_players wp on wp.id=s.world_player_id where wp.is_ai;
-- Depois de uns minutos:
--   select status, result_code, count(*) from public.world_player_map_orders
--   where movement_type='attack' group by status, result_code;
-- =============================================================
