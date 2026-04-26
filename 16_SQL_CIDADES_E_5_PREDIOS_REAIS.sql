begin;

create table if not exists public.village_structure_states (
  world_id uuid not null references public.worlds(id) on delete cascade,
  world_player_id uuid not null references public.world_players(id) on delete cascade,
  village_site_id uuid not null references public.villages(site_id) on delete cascade,
  structure_code text not null,
  slot_a integer not null default 0,
  slot_b integer not null default 0,
  slot_c integer not null default 0,
  slot_d integer not null default 0,
  level integer generated always as (
    least(10, greatest(0, slot_a) + greatest(0, slot_b) + greatest(0, slot_c) + greatest(0, slot_d))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint village_structure_states_pk primary key (village_site_id, structure_code),
  constraint village_structure_states_code_check check (
    structure_code in ('crown', 'economy', 'society', 'recruitment', 'defense')
  ),
  constraint village_structure_states_slot_a_check check (slot_a between 0 and 3),
  constraint village_structure_states_slot_b_check check (slot_b between 0 and 3),
  constraint village_structure_states_slot_c_check check (slot_c between 0 and 3),
  constraint village_structure_states_slot_d_check check (slot_d between 0 and 3)
);

create index if not exists village_structure_states_world_player_idx
  on public.village_structure_states (world_player_id);

create index if not exists village_structure_states_world_idx
  on public.village_structure_states (world_id);

create or replace function public.touch_village_structure_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_village_structure_states_updated_at on public.village_structure_states;

create trigger touch_village_structure_states_updated_at
before update on public.village_structure_states
for each row
execute function public.touch_village_structure_states_updated_at();

comment on table public.village_structure_states is
  'Fonte real dos 5 predios da cidade: Governo, Producao, Sociedade, Quartel e Muralha.';

comment on column public.village_structure_states.structure_code is
  'crown=Governo, economy=Producao, society=Sociedade, recruitment=Quartel, defense=Muralha.';

comment on column public.village_structure_states.level is
  'Nivel oficial do predio, derivado da soma dos quatro pontos da build.';

insert into public.village_structure_states (
  world_id,
  world_player_id,
  village_site_id,
  structure_code,
  slot_a,
  slot_b,
  slot_c,
  slot_d
)
select
  wp.world_id,
  wp.id,
  wp.current_capital_site_id,
  structure_code,
  0,
  0,
  0,
  0
from public.world_players wp
cross join (
  values
    ('crown'),
    ('economy'),
    ('society'),
    ('recruitment'),
    ('defense')
) as structures(structure_code)
where wp.current_capital_site_id is not null
on conflict (village_site_id, structure_code) do nothing;

commit;
