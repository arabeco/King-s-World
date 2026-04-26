alter table public.worlds
  add column if not exists runtime_game_day_seconds integer not null default 86400
    check (runtime_game_day_seconds > 0);

comment on column public.worlds.runtime_game_day_seconds is
  'Duracao de 1 dia do jogo em segundos. Exodo de teste usa 600 = 10 minutos; temporada real pode usar 86400.';

update public.worlds
set runtime_game_day_seconds = 600,
    updated_at = now()
where slug in ('exodo', 'laboratorio');
