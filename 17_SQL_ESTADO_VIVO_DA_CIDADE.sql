begin;

create table if not exists public.village_city_states (
  village_site_id uuid primary key references public.villages(site_id) on delete cascade,
  world_id uuid not null references public.worlds(id) on delete cascade,
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  population_current integer not null default 0 check (population_current >= 0),
  production_focus text not null default 'materials',
  society_focus text not null default 'order',
  barracks_focus text not null default 'garrison',
  defense_protocol text not null default 'hold',
  production_materials_workers integer not null default 0 check (production_materials_workers >= 0),
  production_supplies_workers integer not null default 0 check (production_supplies_workers >= 0),
  production_commerce_workers integer not null default 0 check (production_commerce_workers >= 0),
  production_logistics_workers integer not null default 0 check (production_logistics_workers >= 0),
  jobs_medics integer not null default 0 check (jobs_medics >= 0),
  jobs_crafts integer not null default 0 check (jobs_crafts >= 0),
  jobs_order integer not null default 0 check (jobs_order >= 0),
  jobs_scholars integer not null default 0 check (jobs_scholars >= 0),
  recruits_militia integer not null default 0 check (recruits_militia >= 0),
  recruits_shooters integer not null default 0 check (recruits_shooters >= 0),
  recruits_scouts integer not null default 0 check (recruits_scouts >= 0),
  recruits_machinery integer not null default 0 check (recruits_machinery >= 0),
  defense_guards integer not null default 0 check (defense_guards >= 0),
  defense_archers integer not null default 0 check (defense_archers >= 0),
  defense_ballistae integer not null default 0 check (defense_ballistae >= 0),
  deployed_count integer not null default 0 check (deployed_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint village_city_states_production_focus_check check (
    production_focus in ('materials', 'supplies', 'commerce', 'logistics')
  ),
  constraint village_city_states_society_focus_check check (
    society_focus in ('medics', 'crafts', 'order', 'scholars')
  ),
  constraint village_city_states_barracks_focus_check check (
    barracks_focus in ('garrison', 'shock', 'scouts', 'siege')
  ),
  constraint village_city_states_defense_protocol_check check (
    defense_protocol in ('hold', 'recall', 'alarm')
  )
);

create index if not exists village_city_states_world_player_idx
  on public.village_city_states (world_player_id);

create index if not exists village_city_states_world_idx
  on public.village_city_states (world_id);

create or replace function public.touch_village_city_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_village_city_states_updated_at on public.village_city_states;

create trigger touch_village_city_states_updated_at
before update on public.village_city_states
for each row
execute function public.touch_village_city_states_updated_at();

comment on table public.village_city_states is
  'Estado vivo operacional da cidade: populacao, empregos, focos, recrutamento e defesa local.';

insert into public.village_city_states (
  village_site_id,
  world_id,
  world_player_id,
  population_current
)
select
  v.site_id,
  v.world_id,
  v.owner_world_player_id,
  0
from public.villages v
where v.owner_world_player_id is not null
on conflict (village_site_id) do nothing;

commit;
