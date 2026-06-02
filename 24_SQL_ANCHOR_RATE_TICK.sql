-- =============================================================
-- KingsWorld: modelo âncora+taxa para materiais e suprimentos
-- Sub-projeto #1 — esqueleto andante (servidor fonte da verdade)
-- Rodar no Supabase SQL Editor.
-- =============================================================

-- 1. Colunas de âncora em world_player_imperial_states
-- ------------------------------------------------------
alter table public.world_player_imperial_states
  add column if not exists materials_anchor_value numeric not null default 0,
  add column if not exists materials_anchor_at    timestamptz not null default now(),
  add column if not exists materials_rate_per_sec numeric not null default 0,
  add column if not exists supplies_anchor_value  numeric not null default 0,
  add column if not exists supplies_anchor_at     timestamptz not null default now(),
  add column if not exists supplies_rate_per_sec  numeric not null default 0;

-- 2. Backfill: âncora = stock atual, anchor_at = now, rate = 0 (calibrar depois)
-- ---------------------------------------------------------------------------------
update public.world_player_imperial_states
set
  materials_anchor_value = materials_stock,
  materials_anchor_at    = now(),
  materials_rate_per_sec = 0,
  supplies_anchor_value  = supplies_stock,
  supplies_anchor_at     = now(),
  supplies_rate_per_sec  = 0
where materials_anchor_value = 0 and materials_anchor_at <= now();

-- 3. RPC kw_settle_player — re-ancora um jogador (idempotente, locked)
-- ----------------------------------------------------------------------
create or replace function public.kw_settle_player(
  p_world_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row    public.world_player_imperial_states%rowtype;
  v_now    timestamptz := now();
  v_mat    numeric;
  v_sup    numeric;
  v_mat_elapsed numeric;
  v_sup_elapsed numeric;
begin
  -- Lock na linha do jogador
  select * into v_row
  from public.world_player_imperial_states
  where world_player_id = p_world_player_id
  for update;

  if not found then
    raise exception 'PLAYER_NOT_FOUND';
  end if;

  -- Deriva valores actuais (clamp em 0)
  v_mat_elapsed := extract(epoch from (v_now - v_row.materials_anchor_at));
  v_sup_elapsed := extract(epoch from (v_now - v_row.supplies_anchor_at));

  v_mat := greatest(0, v_row.materials_anchor_value + v_row.materials_rate_per_sec * v_mat_elapsed);
  v_sup := greatest(0, v_row.supplies_anchor_value  + v_row.supplies_rate_per_sec  * v_sup_elapsed);

  -- Re-ancora (settle) + espelha em *_stock
  update public.world_player_imperial_states
  set
    materials_anchor_value = v_mat,
    materials_anchor_at    = v_now,
    supplies_anchor_value  = v_sup,
    supplies_anchor_at     = v_now,
    -- espelho legível
    materials_stock        = greatest(0, floor(v_mat)::bigint),
    supplies_stock         = greatest(0, floor(v_sup)::bigint),
    updated_at             = v_now
  where world_player_id = p_world_player_id;

  return jsonb_build_object(
    'world_player_id',    p_world_player_id,
    'materials',          v_mat,
    'supplies',           v_sup,
    'settled_at',         v_now
  );
end;
$$;

revoke all on function public.kw_settle_player from public, authenticated, anon;
grant execute on function public.kw_settle_player to service_role;


-- 4. RPC kw_world_tick — tick do mundo (chama settle em todos os jogadores vivos)
-- ---------------------------------------------------------------------------------
create or replace function public.kw_world_tick(
  p_world_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_world   public.worlds%rowtype;
  v_player  record;
  v_count   int := 0;
begin
  -- Lock no mundo (serializa tick vs. tick)
  select * into v_world
  from public.worlds
  where id = p_world_id
  for update;

  if not found then
    raise exception 'WORLD_NOT_FOUND';
  end if;

  if v_world.status = 'finalized' then
    return jsonb_build_object('skipped', true, 'reason', 'world_finalized');
  end if;

  -- Settle cada jogador vivo
  for v_player in
    select id from public.world_players
    where world_id = p_world_id
      and status = 'alive'
  loop
    perform public.kw_settle_player(v_player.id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'world_id',   p_world_id,
    'players',    v_count,
    'ticked_at',  now()
  );
end;
$$;

revoke all on function public.kw_world_tick from public, authenticated, anon;
grant execute on function public.kw_world_tick to service_role;


-- 5. RPC kw_apply_resource_delta — gastar/ganhar recurso com settle prévio
-- -------------------------------------------------------------------------
-- Padrão: settle até agora → aplica delta → clamp em 0.
-- Usar antes de qualquer ação que consome materiais ou suprimentos.
create or replace function public.kw_apply_resource_delta(
  p_world_player_id     uuid,
  p_materials_delta     numeric default 0,
  p_supplies_delta      numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settled jsonb;
  v_mat     numeric;
  v_sup     numeric;
begin
  -- Settle até agora (já faz lock)
  v_settled := public.kw_settle_player(p_world_player_id);
  v_mat     := (v_settled->>'materials')::numeric;
  v_sup     := (v_settled->>'supplies')::numeric;

  -- Valida se tem saldo suficiente
  if p_materials_delta < 0 and (v_mat + p_materials_delta) < 0 then
    raise exception 'INSUFFICIENT_MATERIALS';
  end if;
  if p_supplies_delta < 0 and (v_sup + p_supplies_delta) < 0 then
    raise exception 'INSUFFICIENT_SUPPLIES';
  end if;

  -- Aplica delta e re-ancora
  v_mat := greatest(0, v_mat + p_materials_delta);
  v_sup := greatest(0, v_sup + p_supplies_delta);

  update public.world_player_imperial_states
  set
    materials_anchor_value = v_mat,
    materials_anchor_at    = now(),
    supplies_anchor_value  = v_sup,
    supplies_anchor_at     = now(),
    materials_stock        = greatest(0, floor(v_mat)::bigint),
    supplies_stock         = greatest(0, floor(v_sup)::bigint),
    updated_at             = now()
  where world_player_id = p_world_player_id;

  return jsonb_build_object(
    'world_player_id', p_world_player_id,
    'materials',       v_mat,
    'supplies',        v_sup,
    'applied_at',      now()
  );
end;
$$;

revoke all on function public.kw_apply_resource_delta from public, authenticated, anon;
grant execute on function public.kw_apply_resource_delta to service_role;


-- 6. pg_cron: tick a cada 1 minuto para mundos running
-- -----------------------------------------------------
-- Requer extensão pg_cron habilitada no Supabase (plano pago).
-- Roda uma query que descobre mundos running e faz tick em cada um.

select cron.schedule(
  'kw-world-tick',
  '* * * * *',
  $$
    select public.kw_world_tick(id)
    from public.worlds
    where status = 'running'
  $$
);

-- Para ver os jobs agendados:
-- select * from cron.job;

-- Para remover se precisar recriar:
-- select cron.unschedule('kw-world-tick');
