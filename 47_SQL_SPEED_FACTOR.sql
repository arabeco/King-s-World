-- =============================================================
-- KingsWorld — SPEED_FACTOR por mundo (teste x expresso x normal)
-- Rodar no SQL Editor (King's World!) APÓS 46. Idempotente. SEM RISCO:
-- default 1.0 = ritmo ATUAL (teste/câmera rápida) -> o mundo rodando NÃO muda.
--
-- speed_factor escala o ritmo SERVIDOR (crescimento NPC + evolução abandonada).
--   1.0   = ritmo de teste atual (rápido, pra ver mecânica em minutos)
--   ~0.10 = EXPRESSO (30 dias)   <- ponto de partida, calibrar no simulador
--   ~0.025= NORMAL (120 dias)    <- ponto de partida, calibrar no simulador
-- (expresso = 4x o normal; ambos << teste). Trocar é só:
--   update public.worlds set speed_factor=0.025 where id='<mundo>';
--
-- NÃO escala ainda (ficam p/ depois, deploy-gated): ETA de marcha e a economia
-- de PRÉDIOS do jogador (produção/tempo de obra vêm do building_catalog + cliente;
-- prédios já estão em ritmo 120d real). Aqui só o ritmo do "mundo vivo" servidor.
-- =============================================================

alter table public.worlds
  add column if not exists speed_factor numeric not null default 1.0
  check (speed_factor > 0);

-- mundo(s) rodando agora ficam em 1.0 (teste) — nada muda. (já é o default)
-- exemplo p/ quando criar temporada real:
--   update public.worlds set speed_factor=0.025 where id='<mundo normal>';
--   update public.worlds set speed_factor=0.10  where id='<mundo expresso>';

-- 1. kw_npc_tick: crescimento * habilidade * speed_factor ----------------------
create or replace function public.kw_npc_tick(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_npc record; v_count int := 0; v_elapsed numeric; v_gain numeric; v_speed numeric;
begin
  select coalesce(speed_factor,1.0) into v_speed from public.worlds where id=p_world_id;
  v_speed := coalesce(v_speed,1.0);
  for v_npc in
    select wp.id as wp_id, wp.npc_profile, coalesce(wp.npc_skill,1.0) as skill, s.npc_growth_anchor_at,
           coalesce(s.materials_capacity,8000) as mcap, coalesce(s.supplies_capacity,8000) as scap
    from public.world_players wp join public.world_player_imperial_states s on s.world_player_id=wp.id
    where wp.world_id=p_world_id and wp.is_ai and wp.status='alive' for update of s
  loop
    v_elapsed := greatest(0, extract(epoch from (now() - coalesce(v_npc.npc_growth_anchor_at, now()))));
    if v_elapsed <= 0 then continue; end if;
    v_gain := kw_npc_profile_growth(v_npc.npc_profile) * v_elapsed * v_npc.skill * v_speed;
    update public.world_player_imperial_states s set
      materials_stock = least(v_npc.mcap, s.materials_stock + (v_gain*1.2)::bigint),
      supplies_stock  = least(v_npc.scap, s.supplies_stock + (v_gain*1.0)::bigint),
      militia_count   = s.militia_count + greatest(1, round(v_gain*0.5))::bigint,
      npc_growth_anchor_at = now(), updated_at = now()
    where s.world_player_id = v_npc.wp_id;
    update public.world_players set power_score_cached = power_score_cached + greatest(1, round(v_gain))::bigint, updated_at=now()
    where id = v_npc.wp_id;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('world_id',p_world_id,'npcs_grown',v_count,'speed',v_speed,'ticked_at',now());
end; $$;
revoke all on function public.kw_npc_tick from public, authenticated, anon;
grant execute on function public.kw_npc_tick to service_role;

-- 2. kw_abandoned_tick: probabilidade de crescer * speed_factor ----------------
create or replace function public.kw_abandoned_tick(p_world_id uuid)
returns jsonb language plpgsql security definer set search_path=public, extensions as $$
declare v_v record; v_cap int; v_total int; v_row record; v_grown int:=0; v_speed numeric; v_prob numeric;
begin
  select coalesce(speed_factor,1.0) into v_speed from public.worlds where id=p_world_id;
  v_prob := least(0.95, 0.15 * coalesce(v_speed,1.0));   -- 0.15/tick no teste (speed 1.0)
  for v_v in
    select v.site_id, v.city_class
    from public.villages v
    where v.world_id=p_world_id and v.owner_world_player_id is null
      and v.origin_kind='abandoned_city' and v.destroyed_at is null
  loop
    if random() >= v_prob then continue; end if;
    v_cap := case v_v.city_class when 'bastiao' then 40 when 'posto_avancado' then 18 else 8 end;
    select coalesce(sum(level),0) into v_total from public.village_structure_states where village_site_id=v_v.site_id;
    if v_total >= v_cap then continue; end if;
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
  return jsonb_build_object('abandoned_grown', v_grown, 'speed', v_speed);
end; $$;
revoke all on function public.kw_abandoned_tick from public, authenticated, anon;
grant execute on function public.kw_abandoned_tick to service_role;

-- CONFERÊNCIA:
--   select id, status, speed_factor from public.worlds order by status;
--   (mundo rodando deve estar 1.0 = ritmo de teste inalterado)
