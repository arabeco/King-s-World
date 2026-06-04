-- =============================================================
-- KingsWorld #2 / fatia 2c: NPC ataca + resolução de combate REAL (em SQL)
-- Rodar no SQL Editor (King's World!) APÓS 29/31. create-or-replace.
-- Schema real das ordens = 10_SQL: world_player_id, command_action (dispatch),
-- target_coord/target_tile_id/eta_minutes NOT NULL, status enum map_order_status
-- (traveling/resolving/resolved/...). Escopo: NPC-vs-NPC. Self-contained.
-- =============================================================

-- 1. RESOLUÇÃO DE COMBATE REAL --------------------------------------------
create or replace function public.kw_resolve_attack(p_order_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_order public.world_player_map_orders%rowtype; v_def_owner uuid; v_class text; v_disp jsonb;
  v_am numeric; v_as numeric; v_asc numeric; v_amac numeric;
  v_att_power numeric; v_def_power numeric; v_def_mult numeric;
  v_att_loss numeric; v_def_loss numeric; v_winner text; v_def record;
  v_loot_mat bigint; v_loot_sup bigint;
begin
  select * into v_order from public.world_player_map_orders where id=p_order_id for update;
  if not found then return; end if;
  select owner_world_player_id, city_class into v_def_owner, v_class
    from public.villages where site_id=v_order.target_site_id;
  v_disp := coalesce(v_order.troop_dispatch_json,'{}'::jsonb);
  v_am:=coalesce((v_disp->>'militia')::numeric,0); v_as:=coalesce((v_disp->>'shooters')::numeric,0);
  v_asc:=coalesce((v_disp->>'scouts')::numeric,0); v_amac:=coalesce((v_disp->>'machinery')::numeric,0);
  v_att_power := v_am*1 + v_as*1.5 + v_asc*0.5 + v_amac*4;
  if v_att_power <= 0 then
    update public.world_player_map_orders set status='resolved',result_code='no_army',resolved_at=now() where id=p_order_id;
    return;
  end if;
  if v_def_owner is null then v_def_power := 60;
  else
    select militia_count,shooters_count,scouts_count,machinery_count,materials_stock,supplies_stock
      into v_def from public.world_player_imperial_states where world_player_id=v_def_owner for update;
    v_def_mult := case when v_class='bastiao' then 1.6 when v_class='posto_avancado' then 1.2 else 1.0 end;
    v_def_power := (coalesce(v_def.militia_count,0)*1+coalesce(v_def.shooters_count,0)*1.5
                  +coalesce(v_def.scouts_count,0)*0.5+coalesce(v_def.machinery_count,0)*4)*v_def_mult + 30;
  end if;
  v_winner := case when v_att_power >= v_def_power then 'attacker' else 'defender' end;
  v_att_loss := least(1.0,(v_def_power/v_att_power)*0.5);
  v_def_loss := least(1.0,(v_att_power/greatest(v_def_power,1))*0.5);
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
      v_loot_mat:=floor(coalesce(v_def.materials_stock,0)*0.25)::bigint;
      v_loot_sup:=floor(coalesce(v_def.supplies_stock,0)*0.25)::bigint;
      update public.world_player_imperial_states set materials_stock=greatest(0,materials_stock-v_loot_mat),
        supplies_stock=greatest(0,supplies_stock-v_loot_sup), updated_at=now() where world_player_id=v_def_owner;
      update public.world_player_imperial_states set materials_stock=materials_stock+v_loot_mat,
        supplies_stock=supplies_stock+v_loot_sup, updated_at=now() where world_player_id=v_order.world_player_id;
      if (coalesce(v_def.militia_count,0)*(1-v_def_loss)) < 1 then
        update public.villages set owner_world_player_id=v_order.world_player_id, conquered_at=now(), updated_at=now()
        where site_id=v_order.target_site_id;
      end if;
    end if;
  end if;
  update public.world_player_map_orders set status='resolved',result_code=v_winner,resolved_at=now() where id=p_order_id;
end; $$;
revoke all on function public.kw_resolve_attack from public, authenticated, anon;
grant execute on function public.kw_resolve_attack to service_role;

-- 2. NPC DECIDE ATACAR ----------------------------------------------------
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_att record; v_target record; v_count int:=0; v_disp jsonb;
begin
  for v_att in
    select wp.id as wp_id, wp.current_capital_site_id as origin,
           s.militia_count,s.shooters_count,s.scouts_count,s.machinery_count
    from public.world_players wp join public.world_player_imperial_states s on s.world_player_id=wp.id
    where wp.world_id=p_world_id and wp.is_ai and wp.status='alive'
      and wp.current_capital_site_id is not null and s.militia_count>=80 and random()<0.15
      and not exists (select 1 from public.world_player_map_orders o
                      where o.world_player_id=wp.id and o.status in ('traveling','resolving'))
  loop
    select v.site_id as target_site, ms.tile_id as target_tile, (t.q || ':' || t.r) as target_coord
      into v_target
      from public.world_players wp2
      join public.villages v on v.owner_world_player_id=wp2.id
      join public.map_sites ms on ms.id=v.site_id
      join public.map_tiles t on t.id=ms.tile_id
      where wp2.world_id=p_world_id and wp2.is_ai and wp2.status='alive' and wp2.id<>v_att.wp_id
      order by random() limit 1;
    if not found then continue; end if;
    v_disp := jsonb_build_object('militia',floor(v_att.militia_count*0.6),'shooters',floor(v_att.shooters_count*0.6),
                                 'scouts',floor(v_att.scouts_count*0.5),'machinery',floor(v_att.machinery_count*0.6));
    insert into public.world_player_map_orders
      (world_id, world_player_id, origin_site_id, target_site_id, target_tile_id, target_coord,
       movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, meta_json)
    values (p_world_id, v_att.wp_id, v_att.origin, v_target.target_site, v_target.target_tile, v_target.target_coord,
       'attack', 'attack', v_disp, 2, now()+interval '90 seconds', '{}'::jsonb);
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('attacks_launched',v_count);
end; $$;
revoke all on function public.kw_npc_decide_attacks from public, authenticated, anon;
grant execute on function public.kw_npc_decide_attacks to service_role;

-- 3. Pendura a decisão no tick do mundo -----------------------------------
create or replace function public.kw_world_tick(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_world public.worlds%rowtype; v_player record; v_count int:=0; v_orders jsonb; v_npc jsonb; v_atk jsonb;
begin
  select * into v_world from public.worlds where id=p_world_id for update;
  if not found then raise exception 'WORLD_NOT_FOUND'; end if;
  if v_world.status='finalized' then return jsonb_build_object('skipped',true,'reason','world_finalized'); end if;
  for v_player in select id from public.world_players where world_id=p_world_id and status='alive'
  loop perform public.kw_settle_player(v_player.id); v_count:=v_count+1; end loop;
  v_npc := public.kw_npc_tick(p_world_id);
  v_atk := public.kw_npc_decide_attacks(p_world_id);
  v_orders := public.kw_resolve_arrived_orders(p_world_id);
  return jsonb_build_object('world_id',p_world_id,'players_settled',v_count,'npc',v_npc,'attacks',v_atk,'orders',v_orders,'ticked_at',now());
end; $$;
revoke all on function public.kw_world_tick from public, authenticated, anon;
grant execute on function public.kw_world_tick to service_role;
