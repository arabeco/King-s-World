-- KingsWorld - modo de temporada do mundo
-- Seguro para rodar mais de uma vez.

alter table public.worlds
  add column if not exists season_mode text not null default 'classic',
  add column if not exists speed_multiplier numeric not null default 1;

alter table public.worlds
  drop constraint if exists worlds_season_mode_check;

alter table public.worlds
  add constraint worlds_season_mode_check
  check (season_mode in ('classic', 'express'));

alter table public.worlds
  drop constraint if exists worlds_speed_multiplier_check;

alter table public.worlds
  add constraint worlds_speed_multiplier_check
  check (speed_multiplier >= 1 and speed_multiplier <= 12);

update public.worlds
set
  season_mode = 'classic',
  speed_multiplier = 1
where season_mode is null;

-- Opcional: normaliza mundos Alpha ja criados antes deste SQL.
update public.worlds
set
  season_mode = 'express',
  speed_multiplier = 4,
  name = coalesce(nullif(name, ''), 'Alpha Expresso'),
  base_move_time_minutes = 11,
  road_move_time_minutes = 4
where slug = 'alpha-expresso';

update public.worlds
set
  season_mode = 'classic',
  speed_multiplier = 1,
  name = coalesce(nullif(name, ''), 'Alpha Classico'),
  base_move_time_minutes = 45,
  road_move_time_minutes = 15
where slug in ('alpha-classico', 'alpha-teste');
