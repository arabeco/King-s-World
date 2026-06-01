-- =============================================================
-- KingsWorld: fechar RLS nas tabelas "UNRESTRICTED" (versão explícita)
-- Rodar TUDO de uma vez no Supabase SQL Editor.
-- Pré-requisito: SUPABASE_SECRET_KEY na Vercel = sb_secret_... (fura RLS)
-- e app redeployado carregando dados normalmente.
-- =============================================================

-- Tabelas (RLS ON, sem policy = anon bloqueada / servidor secret continua):
alter table public.building_catalog               enable row level security;
alter table public.city_diplomats                 enable row level security;
alter table public.imperial_treasuries            enable row level security;
alter table public.map_site_claims                enable row level security;
alter table public.map_site_profiles              enable row level security;
alter table public.map_site_respawns              enable row level security;
alter table public.map_sites                      enable row level security;
alter table public.map_tiles                      enable row level security;
alter table public.movement_resources             enable row level security;
alter table public.movements                      enable row level security;
alter table public.site_troop_stacks              enable row level security;
alter table public.tribe_citadels                 enable row level security;
alter table public.tribe_envoy_commits            enable row level security;
alter table public.tribes                         enable row level security;
alter table public.unit_catalog                   enable row level security;
alter table public.village_city_states            enable row level security;
alter table public.village_construction_caps      enable row level security;
alter table public.village_resource_states        enable row level security;
alter table public.village_specialist_assignments enable row level security;
alter table public.village_structure_states       enable row level security;
alter table public.villages                       enable row level security;
alter table public.world_player_exploration_states enable row level security;
alter table public.world_player_imperial_states   enable row level security;
alter table public.world_player_king_states       enable row level security;
alter table public.world_player_map_orders        enable row level security;
alter table public.world_players                  enable row level security;
alter table public.worlds                         enable row level security;

-- Views: rodar como o usuário que consulta (respeita o RLS das tabelas de baixo)
alter view public.v_imperial_treasury_seed        set (security_invoker = on);
alter view public.v_village_construction_summary  set (security_invoker = on);
alter view public.v_village_resource_eta          set (security_invoker = on);

-- Conferência (deve voltar tudo rls_on = true nas tabelas):
select c.relname as objeto,
       case c.relkind when 'r' then 'tabela' when 'v' then 'view' end as tipo,
       c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v')
order by rls_on, objeto;
