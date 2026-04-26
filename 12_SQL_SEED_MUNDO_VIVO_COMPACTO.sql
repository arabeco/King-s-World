begin;

-- Seed minimo do jogo vivo.
-- Este seed nao recria as tabelas antigas removidas do contrato do app.
-- A fonte persistente do jogador e world_player_imperial_states.

alter table public.worlds
  add column if not exists runtime_game_day_seconds integer not null default 86400
    check (runtime_game_day_seconds > 0);

insert into public.worlds (
  slug,
  name,
  status,
  phase,
  day_number,
  player_cap,
  tribe_member_cap,
  map_width,
  map_height,
  map_hex_radius,
  runtime_started,
  runtime_real_time_enabled,
  runtime_anchor_day,
  runtime_anchor_started_at,
  runtime_game_day_seconds,
  sandbox_enabled
)
values (
  'exodo',
  'Exodo',
  'open',
  'phase_1',
  0,
  50,
  10,
  81,
  81,
  40,
  false,
  false,
  0,
  null,
  600,
  false
)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  phase = excluded.phase,
  runtime_started = excluded.runtime_started,
  runtime_real_time_enabled = excluded.runtime_real_time_enabled,
  runtime_game_day_seconds = excluded.runtime_game_day_seconds,
  sandbox_enabled = excluded.sandbox_enabled,
  updated_at = now();

insert into public.worlds (
  slug,
  name,
  status,
  phase,
  day_number,
  player_cap,
  tribe_member_cap,
  map_width,
  map_height,
  map_hex_radius,
  runtime_started,
  runtime_real_time_enabled,
  runtime_anchor_day,
  runtime_anchor_started_at,
  runtime_game_day_seconds,
  sandbox_enabled
)
values (
  'laboratorio',
  'Laboratorio',
  'running',
  'phase_2',
  45,
  50,
  10,
  81,
  81,
  40,
  true,
  false,
  45,
  null,
  600,
  false
)
on conflict (slug) do update
set
  name = excluded.name,
  status = excluded.status,
  phase = excluded.phase,
  day_number = excluded.day_number,
  runtime_started = excluded.runtime_started,
  runtime_real_time_enabled = excluded.runtime_real_time_enabled,
  runtime_anchor_day = excluded.runtime_anchor_day,
  runtime_anchor_started_at = excluded.runtime_anchor_started_at,
  runtime_game_day_seconds = excluded.runtime_game_day_seconds,
  sandbox_enabled = excluded.sandbox_enabled,
  updated_at = now();

commit;
