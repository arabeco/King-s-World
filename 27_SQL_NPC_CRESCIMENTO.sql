-- =============================================================
-- KingsWorld #2 / fatia 2b: NPCs crescem de verdade
-- Rodar no Supabase SQL Editor APÓS 24/25/26. Idempotente.
--
-- O que faz:
--  1. Cria colunas is_ai/npc_profile em world_players (o npc-fill.ts já as
--     usa, mas NUNCA foram criadas em migração — bug latente).
--  2. Garante imperial_state para todo NPC alive (backfill).
--  3. kw_npc_tick: cada NPC cresce por perfil, idempotente por âncora.
--  4. Pendura kw_npc_tick dentro do kw_world_tick (mesmo cron).
--
-- Resultado visível: reinos IA sobem no ranking (power_score) ao longo do
-- tempo. Presença no mapa (2a), agressão (2c) e cidades abandonadas (#3) são
-- arquivos seguintes.
-- =============================================================

-- 1. Colunas que o npc-fill.ts usa mas não existiam em migração ----------
alter table public.world_players
  add column if not exists is_ai boolean not null default false,
  add column if not exists npc_profile text;

-- âncora de crescimento do NPC (idempotência por tempo, igual kw_settle_player)
alter table public.world_player_imperial_states
  add column if not exists npc_growth_anchor_at timestamptz;

-- 2. Backfill: todo NPC alive precisa de imperial_state ------------------
insert into public.world_player_imperial_states
  (world_player_id, world_id, materials_stock, supplies_stock, militia_count, npc_growth_anchor_at)
select wp.id, wp.world_id, 200, 200, 50, now()
from public.world_players wp
where wp.is_ai = true and wp.status = 'alive'
  and not exists (
    select 1 from public.world_player_imperial_states s where s.world_player_id = wp.id
  )
on conflict (world_player_id) do nothing;

update public.world_player_imperial_states s
set npc_growth_anchor_at = coalesce(s.npc_growth_anchor_at, now())
from public.world_players wp
where wp.id = s.world_player_id and wp.is_ai = true;

-- 3. Taxa de crescimento por perfil (pontos de poder/seg) — CALIBRAR -----
create or replace function public.kw_npc_profile_growth(p_profile text)
returns numeric language sql immutable as $$
  select case p_profile
    when 'metropole'      then 0.55
    when 'posto_avancado' then 0.50
    when 'bastiao'        then 0.45
    when 'celeiro'        then 0.50
    else 0.48 -- balanced / desconhecido
  end;
$$;

-- 4. kw_npc_tick: cresce cada NPC do mundo por perfil, idempotente ------
create or replace function public.kw_npc_tick(p_world_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_npc     record;
  v_count   int := 0;
  v_elapsed numeric;
  v_gain    numeric;
begin
  for v_npc in
    select wp.id as wp_id, wp.npc_profile,
           s.npc_growth_anchor_at,
           coalesce(s.materials_capacity, 8000) as mcap,
           coalesce(s.supplies_capacity, 8000) as scap
    from public.world_players wp
    join public.world_player_imperial_states s on s.world_player_id = wp.id
    where wp.world_id = p_world_id and wp.is_ai = true and wp.status = 'alive'
    for update of s
  loop
    v_elapsed := greatest(0, extract(epoch from (now() - coalesce(v_npc.npc_growth_anchor_at, now()))));
    if v_elapsed <= 0 then continue; end if;

    -- pontos de poder ganhos no período (re-âncora: não acumula delta perdido)
    v_gain := kw_npc_profile_growth(v_npc.npc_profile) * v_elapsed;

    update public.world_player_imperial_states s set
      materials_stock      = least(v_npc.mcap, s.materials_stock + (v_gain * 1.2)::bigint),
      supplies_stock       = least(v_npc.scap, s.supplies_stock + (v_gain * 1.0)::bigint),
      militia_count        = s.militia_count + (v_gain * 0.3)::bigint,
      npc_growth_anchor_at = now(),
      updated_at           = now()
    where s.world_player_id = v_npc.wp_id;

    update public.world_players
      set power_score_cached = power_score_cached + greatest(0, v_gain::bigint),
          updated_at = now()
    where id = v_npc.wp_id;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('world_id', p_world_id, 'npcs_grown', v_count, 'ticked_at', now());
end;
$$;

revoke all on function public.kw_npc_tick from public, authenticated, anon;
grant execute on function public.kw_npc_tick to service_role;

-- 5. Pendurar o NPC tick dentro do tick do mundo ------------------------
-- (recria kw_world_tick = corpo do 25_SQL + chamada do kw_npc_tick)
create or replace function public.kw_world_tick(p_world_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_world  public.worlds%rowtype;
  v_player record;
  v_count  int := 0;
  v_orders jsonb;
  v_npc    jsonb;
begin
  select * into v_world from public.worlds where id = p_world_id for update;
  if not found then raise exception 'WORLD_NOT_FOUND'; end if;
  if v_world.status = 'finalized' then
    return jsonb_build_object('skipped', true, 'reason', 'world_finalized');
  end if;

  -- Settle recursos de todos os jogadores vivos (humanos e NPC)
  for v_player in
    select id from public.world_players
    where world_id = p_world_id and status = 'alive'
  loop
    perform public.kw_settle_player(v_player.id);
    v_count := v_count + 1;
  end loop;

  -- NPCs crescem por perfil  [NOVO — fatia 2b]
  v_npc := public.kw_npc_tick(p_world_id);

  -- Resolve ordens chegadas (marchas, ataques, builds)
  v_orders := public.kw_resolve_arrived_orders(p_world_id);

  return jsonb_build_object(
    'world_id',        p_world_id,
    'players_settled', v_count,
    'npc',             v_npc,
    'orders',          v_orders,
    'ticked_at',       now()
  );
end;
$$;

revoke all on function public.kw_world_tick from public, authenticated, anon;
grant execute on function public.kw_world_tick to service_role;

-- =============================================================
-- Conferência (deve crescer entre duas chamadas com intervalo):
--   select id, npc_profile, power_score_cached from public.world_players
--   where is_ai = true order by power_score_cached desc limit 10;
-- Idempotência (rodar 2x seguidas ~ sem intervalo não dobra):
--   select public.kw_npc_tick('<world_id>'); select public.kw_npc_tick('<world_id>');
-- =============================================================
