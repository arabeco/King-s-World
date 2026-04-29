begin;

alter table public.village_city_states
  add column if not exists city_class text not null default 'neutral',
  add column if not exists city_class_locked boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'village_city_states_city_class_check'
      and conrelid = 'public.village_city_states'::regclass
  ) then
    alter table public.village_city_states
      add constraint village_city_states_city_class_check
      check (city_class in ('neutral', 'metropole', 'posto_avancado', 'bastiao', 'celeiro'));
  end if;
end $$;

update public.village_city_states vcs
set
  city_class = coalesce(v.city_class::text, vcs.city_class, 'neutral'),
  city_class_locked = coalesce(v.city_class_locked, vcs.city_class_locked, false)
from public.villages v
where v.site_id = vcs.village_site_id
  and vcs.city_class = 'neutral'
  and coalesce(v.city_class::text, 'neutral') <> 'neutral';

comment on column public.village_city_states.city_class is
  'Vocacao fixa da cidade no modelo vivo: neutral, metropole, posto_avancado, bastiao ou celeiro.';

comment on column public.village_city_states.city_class_locked is
  'Quando true, a vocacao nao pode mais ser alterada sem uma regra explicita de custo/troca.';

commit;
