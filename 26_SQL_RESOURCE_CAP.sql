-- =============================================================
-- KingsWorld: teto de recursos (mundo vivo — não acumula infinito)
-- Recurso para de crescer quando enche; quem some desperdiça produção.
-- Rodar no Supabase SQL Editor após o 24_SQL_ANCHOR_RATE_TICK.sql.
-- =============================================================

-- 1. Colunas de teto
alter table public.world_player_imperial_states
  add column if not exists materials_capacity numeric not null default 8000,
  add column if not exists supplies_capacity  numeric not null default 8000;

-- 2. kw_settle_player com teto: clampa entre 0 e capacity (não só em zero)
create or replace function public.kw_settle_player(p_world_player_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_row public.world_player_imperial_states%rowtype;
  v_now timestamptz := now();
  v_mat numeric;
  v_sup numeric;
begin
  select * into v_row from public.world_player_imperial_states
  where world_player_id = p_world_player_id for update;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;

  -- Deriva e clampa entre 0 e o teto (capacity)
  v_mat := least(v_row.materials_capacity,
                 greatest(0, v_row.materials_anchor_value + v_row.materials_rate_per_sec * extract(epoch from (v_now - v_row.materials_anchor_at))));
  v_sup := least(v_row.supplies_capacity,
                 greatest(0, v_row.supplies_anchor_value  + v_row.supplies_rate_per_sec  * extract(epoch from (v_now - v_row.supplies_anchor_at))));

  update public.world_player_imperial_states
  set materials_anchor_value = v_mat, materials_anchor_at = v_now,
      supplies_anchor_value  = v_sup, supplies_anchor_at  = v_now,
      materials_stock = greatest(0, floor(v_mat)::bigint),
      supplies_stock  = greatest(0, floor(v_sup)::bigint),
      updated_at = v_now
  where world_player_id = p_world_player_id;

  return jsonb_build_object(
    'world_player_id', p_world_player_id,
    'materials', v_mat, 'supplies', v_sup,
    'mat_capped', v_mat >= v_row.materials_capacity,
    'sup_capped', v_sup >= v_row.supplies_capacity,
    'settled_at', v_now
  );
end;
$$;
revoke all on function public.kw_settle_player from public, authenticated, anon;
grant execute on function public.kw_settle_player to service_role;
