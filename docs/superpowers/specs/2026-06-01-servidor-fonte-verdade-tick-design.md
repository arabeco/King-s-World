# Design: Servidor = Fonte da Verdade + Tick Híbrido (sub-projeto #1 — esqueleto andante)

Data: 2026-06-01
Status: aprovado (design) — aguardando spec review
Pai: `2026-06-01-online-mundo-arquitetura.md` (sub-projeto #1)

## Objetivo da fatia

Provar a **fundação do mundo online** ponta a ponta com a menor superfície possível:
um tick de servidor (pg_cron → RPC com lock) que torna **autoritativos no servidor** os
dois estoques de recurso do jogador — **materiais e suprimentos** — de forma **idempotente,
determinística e segura sob concorrência**. Tudo o mais (tropas, prédios, cidade, NPCs,
combate, ETA de marcha) continua como está e entra nas fatias seguintes (#2–#5).

É um **esqueleto andante**: poucos campos migrados, mas todas as peças de risco do #1
exercitadas de verdade (cron, lock, idempotência, migração de estado, fonte da verdade
movida do cliente pro servidor).

## Estado atual (auditado em 2026-06-01)

- `app/api/worlds/[worldId]/imperial-state/route.ts` é **client-authoritative**: o PUT
  recebe o `nextState` já calculado pelo cliente e só normaliza/grava. `materials_stock` e
  `supplies_stock` vêm prontos do cliente — o servidor não resolve produção/consumo.
- O "dia" é **contínuo, derivado de tempo real**: `runtime_anchor_started_at` +
  `runtime_game_day_seconds` (86400 no mundo real, 600 no êxodo de teste). O cliente
  (`lib/world-runtime.ts`) calcula o dia sozinho. Ninguém *processa* a passagem do tempo
  no servidor.
- Já existe o molde para operação atômica/idempotente/locked: a RPC
  `grant_kw_entitlement` (arquivo `22_SQL_RPC_GRANT_ENTITLEMENT.sql`) — `security definer`
  + `select ... for update` + idempotência. `pg_cron` ainda **não** é usado.
- Migrations são arquivos SQL numerados, rodados à mão no Supabase SQL Editor.

## Princípio de design: integrar a partir de uma âncora (não somar deltas)

O mundo é **vivo em tempo contínuo** (decisão do dono), não em saltos de dia. Para que
tempo contínuo seja seguro contra retries/duplicação, o servidor **não acumula deltas a
cada tick**. Em vez disso, guarda para cada estoque uma tripla:

```
(anchor_value, anchor_at, rate_per_sec)
```

- **Leitura do estoque agora** = `anchor_value + rate_per_sec × (now − anchor_at)`.
  Função pura do tempo: calcular 1× ou N× dá o mesmo número.
- **O tick não soma nada — ele re-ancora ("settle"):** lê o valor derivado em `now`,
  grava como novo `anchor_value` e `anchor_at = now`. Re-ancorar duas vezes seguidas é
  no-op de efeito → **idempotente por construção**, sem precisar de `last_processed_day`.
- O `day_number` contínuo já existente **continua igual** (também é função pura do tempo).
  Mundo vivo e relógio de dia convivem.

### Materiais vs. suprimentos

- **Materiais**: só produção → `rate_per_sec ≥ 0`. Cresce monotonicamente entre gastos.
- **Suprimentos**: produção **menos** consumo (população/tropas) → `rate_per_sec` é
  **líquida e pode ser negativa**. O modelo âncora+taxa lida com isso naturalmente, com
  duas regras explícitas:
  - **Clamp em 0 na leitura**: `max(0, anchor_value + rate × elapsed)`.
  - **Déficit (taxa negativa cruzando zero)**: quando o valor derivado chega a 0, ele
    **não fica negativo**. O efeito de "ficar sem suprimento" (penalidade) é registrado a
    partir do instante do cruzamento, mas **a modelagem da penalidade em si fica fora desta
    fatia** — aqui só garantimos que o estoque nunca vai abaixo de 0 e que o instante de
    esgotamento é calculável de forma determinística.

## Componentes

### 1. Schema — colunas de âncora (`24_SQL_...`)

Novo arquivo SQL numerado adiciona em `public.world_player_imperial_states`:

| coluna | tipo | nota |
|---|---|---|
| `materials_anchor_value` | numeric | valor no instante da âncora |
| `materials_anchor_at` | timestamptz | instante da âncora |
| `materials_rate_per_sec` | numeric | ≥ 0 |
| `supplies_anchor_value` | numeric | valor no instante da âncora |
| `supplies_anchor_at` | timestamptz | instante da âncora |
| `supplies_rate_per_sec` | numeric | líquida (pode ser < 0) |

**Backfill** (no mesmo arquivo): `*_anchor_value = *_stock` atual, `*_anchor_at = now()`,
`*_rate_per_sec` derivada da config de produção/consumo atual do jogador. Os campos
`materials_stock`/`supplies_stock` permanecem (espelho legível / fallback) mas **deixam de
ser fonte da verdade** — passam a ser materializados a partir da âncora no settlement.

### 2. RPC de settlement/tick (`security definer`, locked, idempotente)

Duas RPCs no molde do `grant_kw_entitlement`:

- `kw_settle_player(p_world_player_id)` — núcleo reutilizável:
  1. `select ... for update` na linha do jogador (lock).
  2. Para materiais e suprimentos: `derived = clamp0(anchor_value + rate × (now − anchor_at))`;
     grava `anchor_value = derived`, `anchor_at = now`; espelha em `*_stock`.
  3. Commit.
  Chamar 2× seguidas é no-op de efeito.
- `kw_world_tick(p_world_id)` — o tick do mundo:
  1. `select ... for update` na linha do mundo (lock; serializa tick vs. tick).
  2. Itera os jogadores `alive` do mundo e chama o settlement de cada um.
  3. Commit.

**Concorrência (risco #4):** ação do jogador que mexe em recurso (ex.: gastar materiais)
chama `kw_settle_player` **antes** de aplicar — lock → settle até agora → aplica o delta da
ação sobre `anchor_value` → commit. Tick e ação fazem a **mesma** operação determinística
sob lock, então nunca se corrompem. Gastar é seguro porque o valor está sempre "settled até
agora" antes do delta; o clamp em 0 impede gasto abaixo do disponível.

### 3. Agendador (`pg_cron`)

`pg_cron` chama `kw_world_tick` para cada mundo `running`. **Intervalo proposto: 1 min.**
Como o valor real é função pura do tempo, re-ancorar mais ou menos vezes **não muda o
resultado** — a frequência é puramente operacional (materializar/persistir e servir de
ponto de resolução pra eventos futuros), e pode ser afrouxada/apertada depois sem risco.

### 4. Leitura / cliente

- O **GET** de `imperial-state` passa a devolver materiais e suprimentos **derivados da
  âncora** (não o `*_stock` cru). Opcionalmente devolve a tripla (`anchor_value`,
  `anchor_at`, `rate`) para o cliente interpolar localmente e mostrar o estoque subindo
  **suave** entre fetches (suavidade percebida ≠ frequência do tick).
- O **PUT** do cliente **deixa de poder escrever `materials_stock`/`supplies_stock`
  livremente**. Mutação desses dois passa a ir pela RPC de ação/settlement. O resto do PUT
  (tropas, prédios, cidade, rei, exploração) continua **inalterado** nesta fatia.

## Fluxo de dados

```
pg_cron (1 min)
   └─> kw_world_tick(world)         [lock no mundo]
          └─> kw_settle_player(p)   [lock no jogador] × N jogadores
                 re-ancora materiais e suprimentos -> espelha em *_stock

Ação do jogador (gastar/produzir)
   └─> kw_settle_player(p)          [lock no jogador]
          settle até agora -> aplica delta da ação -> commit

GET imperial-state
   └─> valor = clamp0(anchor_value + rate × (now − anchor_at))   [função pura, sem escrita]
```

## Determinismo e idempotência (risco #2)

- Estado autoritativo é **função pura de (âncora, taxa, now)** → recomputar nunca duplica.
- Settlement é **re-âncora**, não acumulação → retry/disparo duplicado do cron é no-op.
- Locks (`for update`) serializam tick-vs-ação e tick-vs-tick.
- Sem `last_processed_day` e sem catch-up de dias discretos — o modelo contínuo dispensa.

## Migração sem perda (risco #3)

- Backfill 1:1 dos `*_stock` atuais para `*_anchor_value`, `anchor_at = now()`.
- `*_stock` mantidos como espelho/fallback durante a transição (mesmo padrão das outras
  tabelas, que toleram migração ainda não rodada).
- Nenhum progresso de jogador é perdido; o valor visível no instante da migração é idêntico.

## Critérios de sucesso

- `pg_cron` agendado dispara `kw_world_tick` em mundo `running` sem erro.
- Materiais crescem e suprimentos crescem/decrescem conforme a taxa, derivados por fórmula;
  GET reflete o valor correto a qualquer instante **sem** depender da frequência do tick.
- **Idempotência provada**: chamar `kw_world_tick`/`kw_settle_player` 2× seguidas (ou simular
  retry do cron) **não altera** o estoque além do esperado pelo tempo decorrido.
- **Concorrência provada**: ação de gasto concorrente com o tick não duplica nem perde
  recurso; estoque nunca fica negativo (clamp em 0).
- O PUT do cliente não consegue mais sobrescrever `materials_stock`/`supplies_stock`
  diretamente; o resto do estado continua funcionando como antes.

## Fora de escopo (entra nas fatias #2–#5)

- Tropas, prédios e estado de cidade autoritativos no servidor.
- NPCs ativos, combate no servidor, horda/eventos.
- ETA de ações (marcha/ataque/expansão) resolvidas com tempo de viagem.
- Modelagem da **penalidade** de déficit de suprimento (aqui só garantimos clamp em 0 e
  instante de esgotamento calculável).

## Pontos abertos de tuning (resolver na implementação)

- Intervalo exato do `pg_cron` (proposta: 1 min) e se varia por `runtime_game_day_seconds`
  (mundo de teste 600s vs. real 86400s).
- Fórmula exata da `rate_per_sec` a partir da config de produção/consumo atual (de onde sai
  a taxa: focos de produção, população, tropas estacionadas).
- Se o GET expõe a tripla âncora pro cliente interpolar (suavidade) já nesta fatia ou depois.
