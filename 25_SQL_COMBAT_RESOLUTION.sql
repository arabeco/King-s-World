-- =============================================================
-- KingsWorld: resolução de combate no servidor (#2)
-- RPC kw_resolve_arrived_orders — chamada pelo kw_world_tick
-- =============================================================

-- Tipo de resultado de combate gravado na ordem
-- (resultado completo fica em meta_json)

-- 1. RPC principal: resolve ordens chegadas de um mundo
-- -------------------------------------------------------
create or replace function public.kw_resolve_arrived_orders(
  p_world_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order   record;
  v_count   int := 0;
  v_errors  int := 0;
begin
  -- Processa todas as ordens chegadas deste mundo
  for v_order in
    select id, world_player_id, target_site_id, origin_site_id,
           movement_type, command_action, troop_dispatch_json, meta_json
    from public.world_player_map_orders
    where world_id      = p_world_id
      and status        = 'traveling'
      and arrival_at   <= now()
    order by arrival_at asc
    for update skip locked   -- skip ordens já sendo processadas
  loop
    begin
      perform public.kw_resolve_single_order(v_order.id);
      v_count := v_count + 1;
    exception when others then
      -- Marca como falha mas não para o loop
      update public.world_player_map_orders
      set status      = 'failed',
          result_code = sqlerrm,
          resolved_at = now(),
          updated_at  = now()
      where id = v_order.id;
      v_errors := v_errors + 1;
    end;
  end loop;

  return jsonb_build_object(
    'world_id',  p_world_id,
    'resolved',  v_count,
    'errors',    v_errors
  );
end;
$$;

revoke all on function public.kw_resolve_arrived_orders from public, authenticated, anon;
grant execute on function public.kw_resolve_arrived_orders to service_role;


-- 2. RPC de resolução de uma única ordem (delegada ao tipo)
-- ----------------------------------------------------------
create or replace function public.kw_resolve_single_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order  public.world_player_map_orders%rowtype;
begin
  select * into v_order
  from public.world_player_map_orders
  where id = p_order_id
  for update;

  if not found then return; end if;
  if v_order.status <> 'traveling' then return; end if;

  case v_order.command_action
    when 'attack'  then perform public.kw_resolve_attack(p_order_id);
    when 'build'   then perform public.kw_resolve_build(p_order_id);
    when 'explore' then perform public.kw_resolve_explore(p_order_id);
    else
      -- Tipo não suportado ainda — marca como completed sem efeito
      update public.world_player_map_orders
      set status      = 'completed',
          result_code = 'unsupported_action',
          resolved_at = now(),
          updated_at  = now()
      where id = p_order_id;
  end case;
end;
$$;

revoke all on function public.kw_resolve_single_order from public, authenticated, anon;
grant execute on function public.kw_resolve_single_order to service_role;


-- 3. Placeholder para ataque (lógica real vem da Edge Function)
-- -------------------------------------------------------------
-- A resolução de combate real usa processKingsWorldCombat (TypeScript).
-- Esta RPC é chamada pela Edge Function após calcular o resultado.
create or replace function public.kw_resolve_attack(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_order public.world_player_map_orders%rowtype;
begin
  select * into v_order
  from public.world_player_map_orders
  where id = p_order_id;

  -- Marca como 'pending_resolution' — Edge Function vai buscar e resolver
  update public.world_player_map_orders
  set status      = 'pending_resolution',
      updated_at  = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.kw_resolve_attack from public, authenticated, anon;
grant execute on function public.kw_resolve_attack to service_role;


-- 4. Build: resolve expansão/construção no mapa
-- -----------------------------------------------
create or replace function public.kw_resolve_build(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Por agora marca como completed — lógica de posse de tile a implementar
  update public.world_player_map_orders
  set status      = 'completed',
      result_code = 'build_arrived',
      resolved_at = now(),
      updated_at  = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.kw_resolve_build from public, authenticated, anon;
grant execute on function public.kw_resolve_build to service_role;


-- 5. Explore: resolve exploração
-- --------------------------------
create or replace function public.kw_resolve_explore(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.world_player_map_orders
  set status      = 'completed',
      result_code = 'explore_arrived',
      resolved_at = now(),
      updated_at  = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.kw_resolve_explore from public, authenticated, anon;
grant execute on function public.kw_resolve_explore to service_role;


-- 6. Hookear no kw_world_tick
-- ----------------------------
create or replace function public.kw_world_tick(
  p_world_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_world    public.worlds%rowtype;
  v_player   record;
  v_count    int := 0;
  v_orders   jsonb;
begin
  select * into v_world
  from public.worlds
  where id = p_world_id
  for update;

  if not found then raise exception 'WORLD_NOT_FOUND'; end if;
  if v_world.status = 'finalized' then
    return jsonb_build_object('skipped', true, 'reason', 'world_finalized');
  end if;

  -- Settle recursos de todos os jogadores vivos
  for v_player in
    select id from public.world_players
    where world_id = p_world_id
      and status = 'alive'
  loop
    perform public.kw_settle_player(v_player.id);
    v_count := v_count + 1;
  end loop;

  -- Resolve ordens chegadas (marchas, ataques, builds)
  v_orders := public.kw_resolve_arrived_orders(p_world_id);

  return jsonb_build_object(
    'world_id',       p_world_id,
    'players_settled', v_count,
    'orders',         v_orders,
    'ticked_at',      now()
  );
end;
$$;

revoke all on function public.kw_world_tick from public, authenticated, anon;
grant execute on function public.kw_world_tick to service_role;
