begin;

create table if not exists public.world_player_king_states (
  world_player_id uuid primary key references public.world_players(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  king_profile_id text not null,
  king_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_player_king_states_profile_check check (
    king_profile_id in ('aurelian', 'serenna', 'magnor', 'valerius', 'isolde', 'orian', 'maelis', 'corven', 'nyra')
  ),
  constraint world_player_king_states_name_check check (
    char_length(trim(king_name)) between 1 and 32
  )
);

create index if not exists world_player_king_states_world_idx
  on public.world_player_king_states (world_id);

create or replace function public.touch_world_player_king_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_world_player_king_states_updated_at on public.world_player_king_states;

create trigger touch_world_player_king_states_updated_at
before update on public.world_player_king_states
for each row
execute function public.touch_world_player_king_states_updated_at();

insert into public.world_player_king_states (
  world_player_id,
  world_id,
  king_profile_id,
  king_name
)
select
  wp.id,
  wp.world_id,
  wpis.sandbox_snapshots_json #>> array['__clientState', 'kingProfileId'],
  wpis.sandbox_snapshots_json #>> array['__clientState', 'kingName']
from public.world_players wp
join public.world_player_imperial_states wpis
  on wpis.world_player_id = wp.id
where nullif(wpis.sandbox_snapshots_json #>> array['__clientState', 'kingProfileId'], '') is not null
  and nullif(wpis.sandbox_snapshots_json #>> array['__clientState', 'kingName'], '') is not null
on conflict (world_player_id) do update
set
  world_id = excluded.world_id,
  king_profile_id = excluded.king_profile_id,
  king_name = excluded.king_name;

commit;
