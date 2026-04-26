begin;

create table if not exists public.world_player_exploration_states (
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  coord_key text not null,
  q integer not null,
  r integer not null,
  discovery_type text not null default 'empty',
  status text not null default 'new',
  title text not null,
  summary text not null,
  image_src text not null,
  risk_label text not null,
  reward_label text not null,
  action_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint world_player_exploration_states_pk primary key (world_player_id, coord_key),
  constraint world_player_exploration_states_type_check check (
    discovery_type in ('empty', 'opportunity', 'threat', 'ruins', 'dragon')
  ),
  constraint world_player_exploration_states_status_check check (
    status in ('new', 'seen', 'resolved', 'ignored')
  )
);

create index if not exists world_player_exploration_states_world_idx
  on public.world_player_exploration_states (world_id);

create or replace function public.touch_world_player_exploration_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_world_player_exploration_states_updated_at on public.world_player_exploration_states;

create trigger touch_world_player_exploration_states_updated_at
before update on public.world_player_exploration_states
for each row
execute function public.touch_world_player_exploration_states_updated_at();

with imperial_base as (
  select
    wp.id as world_player_id,
    wp.world_id,
    wpis.sandbox_snapshots_json -> '__clientState' -> 'discoveriesByCoord' as discoveries
  from public.world_players wp
  join public.world_player_imperial_states wpis
    on wpis.world_player_id = wp.id
)
insert into public.world_player_exploration_states (
  world_player_id,
  world_id,
  coord_key,
  q,
  r,
  discovery_type,
  status,
  title,
  summary,
  image_src,
  risk_label,
  reward_label,
  action_label
)
select
  base.world_player_id,
  base.world_id,
  entry.key as coord_key,
  split_part(entry.key, ':', 1)::int as q,
  split_part(entry.key, ':', 2)::int as r,
  coalesce(nullif(entry.value ->> 'type', ''), 'empty') as discovery_type,
  coalesce(nullif(entry.value ->> 'status', ''), 'new') as status,
  coalesce(nullif(entry.value ->> 'title', ''), 'Area conhecida') as title,
  coalesce(nullif(entry.value ->> 'summary', ''), 'Nada relevante encontrado.') as summary,
  coalesce(nullif(entry.value ->> 'imageSrc', ''), '/images/discovery-default.jpg') as image_src,
  coalesce(nullif(entry.value ->> 'riskLabel', ''), 'baixo') as risk_label,
  coalesce(nullif(entry.value ->> 'rewardLabel', ''), 'baixo') as reward_label,
  coalesce(nullif(entry.value ->> 'actionLabel', ''), 'Ignorar') as action_label
from imperial_base base
cross join lateral jsonb_each(coalesce(base.discoveries, '{}'::jsonb)) as entry(key, value)
on conflict (world_player_id, coord_key) do update
set
  world_id = excluded.world_id,
  q = excluded.q,
  r = excluded.r,
  discovery_type = excluded.discovery_type,
  status = excluded.status,
  title = excluded.title,
  summary = excluded.summary,
  image_src = excluded.image_src,
  risk_label = excluded.risk_label,
  reward_label = excluded.reward_label,
  action_label = excluded.action_label;

commit;
