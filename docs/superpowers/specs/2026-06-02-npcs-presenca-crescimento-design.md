# Design: NPCs com Presença e Crescimento (sub-projeto #2, fatia 2a+2b)

Data: 2026-06-02
Status: aprovado (design) — aguardando spec review
Pai: `2026-06-01-online-mundo-arquitetura.md` (sub-projeto #2 — "NPCs jogarem de verdade")

## Problema (auditado em 2026-06-02 — verificado no código, não no commit)

O commit `8bcaf7e` diz *"#3 NPCs ativos: kw_npc_tick faz NPCs crescerem por perfil"*, mas
isso **não é verdade no repo**:

- **`kw_npc_tick` não existe** em nenhum `.sql`/`.ts`/`.mjs`.
- **Nenhuma lógica de NPC em SQL.** Zero.
- O NPC criado por `ensureWorldFilled` (`lib/npc-fill.ts`) é só: `username`, `npc_profile`,
  `is_ai=true`, `status='alive'`, `power_score_cached` **fixo** (~620 decrescente).
- **NPC não tem** `imperial_state`, **não tem** site no mapa, **não tem** posição/tropa.

→ **NPCs hoje são nomes numa lista.** Não existem no mundo, não crescem, não fazem nada.
É por isso que o mundo parece morto.

## Escopo da fatia

Fazer o NPC **existir no mundo e crescer** — o primeiro pedaço de "NPCs jogarem de
verdade". O NPC ganha base no mapa + estado real mínimo + crescimento por perfil no tick.
**Agressão (atacar/expandir) é a fatia 2c; cidades abandonadas é #3** — ficam de fora aqui.

Modelo escolhido: **estado real mínimo** (não score abstrato), pra que o combate da 2c
(`resolve-combat`, já pronto) encaixe direto — o NPC já tem tropas/defesa reais pra lutar.

## Estado atual relevante

- Mapa tem dono de site: `map_sites` + `owner_world_player_id`; o `StrategicMap` já sabe
  mostrar *"Contato hostil em q:r (owner)"* — dá pra renderizar reino rival reusando isso.
- Tick autoritativo existe: `kw_world_tick(p_world_id)` itera `world_players` do mundo e
  settla recurso via `kw_settle_player` (`24_SQL_ANCHOR_RATE_TICK.sql`). Tetos de recurso
  em `26_SQL_RESOURCE_CAP.sql`.
- Jogador tem `world_player_imperial_states` (recurso âncora+taxa, tropas, desenvolvimento).

## Mudanças

### 2a — Presença do NPC no mundo (`27_SQL_...`)

1. **Site no mapa:** ao preencher (`ensureWorldFilled`), cada NPC recebe um `map_sites` com
   `owner_world_player_id = <npc>` numa posição inicial **espalhada** (longe do jogador e dos
   outros NPCs, distância mínima). É a "capital" do NPC.
2. **`imperial_state` mínimo:** criar a linha em `world_player_imperial_states` do NPC com
   defaults coerentes por perfil (recurso inicial, âncora=now, taxa por perfil, tropa inicial
   pequena, desenvolvimento base). Reusa o modelo âncora+taxa já existente.
3. **Render no mapa:** `StrategicMap` passa a buscar e desenhar os sites de NPC do mundo
   (nome do reino + estilo "rival", read-only nesta fatia — sem ação de ataque ainda).

### 2b — Crescimento no tick (`kw_npc_tick`)

1. Criar a RPC `kw_npc_tick(p_world_id)` (`security definer`, `for update`): para cada NPC
   `alive` e `is_ai` do mundo, avança por `npc_profile`:
   - desenvolvimento/recurso/tropa conforme o perfil (metropole→economia, bastiao→defesa,
     posto→tropa, celeiro→suprimento, balanced→equilibrado),
   - atualiza `power_score_cached`.
2. **Determinismo/idempotência:** crescimento proporcional ao tempo desde a última âncora do
   NPC (mesma filosofia do `kw_settle_player` — re-ancora, não acumula delta). Chamar 2×
   seguidas é no-op de efeito. Limitado pelos tetos do `26_SQL`.
3. Chamar `kw_npc_tick` junto do `kw_world_tick` (mesmo `pg_cron`), sob os locks existentes.

## Fluxo

```
join no mundo → ensureWorldFilled → cria NPC (world_player + map_site + imperial_state mínimo)
pg_cron (1 min) → kw_world_tick(world)
                     ├─ kw_settle_player(p) × jogadores (recurso) [já existe]
                     └─ kw_npc_tick(world): cresce cada NPC por perfil (re-ancora) [NOVO]
GET mundo / StrategicMap → desenha sites de NPC com nome + estilo rival [NOVO]
```

## Critérios de sucesso

- Entrar num mundo novo → ver **N reinos IA com nome em posições distintas** no mapa.
- Ao longo do tempo real (tick), o **poder/desenvolvimento dos NPCs sobe** de forma visível e
  diferente por perfil.
- **Idempotência:** rodar `kw_npc_tick` 2× seguidas não duplica crescimento.
- NPC tem `imperial_state` real (recurso/tropa) — base pronta pra 2c.
- Sem regressão: `npm run typecheck` limpo + smoke relevante passa.

## Fora de escopo (fatias seguintes)

- **2c:** NPC atacar/expandir/marchar (agressão) via `resolve-combat` + ETA.
- **#3:** cidades abandonadas disputáveis (alvos de NPC e jogador).
- IA "esperta" (decisões estratégicas reais) — aqui é crescimento por perfil, não decisão.
- PvP humano-vs-humano.

## Pontos abertos de tuning (resolver na implementação)

- Posição inicial dos NPCs (distância mínima do jogador / espalhamento no mapa).
- Taxas de crescimento por perfil (calibrar pra rival crível sem atropelar o jogador).
- Quanto do `imperial_state` mínimo é necessário agora vs. preenchido na 2c.
