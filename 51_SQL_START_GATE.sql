-- =============================================================
-- KingsWorld #51 — START GATE (mundo congelado até o início agendado)
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- DESIGN (pedido do dono):
--  * Mundo 'open' = "Aguardando início": CONGELADO (tick/NPC/colheita só rodam
--    em status='running', então 'open' já é frozen). O bug era virar 'running'
--    cedo demais.
--  * "Começar mundo" = fecha a entrada (joins_closed_at) e agenda o início para
--    00:00 do dia seguinte (manual_start_at, fuso America/Sao_Paulo). Frozen.
--  * No 00:00 -> vira 'running' (Dia 1) e RE-ANCORA recursos nesse instante.
--
-- NOTA: a tabela worlds JÁ TEM starts_at/phase_2_starts_at/ends_at (NOT NULL,
-- schedule original do mundo). NÃO mexer nessas. Usamos colunas novas próprias.
-- =============================================================

-- 1) Colunas NOVAS (não colidem com o schedule existente) ------------------
alter table public.worlds
  add column if not exists joins_closed_at timestamptz,
  add column if not exists manual_start_at timestamptz;

-- 2) "Começar mundo": fecha entrada + agenda início p/ 00:00 do dia seguinte (SP)
create or replace function public.kw_begin_world(p_world_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_starts timestamptz;
begin
  v_starts := (date_trunc('day', (now() at time zone 'America/Sao_Paulo'))
               + interval '1 day') at time zone 'America/Sao_Paulo';
  update public.worlds
     set joins_closed_at = now(), manual_start_at = v_starts, updated_at = now()
   where id = p_world_id and status = 'open';
  return v_starts;   -- instante em que o mundo vai começar
end $$;
revoke all on function public.kw_begin_world(uuid) from public, anon, authenticated;
grant execute on function public.kw_begin_world(uuid) to service_role;

-- 3) Ativa mundos agendados (gate: começou + chegou a hora) -> running --------
create or replace function public.kw_activate_scheduled_worlds()
returns void language plpgsql security definer set search_path=public as $$
declare v_world uuid;
begin
  for v_world in
    select id from public.worlds
     where status = 'open' and joins_closed_at is not null
       and manual_start_at is not null and manual_start_at <= now()
  loop
    update public.worlds set
      status = 'running', runtime_started = true, runtime_real_time_enabled = true,
      runtime_anchor_day = 1, runtime_anchor_started_at = now(),
      day_number = 1, updated_at = now()
    where id = v_world;

    update public.world_player_imperial_states s set
      materials_anchor_value = s.materials_stock, materials_anchor_at = now(),
      supplies_anchor_value  = s.supplies_stock,  supplies_anchor_at  = now(),
      npc_growth_anchor_at   = now(), updated_at = now()
    from public.world_players wp
    where wp.id = s.world_player_id and wp.world_id = v_world;
  end loop;
end $$;
revoke all on function public.kw_activate_scheduled_worlds() from public, anon, authenticated;
grant execute on function public.kw_activate_scheduled_worlds() to service_role;

-- 4) Cron: checa a cada minuto (flipa no 00:00) ----------------------------
create extension if not exists pg_cron;
select cron.schedule('kw-activate-worlds','* * * * *',
  $$select public.kw_activate_scheduled_worlds();$$);

-- 5) CONSERTAR teu mundo: volta p/ 'open' (congela). NÃO toca em starts_at.
update public.worlds set
  status = 'open', runtime_started = false, runtime_real_time_enabled = false,
  runtime_anchor_day = 0, day_number = 0,
  joins_closed_at = null, manual_start_at = null, updated_at = now()
where id::text like 'b8b32ba3%' and status = 'running';

-- =============================================================
-- DEPOIS DE RODAR: mundo volta a "Aguardando início" (Dia 0), CONGELADO.
--   Pra começar (enquanto o botão da UI não existe):
--     select public.kw_begin_world('b8b32ba3-07b6-464b-b283-7774fd04aafb'::uuid);
--   -> retorna o 00:00 do dia seguinte. O cron flipa pra running nessa hora.
--   Conferir: select jobname,schedule,active from cron.job where jobname='kw-activate-worlds';
-- =============================================================
