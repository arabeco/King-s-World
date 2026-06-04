-- =============================================================
-- KingsWorld #2 / 2c-conquista (parte 1): cidades de NPC com prédios reais + herói
-- Rodar no SQL Editor (King's World!) APÓS 31. Idempotente.
--
-- - village_structure_states é chaveado por village_site_id → ao conquistar,
--   a infra fica com o site = conquistador HERDA os prédios.
-- - "tamanho da cidade" = soma dos levels das 5 estruturas (usado na conquista).
-- - NPC ganha herói (npc_has_hero) — requisito pra conquistar; some/volta se ferido.
-- =============================================================

-- 1. Herói do NPC (requisito de conquista + risco de ferimento) -----------
alter table public.world_players
  add column if not exists npc_has_hero boolean not null default true,
  add column if not exists npc_hero_recovers_at timestamptz;

-- 2. Prédios reais por cidade de NPC (5 estruturas, evolução por perfil) ---
-- estrutura principal do perfil sobe ao máximo; as outras ficam médias.
insert into public.village_structure_states
  (world_id, world_player_id, village_site_id, structure_code, slot_a, slot_b, slot_c, slot_d)
select
  v.world_id, v.owner_world_player_id, v.site_id, sc.code,
  case when sc.code = main.code then 3 else 1 end,
  case when sc.code = main.code then 3 else 1 end,
  case when sc.code = main.code then 2 else 1 end,
  case when sc.code = main.code then 2 else 0 end
from public.villages v
join public.world_players wp on wp.id = v.owner_world_player_id and wp.is_ai and wp.status='alive'
cross join (values ('crown'),('economy'),('society'),('recruitment'),('defense')) as sc(code)
join lateral (
  select case wp.npc_profile
           when 'metropole'      then 'economy'
           when 'celeiro'        then 'economy'
           when 'posto_avancado' then 'recruitment'
           when 'bastiao'        then 'defense'
           else 'crown'
         end as code
) main on true
on conflict (village_site_id, structure_code) do nothing;

-- =============================================================
-- Conferência: cidades de NPC com prédios + tamanho (soma dos levels)
--   select wp.npc_profile, count(*) as estruturas, sum(vss.level) as tamanho_cidade
--   from public.world_players wp
--   join public.villages v on v.owner_world_player_id = wp.id
--   join public.village_structure_states vss on vss.village_site_id = v.site_id
--   where wp.is_ai group by wp.id, wp.npc_profile order by tamanho_cidade desc limit 12;
-- =============================================================
