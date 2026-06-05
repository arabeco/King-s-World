-- =============================================================
-- KingsWorld #3 v2 — ABANDONADAS QUE EVOLUEM (spawn ~25 + tick lento + NPC devagar)
-- Rodar no SQL Editor (King's World!) APÓS 45. Idempotente.
-- Spec: docs/superpowers/specs/2026-06-05-abandonadas-evoluem-design.md
--
-- 1) Spawn ~25/mundo, TODAS começam minúsculas (~tamanho 3); teto por classe.
-- 2) kw_abandoned_tick: cresce devagar até o teto (cron próprio a cada 3 min).
-- 3) kw_npc_decide_attacks: expansão 60% -> 10% (NPC compete devagar).
-- =============================================================

-- 1. SPAWN — completa até 25 abandonadas por mundo, começando minúsculas --------
do $$
declare
  v_world uuid; v_biome text; v_tile uuid; v_site uuid;
  v_have int; v_need int; v_gi int;
  v_class public.city_class; v_terr public.terrain_kind;
  v_q int; v_r int; v_seed int;
  c_target constant int := 25;
begin
  for v_world in select id from public.worlds where status='running' loop
    select coalesce((select biome_type from public.map_tiles where world_id=v_world limit 1),'plains') into v_biome;
    select count(*) into v_have
      from public.villages
     where world_id=v_world and origin_kind='abandoned_city'
       and owner_world_player_id is null and destroyed_at is null;
    v_need := c_target - v_have;
    v_seed := 0;

    while v_need > 0 loop
      v_gi := c_target - v_need;  -- índice global 0..24
      -- distribuição: 15 neutral, 7 posto_avancado, 3 bastiao
      v_class := (case when v_gi < 15 then 'neutral'
                       when v_gi < 22 then 'posto_avancado'
                       else 'bastiao' end)::public.city_class;
      v_terr := (array['ashen_fields','riverlands','ironridge','frontier_pass','crown_heartland']::public.terrain_kind[])[1 + (v_gi % 5)];

      -- coord livre numa faixa afastada (r >= 30)
      loop
        v_q := 2 + (v_seed % 14) * 2;
        v_r := 30 + (v_seed / 14) * 2;
        v_seed := v_seed + 1;
        exit when not exists (select 1 from public.map_tiles t where t.world_id=v_world and t.q=v_q and t.r=v_r);
        exit when v_seed > 5000;
      end loop;

      insert into public.map_tiles (world_id,q,r,biome_type,terrain_type)
      values (v_world,v_q,v_r,v_biome,'normal') returning id into v_tile;
      insert into public.map_sites (world_id,tile_id,site_type,status)
      values (v_world,v_tile,'village','active') returning id into v_site;

      insert into public.villages
        (site_id,world_id,owner_world_player_id,founder_world_player_id,name,
         village_type,settlement_role,city_class,city_class_locked,
         origin_kind,terrain_kind,is_original_capital,capital_eligibility_status)
      values
        (v_site,v_world,null,null,'Ruínas Abandonadas',
         'colony','Colonia',v_class,true,'abandoned_city',v_terr,false,'pending_review');

      -- nasce minúscula (~tamanho 3): 3 estruturas em slot_a=1, resto 0
      insert into public.village_structure_states
        (world_id,world_player_id,village_site_id,structure_code,slot_a,slot_b,slot_c,slot_d)
      select v_world, null, v_site, sc.code,
        case when sc.code in ('crown','economy','defense') then 1 else 0 end, 0, 0, 0
      from (values ('crown'),('economy'),('society'),('recruitment'),('defense')) as sc(code)
      on conflict (village_site_id, structure_code) do nothing;

      v_need := v_need - 1;
    end loop;
  end loop;
end $$;

