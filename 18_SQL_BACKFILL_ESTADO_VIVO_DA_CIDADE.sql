begin;

with imperial_base as (
  select
    wp.id as world_player_id,
    wp.world_id,
    wp.current_capital_site_id as village_site_id,
    wpis.sandbox_snapshots_json,
    concat('capital-', wp.id) as legacy_capital_key
  from public.world_players wp
  join public.world_player_imperial_states wpis
    on wpis.world_player_id = wp.id
  where wp.current_capital_site_id is not null
),
structure_seed as (
  select
    base.world_id,
    base.world_player_id,
    base.village_site_id,
    structure_code,
    greatest(
      0,
      least(
        3,
        coalesce(
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.village_site_id::text, structure_code, 'a'],
            ''
          )::int,
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.legacy_capital_key, structure_code, 'a'],
            ''
          )::int,
          0
        )
      )
    ) as slot_a,
    greatest(
      0,
      least(
        3,
        coalesce(
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.village_site_id::text, structure_code, 'b'],
            ''
          )::int,
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.legacy_capital_key, structure_code, 'b'],
            ''
          )::int,
          0
        )
      )
    ) as slot_b,
    greatest(
      0,
      least(
        3,
        coalesce(
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.village_site_id::text, structure_code, 'c'],
            ''
          )::int,
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.legacy_capital_key, structure_code, 'c'],
            ''
          )::int,
          0
        )
      )
    ) as slot_c,
    greatest(
      0,
      least(
        3,
        coalesce(
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.village_site_id::text, structure_code, 'd'],
            ''
          )::int,
          nullif(
            base.sandbox_snapshots_json #>> array['__clientState','buildingSkillsByVillage', base.legacy_capital_key, structure_code, 'd'],
            ''
          )::int,
          0
        )
      )
    ) as slot_d
  from imperial_base base
  cross join (
    values
      ('crown'),
      ('economy'),
      ('society'),
      ('recruitment'),
      ('defense')
  ) as structures(structure_code)
)
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
  world_id,
  world_player_id,
  village_site_id,
  structure_code,
  slot_a,
  slot_b,
  slot_c,
  slot_d
from structure_seed
on conflict (village_site_id, structure_code) do update
set
  slot_a = excluded.slot_a,
  slot_b = excluded.slot_b,
  slot_c = excluded.slot_c,
  slot_d = excluded.slot_d,
  world_id = excluded.world_id,
  world_player_id = excluded.world_player_id;

