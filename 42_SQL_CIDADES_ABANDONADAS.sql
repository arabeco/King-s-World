-- =============================================================
-- KingsWorld #3 — CIDADES ABANDONADAS (neutras, portes variados, claimáveis)
-- Rodar no SQL Editor (King's World!) APÓS 41. Idempotente.
--
-- CONCEITO (dono): cidades neutras sem dono espalhadas pelo mapa.
--   * PEQUENA  -> claim fácil (defesa fraca, pouca infra)
--   * MÉDIA    -> precisa de exército decente
--   * FORTALEZA-> só por combate de verdade (bastião, ×1.6 defesa, muita infra)
-- Ao VENCER + sobrar gente p/ guarnição, você OCUPA: ela vira sua colônia e
-- VEM COM A INFRA que tinha (os prédios ficam com o site -> você herda).
--
-- Modelo: village com owner_world_player_id=NULL e origin_kind='abandoned_city'
-- (marcador que o cliente já entende). Defesa = (60 + tamanho_infra*150)*mult.
-- Reusa kw_resolve_attack (mesmo motor do PvP/NPC), com ramo p/ alvo sem dono.
-- =============================================================

-- 0. Schema: infra pode existir SEM dono (abandonada). Conquista re-atribui. ----
alter table public.village_structure_states
  alter column world_player_id drop not null;

-- 1. Spawn das cidades abandonadas (idempotente: completa até 6 por mundo) ------
do $$
declare
  v_world uuid; v_biome text; v_tile uuid; v_site uuid;
  v_have int; v_need int; v_i int; v_tier text;
  v_class public.city_class; v_terr public.terrain_kind;
  v_q int; v_r int; v_seed int;
  c_target constant int := 6;   -- abandonadas por mundo (3 pequenas, 2 médias, 1 fortaleza)
begin
  for v_world in select id from public.worlds where status = 'running' loop
    select coalesce((select biome_type from public.map_tiles where world_id = v_world limit 1), 'plains')
      into v_biome;

    select count(*) into v_have
      from public.villages
     where world_id = v_world and origin_kind = 'abandoned_city'
       and owner_world_player_id is null and destroyed_at is null;

    v_need := c_target - v_have;
    v_seed := 0;

    while v_need > 0 loop
      v_i    := c_target - v_need;  -- 0..5
      v_tier := case when v_i < 3 then 'pequena' when v_i < 5 then 'media' else 'fortaleza' end;
      v_class := (case v_tier when 'fortaleza' then 'bastiao'
                              when 'media'     then 'posto_avancado'
                              else 'neutral' end)::public.city_class;
      v_terr := (array['ashen_fields','riverlands','ironridge','frontier_pass','crown_heartland']::public.terrain_kind[])[1 + (v_i % 5)];

      -- acha coord livre numa faixa afastada (r >= 30) p/ não colidir com NPC/jogador
      loop
        v_q := 2 + (v_seed % 14) * 2;
        v_r := 30 + (v_seed / 14) * 2;
        v_seed := v_seed + 1;
        exit when not exists (select 1 from public.map_tiles t where t.world_id = v_world and t.q = v_q and t.r = v_r);
        exit when v_seed > 5000;
      end loop;

      insert into public.map_tiles (world_id, q, r, biome_type, terrain_type)
      values (v_world, v_q, v_r, v_biome, 'normal') returning id into v_tile;

      insert into public.map_sites (world_id, tile_id, site_type, status)
      values (v_world, v_tile, 'village', 'active') returning id into v_site;

      insert into public.villages
        (site_id, world_id, owner_world_player_id, founder_world_player_id, name,
         village_type, settlement_role, city_class, city_class_locked,
         origin_kind, terrain_kind, is_original_capital, capital_eligibility_status)
      values
        (v_site, v_world, null, null,
         case v_tier when 'fortaleza' then 'Fortaleza Abandonada'
                     when 'media'     then 'Vila Abandonada'
                     else 'Ruínas Abandonadas' end,
         'colony', 'Colonia', v_class, true,
         'abandoned_city', v_terr, false, 'pending_review');

      -- prédios por porte (herdados ao ocupar). level = least(10, soma dos 4 slots).
      --   pequena   -> cada estrutura level 1  (tamanho ~5)
      --   média     -> cada estrutura level 3  (tamanho ~15)
      --   fortaleza -> defesa 10, demais 7      (tamanho ~38)
      insert into public.village_structure_states
        (world_id, world_player_id, village_site_id, structure_code, slot_a, slot_b, slot_c, slot_d)
      select v_world, null, v_site, sc.code,
        case v_tier when 'fortaleza' then 3 when 'media' then 2 else 1 end,
        case v_tier when 'fortaleza' then (case when sc.code='defense' then 3 else 2 end)
                    when 'media' then 1 else 0 end,
        case v_tier when 'fortaleza' then (case when sc.code='defense' then 3 else 2 end)
                    when 'media' then 0 else 0 end,
        case v_tier when 'fortaleza' then (case when sc.code='defense' then 1 else 0 end)
                    when 'media' then 0 else 0 end
      from (values ('crown'),('economy'),('society'),('recruitment'),('defense')) as sc(code)
      on conflict (village_site_id, structure_code) do nothing;

      v_need := v_need - 1;
    end loop;
  end loop;
end $$;

-- 2. kw_resolve_attack com suporte a ALVO ABANDONADO (sem dono) ----------------
-- Diff vs 41: ramo v_def_owner is null usa defesa por tamanho da infra; ao
-- vencer com gente suficiente p/ guarnição, OCUPA (vira colônia + herda infra).
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
  c_att_loss_cap constant numeric := 0.5;  -- ATACANTE: all-in NÃO perde tudo (max 50%/golpe)
  c_def_loss_cap constant numeric := 0.5;  -- DEFENSOR: não é destruído num golpe (max 50%/golpe)
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
  -- defesa
  if v_def_owner is null then
    -- ALVO ABANDONADO: defesa estática pelo tamanho da infra (não tem exército)
    select coalesce(sum(level),0) into v_city_size from public.village_structure_states where village_site_id=v_order.target_site_id;
    v_def_mult := case when v_class='bastiao' then 1.6 when v_class='posto_avancado' then 1.2 else 1.0 end;
    v_def_power := (60 + v_city_size*150) * v_def_mult;
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
  -- perdas do atacante (sempre)
  update public.world_player_imperial_states set
    militia_count=greatest(0,militia_count-floor(v_am*v_att_loss)::bigint),
    shooters_count=greatest(0,shooters_count-floor(v_as*v_att_loss)::bigint),
    scouts_count=greatest(0,scouts_count-floor(v_asc*v_att_loss)::bigint),
    machinery_count=greatest(0,machinery_count-floor(v_amac*v_att_loss)::bigint), updated_at=now()
  where world_player_id=v_order.world_player_id;

  -- ====== ALVO ABANDONADO: ocupa se vencer e tiver gente p/ guarnição ======
  if v_def_owner is null then
    if v_winner='attacker' then
      v_survivors := (v_am+v_as+v_asc+v_amac) * (1 - v_att_loss);
      if v_survivors >= greatest(1, v_city_size * c_garrison) then
        update public.villages set owner_world_player_id=v_order.world_player_id,
          founder_world_player_id=coalesce(founder_world_player_id, v_order.world_player_id),
          village_type='colony', settlement_role='Colonia', is_original_capital=false,
          origin_kind='claimed_city', conquered_at=now(), updated_at=now()
        where site_id=v_order.target_site_id;
        update public.village_structure_states set world_player_id=v_order.world_player_id, updated_at=now()
        where village_site_id=v_order.target_site_id;
        update public.world_player_map_orders set status='resolved',result_code='claimed',resolved_at=now() where id=p_order_id; return;
      end if;
    end if;
    -- venceu sem gente p/ ocupar, ou perdeu: só registra o resultado
    update public.world_player_map_orders set status='resolved',result_code=v_winner,resolved_at=now() where id=p_order_id; return;
  end if;

  -- ====== ALVO COM DONO (PvP / NPC): perdas do defensor + saque + conquista ======
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
  if v_winner='attacker' and v_with_hero then
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

-- =============================================================
-- CONFERÊNCIA — as abandonadas criadas, por porte e defesa estimada:
--   select v.name, v.city_class, t.q, t.r,
--          coalesce(sum(vss.level),0) as tamanho,
--          round((60 + coalesce(sum(vss.level),0)*150) *
--                case when v.city_class='bastiao' then 1.6 when v.city_class='posto_avancado' then 1.2 else 1.0 end) as defesa
--   from public.villages v
--   join public.map_sites ms on ms.id = v.site_id
--   join public.map_tiles t  on t.id = ms.tile_id
--   left join public.village_structure_states vss on vss.village_site_id = v.site_id
--   where v.origin_kind='abandoned_city' and v.owner_world_player_id is null
--   group by v.site_id, v.name, v.city_class, t.q, t.r
--   order by defesa;
--
-- TESTE CIRÚRGICO (claim sem UI/deploy) — manda um exército forte numa pequena:
--   1) ache uma abandonada pequena (defesa ~810) e sua site_id na query acima
--   2) crie a ordem e resolva (troca <SEU_WP> e <SITE_ABANDONADA>):
--   insert into public.world_player_map_orders
--     (world_id, world_player_id, origin_site_id, target_site_id, target_coord,
--      movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, status)
--   select wp.world_id, wp.id, wp.current_capital_site_id, '<SITE_ABANDONADA>'::uuid, '0:0',
--          'attack','attack', '{"militia":2000}'::jsonb, 2, now(), 'traveling'
--   from public.world_players wp where wp.id='<SEU_WP>'::uuid;
--   -- pega o id da ordem recém criada e resolve:
--   select public.kw_resolve_attack('<ORDER_ID>'::uuid);
--   -- confere: a village deve estar com owner = <SEU_WP>, result_code='claimed'.
-- =============================================================
