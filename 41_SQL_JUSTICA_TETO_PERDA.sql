-- =============================================================
-- KingsWorld #2 / justiça: ALL-IN liberado, mas SEM eliminar a aldeia num golpe
-- Rodar no SQL Editor (King's World!) APÓS 39/40. create-or-replace.
-- CONCEITO (corrigido pelo dono): pode dar all-in! O problema NÃO é comprometer
-- tudo — é um único ataque ELIMINAR a aldeia inteira do defensor de uma vez.
--   * ATACANTE: SEM teto (cap 1.0) -> all-in pode perder 100%. Risco real.
--   * DEFENSOR: TETO 50% (cap 0.5) -> um ataque tira no máx metade das tropas;
--     derrubar de vez exige PRESSÃO REPETIDA (cerco) ou conquista por herói.
-- Não quebra conquista (captura é por sobreviventes >= garrison, não por zerar).
-- =============================================================
create or replace function public.kw_resolve_attack(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_order public.world_player_map_orders%rowtype; v_def_owner uuid; v_class text; v_disp jsonb;
  v_am numeric; v_as numeric; v_asc numeric; v_amac numeric;
  v_att_power numeric; v_def_power numeric; v_def_mult numeric; v_att_skill numeric; v_def_skill numeric;
  v_att_loss numeric; v_def_loss numeric; v_winner text; v_def record;
  v_loot_mat bigint; v_loot_sup bigint;
  v_with_hero boolean; v_city_size int; v_survivors numeric; v_required numeric; v_def_cap uuid;
  c_garrison constant numeric := 1;
  c_att_loss_cap constant numeric := 1.0;  -- ATACANTE: all-in liberado (pode perder tudo)
  c_def_loss_cap constant numeric := 0.5;  -- DEFENSOR: max 50% por golpe (anti-eliminação)
begin
  select * into v_order from public.world_player_map_orders where id=p_order_id for update;
  if not found then return; end if;
  select owner_world_player_id, city_class into v_def_owner, v_class from public.villages where site_id=v_order.target_site_id;
  v_with_hero := coalesce((v_order.meta_json->>'with_hero')::boolean, false);
  v_att_skill := coalesce((select npc_skill from public.world_players where id=v_order.world_player_id),1.0);
  v_disp := coalesce(v_order.troop_dispatch_json,'{}'::jsonb);
  v_am:=coalesce((v_disp->>'militia')::numeric,0); v_as:=coalesce((v_disp->>'shooters')::numeric,0);
  v_asc:=coalesce((v_disp->>'scouts')::numeric,0); v_amac:=coalesce((v_disp->>'machinery')::numeric,0);
  v_att_power := (v_am*1 + v_as*1.5 + v_asc*0.5 + v_amac*4) * v_att_skill;
  if v_att_power <= 0 then
    update public.world_player_map_orders set status='resolved',result_code='no_army',resolved_at=now() where id=p_order_id; return;
  end if;
  if v_def_owner is null then v_def_power := 60;
  else
    select militia_count,shooters_count,scouts_count,machinery_count,materials_stock,supplies_stock
      into v_def from public.world_player_imperial_states where world_player_id=v_def_owner for update;
    v_def_skill := coalesce((select npc_skill from public.world_players where id=v_def_owner),1.0);
    v_def_mult := case when v_class='bastiao' then 1.6 when v_class='posto_avancado' then 1.2 else 1.0 end;
    v_def_power := (coalesce(v_def.militia_count,0)*1+coalesce(v_def.shooters_count,0)*1.5
                  +coalesce(v_def.scouts_count,0)*0.5+coalesce(v_def.machinery_count,0)*4)*v_def_mult*v_def_skill + 30;
  end if;
  v_winner := case when v_att_power >= v_def_power then 'attacker' else 'defender' end;
  v_att_loss := least(c_att_loss_cap,(v_def_power/v_att_power)*0.5);
  v_def_loss := least(c_def_loss_cap,(v_att_power/greatest(v_def_power,1))*0.5);
  update public.world_player_imperial_states set
    militia_count=greatest(0,militia_count-floor(v_am*v_att_loss)::bigint),
    shooters_count=greatest(0,shooters_count-floor(v_as*v_att_loss)::bigint),
    scouts_count=greatest(0,scouts_count-floor(v_asc*v_att_loss)::bigint),
    machinery_count=greatest(0,machinery_count-floor(v_amac*v_att_loss)::bigint), updated_at=now()
  where world_player_id=v_order.world_player_id;
  if v_def_owner is not null then
    update public.world_player_imperial_states set
      militia_count=greatest(0,floor(coalesce(v_def.militia_count,0)*(1-v_def_loss))::bigint),
      shooters_count=greatest(0,floor(coalesce(v_def.shooters_count,0)*(1-v_def_loss))::bigint),
      scouts_count=greatest(0,floor(coalesce(v_def.scouts_count,0)*(1-v_def_loss))::bigint),
      machinery_count=greatest(0,floor(coalesce(v_def.machinery_count,0)*(1-v_def_loss))::bigint), updated_at=now()
    where world_player_id=v_def_owner;
    if v_winner='attacker' then
      v_loot_mat:=floor(coalesce(v_def.materials_stock,0)*0.25)::bigint; v_loot_sup:=floor(coalesce(v_def.supplies_stock,0)*0.25)::bigint;
      update public.world_player_imperial_states set materials_stock=greatest(0,materials_stock-v_loot_mat),
        supplies_stock=greatest(0,supplies_stock-v_loot_sup), updated_at=now() where world_player_id=v_def_owner;
      update public.world_player_imperial_states set materials_stock=materials_stock+v_loot_mat,
        supplies_stock=supplies_stock+v_loot_sup, updated_at=now() where world_player_id=v_order.world_player_id;
    end if;
  end if;
  if v_winner='attacker' and v_with_hero and v_def_owner is not null then
    select coalesce(sum(level),0) into v_city_size from public.village_structure_states where village_site_id=v_order.target_site_id;
    v_survivors := (v_am+v_as+v_asc+v_amac) * (1 - v_att_loss);
    v_required  := v_city_size * c_garrison;
    if v_survivors >= v_required then
      update public.villages set owner_world_player_id=v_order.world_player_id,
        village_type='colony', settlement_role='Colonia', is_original_capital=false, conquered_at=now(), updated_at=now()
      where site_id=v_order.target_site_id;
      update public.village_structure_states set world_player_id=v_order.world_player_id, updated_at=now() where village_site_id=v_order.target_site_id;
      select current_capital_site_id into v_def_cap from public.world_players where id=v_def_owner;
      if v_def_cap = v_order.target_site_id then
        update public.world_players set status='eliminated', eliminated_at=now(), elimination_reason='conquista', current_capital_site_id=null, updated_at=now() where id=v_def_owner;
      end if;
      update public.world_player_map_orders set status='resolved',result_code='conquered',resolved_at=now() where id=p_order_id; return;
    end if;
  end if;
  if v_winner='defender' and v_with_hero then
    update public.world_players set npc_has_hero=false, npc_hero_recovers_at=now()+interval '30 minutes', updated_at=now() where id=v_order.world_player_id;
  end if;
  update public.world_player_map_orders set status='resolved',result_code=v_winner,resolved_at=now() where id=p_order_id;
end; $$;
revoke all on function public.kw_resolve_attack from public, authenticated, anon;
grant execute on function public.kw_resolve_attack to service_role;