with imperial_base as (
  select
    wp.id as world_player_id,
    wp.world_id,
    wp.current_capital_site_id as village_site_id,
    wpis.sandbox_snapshots_json,
    concat('capital-', wp.id) as legacy_capital_key
  from public.world_players wp
  join public.world_player_imperial_states wpis
    on wpis.world_player_id = wp.id
  where wp.current_capital_site_id is not null
)
insert into public.village_city_states (
  village_site_id,
  world_id,
  world_player_id,
  population_current,
  production_focus,
  society_focus,
  barracks_focus,
  defense_protocol,
  production_materials_workers,
  production_supplies_workers,
  production_commerce_workers,
  production_logistics_workers,
  jobs_medics,
  jobs_crafts,
  jobs_order,
  jobs_scholars,
  recruits_militia,
  recruits_shooters,
  recruits_scouts,
  recruits_machinery,
  defense_guards,
  defense_archers,
  defense_ballistae,
  deployed_count
)
select
  base.village_site_id,
  base.world_id,
  base.world_player_id,
  coalesce(
    nullif(
      base.sandbox_snapshots_json #>> array['__clientState','populationByVillage', base.village_site_id::text],
      ''
    )::int,
    nullif(
      base.sandbox_snapshots_json #>> array['__clientState','populationByVillage', base.legacy_capital_key],
      ''
    )::int,
    0
  ) as population_current,
  coalesce(
    nullif(base.sandbox_snapshots_json #>> array['__clientState','productionFocusByVillage', base.village_site_id::text], ''),
    nullif(base.sandbox_snapshots_json #>> array['__clientState','productionFocusByVillage', base.legacy_capital_key], ''),
    'materials'
  ) as production_focus,
  coalesce(
    nullif(base.sandbox_snapshots_json #>> array['__clientState','societyFocusByVillage', base.village_site_id::text], ''),
    nullif(base.sandbox_snapshots_json #>> array['__clientState','societyFocusByVillage', base.legacy_capital_key], ''),
    'order'
  ) as society_focus,
  coalesce(
    nullif(base.sandbox_snapshots_json #>> array['__clientState','barracksFocusByVillage', base.village_site_id::text], ''),
    nullif(base.sandbox_snapshots_json #>> array['__clientState','barracksFocusByVillage', base.legacy_capital_key], ''),
    'garrison'
  ) as barracks_focus,
  coalesce(
    nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseProtocolByVillage', base.village_site_id::text], ''),
    nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseProtocolByVillage', base.legacy_capital_key], ''),
    'hold'
  ) as defense_protocol,
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.village_site_id::text, 'materials'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.legacy_capital_key, 'materials'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.village_site_id::text, 'supplies'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.legacy_capital_key, 'supplies'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.village_site_id::text, 'commerce'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.legacy_capital_key, 'commerce'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.village_site_id::text, 'logistics'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','productionWorkersByVillage', base.legacy_capital_key, 'logistics'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.village_site_id::text, 'medics'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.legacy_capital_key, 'medics'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.village_site_id::text, 'crafts'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.legacy_capital_key, 'crafts'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.village_site_id::text, 'order'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.legacy_capital_key, 'order'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.village_site_id::text, 'scholars'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','jobsByVillage', base.legacy_capital_key, 'scholars'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.village_site_id::text, 'militia'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.legacy_capital_key, 'militia'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.village_site_id::text, 'shooters'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.legacy_capital_key, 'shooters'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.village_site_id::text, 'scouts'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.legacy_capital_key, 'scouts'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.village_site_id::text, 'machinery'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','recruitsByVillage', base.legacy_capital_key, 'machinery'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseRecruitsByVillage', base.village_site_id::text, 'guards'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseRecruitsByVillage', base.legacy_capital_key, 'guards'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseRecruitsByVillage', base.village_site_id::text, 'archers'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseRecruitsByVillage', base.legacy_capital_key, 'archers'], '')::int, 0),
  coalesce(nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseRecruitsByVillage', base.village_site_id::text, 'ballistae'], '')::int, nullif(base.sandbox_snapshots_json #>> array['__clientState','defenseRecruitsByVillage', base.legacy_capital_key, 'ballistae'], '')::int, 0),
  coalesce(
    nullif(base.sandbox_snapshots_json #>> array['__clientState','deployedByVillage', base.village_site_id::text], '')::int,
    nullif(base.sandbox_snapshots_json #>> array['__clientState','deployedByVillage', base.legacy_capital_key], '')::int,
    0
  ) as deployed_count
from imperial_base base
on conflict (village_site_id) do update
set
  world_id = excluded.world_id,
  world_player_id = excluded.world_player_id,
  population_current = excluded.population_current,
  production_focus = excluded.production_focus,
  society_focus = excluded.society_focus,
  barracks_focus = excluded.barracks_focus,
  defense_protocol = excluded.defense_protocol,
  production_materials_workers = excluded.production_materials_workers,
  production_supplies_workers = excluded.production_supplies_workers,
  production_commerce_workers = excluded.production_commerce_workers,
  production_logistics_workers = excluded.production_logistics_workers,
  jobs_medics = excluded.jobs_medics,
  jobs_crafts = excluded.jobs_crafts,
  jobs_order = excluded.jobs_order,
  jobs_scholars = excluded.jobs_scholars,
  recruits_militia = excluded.recruits_militia,
  recruits_shooters = excluded.recruits_shooters,
  recruits_scouts = excluded.recruits_scouts,
  recruits_machinery = excluded.recruits_machinery,
  defense_guards = excluded.defense_guards,
  defense_archers = excluded.defense_archers,
  defense_ballistae = excluded.defense_ballistae,
  deployed_count = excluded.deployed_count;

commit;