-- 2. EVOLUÇÃO LENTA — kw_abandoned_tick(world) --------------------------------
create or replace function public.kw_abandoned_tick(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare v_v record; v_cap int; v_total int; v_row record; v_grown int:=0;
begin
  for v_v in
    select v.site_id, v.city_class
    from public.villages v
    where v.world_id=p_world_id and v.owner_world_player_id is null
      and v.origin_kind='abandoned_city' and v.destroyed_at is null
  loop
    if random() >= 0.15 then continue; end if;     -- devagarinho (~+1 nível/20min)
    v_cap := case v_v.city_class when 'bastiao' then 40 when 'posto_avancado' then 18 else 8 end;
    select coalesce(sum(level),0) into v_total from public.village_structure_states where village_site_id=v_v.site_id;
    if v_total >= v_cap then continue; end if;
    -- incrementa o primeiro slot livre da estrutura MENOS desenvolvida
    select * into v_row from public.village_structure_states
      where village_site_id=v_v.site_id and (slot_a<3 or slot_b<3 or slot_c<3 or slot_d<3)
      order by (slot_a+slot_b+slot_c+slot_d) asc, structure_code limit 1;
    if not found then continue; end if;
    update public.village_structure_states set
      slot_a = case when v_row.slot_a<3 then v_row.slot_a+1 else v_row.slot_a end,
      slot_b = case when v_row.slot_a>=3 and v_row.slot_b<3 then v_row.slot_b+1 else v_row.slot_b end,
      slot_c = case when v_row.slot_a>=3 and v_row.slot_b>=3 and v_row.slot_c<3 then v_row.slot_c+1 else v_row.slot_c end,
      slot_d = case when v_row.slot_a>=3 and v_row.slot_b>=3 and v_row.slot_c>=3 and v_row.slot_d<3 then v_row.slot_d+1 else v_row.slot_d end,
      updated_at=now()
    where village_site_id=v_row.village_site_id and structure_code=v_row.structure_code;
    v_grown := v_grown + 1;
  end loop;
  return jsonb_build_object('abandoned_grown', v_grown);
end; $$;
revoke all on function public.kw_abandoned_tick from public, authenticated, anon;
grant execute on function public.kw_abandoned_tick to service_role;

-- cron próprio (a cada 3 min). cron.schedule por nome faz upsert -> re-rodar é seguro.
select cron.schedule('kw-abandoned-grow', '*/3 * * * *',
  $job$ select public.kw_abandoned_tick(id) from public.worlds where status='running' $job$);

-- 3. NPC COMPETE DEVAGAR — expansão 60% -> 10% --------------------------------
create or replace function public.kw_npc_decide_attacks(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_att record; v_count int:=0;
  v_disp jsonb; v_hero_ok boolean; v_conquest boolean; v_frac numeric; v_att_power numeric;
  v_tsite uuid; v_ttile uuid; v_tcoord text; v_tis_ab boolean; v_tis_ai boolean;
begin
  for v_att in
    select wp.id as wp_id, wp.current_capital_site_id as origin,
           s.militia_count,s.shooters_count,s.scouts_count,s.machinery_count,
           wp.npc_has_hero, wp.npc_hero_recovers_at, coalesce(wp.npc_aggression,0.15) as aggr
    from public.world_players wp join public.world_player_imperial_states s on s.world_player_id=wp.id
    where wp.world_id=p_world_id and wp.is_ai and wp.status='alive'
      and wp.current_capital_site_id is not null and s.militia_count>=80
      and random() < coalesce(wp.npc_aggression,0.15)
      and not exists (select 1 from public.world_player_map_orders o
                      where o.world_player_id=wp.id and o.status in ('traveling','resolving'))
  loop
    v_att_power := (v_att.militia_count + v_att.shooters_count*1.5 + v_att.scouts_count*0.5 + v_att.machinery_count*4) * 0.95;
    v_tsite := null; v_ttile := null; v_tcoord := null; v_tis_ab := false; v_tis_ai := false;

    -- EXPANSÃO (10%): NPC compete devagar pelas abandonadas
    if random() < 0.10 then
      select v.site_id, ms.tile_id, (t.q||':'||t.r), true, false
        into v_tsite, v_ttile, v_tcoord, v_tis_ab, v_tis_ai
        from public.villages v
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        where v.world_id=p_world_id and v.owner_world_player_id is null
          and v.origin_kind='abandoned_city' and v.destroyed_at is null
          and ((60 + coalesce((select sum(level) from public.village_structure_states vss
                               where vss.village_site_id=v.site_id),0)*150)
               * case when v.city_class='bastiao' then 1.6
                      when v.city_class='posto_avancado' then 1.2 else 1.0 end) <= v_att_power*0.85
        order by ((60 + coalesce((select sum(level) from public.village_structure_states vss
                               where vss.village_site_id=v.site_id),0)*150)
               * case when v.city_class='bastiao' then 1.6
                      when v.city_class='posto_avancado' then 1.2 else 1.0 end) desc
        limit 1;
    end if;

    if v_tsite is null then
      select v.site_id, ms.tile_id, (t.q||':'||t.r), false, coalesce(wp2.is_ai,false)
        into v_tsite, v_ttile, v_tcoord, v_tis_ab, v_tis_ai
        from public.world_players wp2
        join public.villages v on v.owner_world_player_id=wp2.id
        join public.map_sites ms on ms.id=v.site_id
        join public.map_tiles t on t.id=ms.tile_id
        join public.world_player_imperial_states ds on ds.world_player_id=wp2.id
        where wp2.world_id=p_world_id and wp2.status='alive' and wp2.id<>v_att.wp_id
        order by (coalesce(ds.militia_count,0) + random()*150) asc
        limit 1;
    end if;

    if v_tsite is null then continue; end if;

    v_hero_ok := v_att.npc_has_hero and (v_att.npc_hero_recovers_at is null or v_att.npc_hero_recovers_at <= now());
    v_conquest := (not v_tis_ab) and v_tis_ai and v_hero_ok
                  and v_att.militia_count >= 100 and random() < (0.4 + v_att.aggr);
    v_frac := case when v_conquest or v_tis_ab then 0.95
                   else greatest(0.4, least(0.85, 0.4 + v_att.aggr)) end;
    v_disp := jsonb_build_object(
       'militia',  floor(v_att.militia_count *v_frac),
       'shooters', floor(v_att.shooters_count*v_frac),
       'scouts',   floor(v_att.scouts_count  *v_frac),
       'machinery',floor(v_att.machinery_count*v_frac));
    insert into public.world_player_map_orders
      (world_id, world_player_id, origin_site_id, target_site_id, target_tile_id, target_coord,
       movement_type, command_action, troop_dispatch_json, eta_minutes, arrival_at, meta_json)
    values (p_world_id, v_att.wp_id, v_att.origin, v_tsite, v_ttile, v_tcoord,
       'attack','attack', v_disp, 2, now()+interval '90 seconds', jsonb_build_object('with_hero', v_conquest));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('attacks_launched',v_count);
end; $$;
revoke all on function public.kw_npc_decide_attacks from public, authenticated, anon;
grant execute on function public.kw_npc_decide_attacks to service_role;

-- =============================================================
-- CONFERÊNCIA:
--  select * from (values
--   (1,'abandonadas neutras (deve ~25)', (select count(*)::text from public.villages where origin_kind='abandoned_city' and owner_world_player_id is null)),
--   (2,'kw-abandoned-grow ativo', (select coalesce(string_agg(active::text,','),'NAO') from cron.job where jobname='kw-abandoned-grow')),
--   (3,'tamanho min/méd/máx das abandonadas', (select round(min(s))||' / '||round(avg(s))||' / '||round(max(s)) from (select coalesce(sum(level),0) s from public.village_structure_states vss join public.villages v on v.site_id=vss.village_site_id where v.origin_kind='abandoned_city' and v.owner_world_player_id is null group by v.site_id) x))
--  ) t(ord,metrica,valor) order by ord;
-- (Rodar de novo depois de ~30 min: o tamanho médio deve subir devagar.)
-- =============================================================
