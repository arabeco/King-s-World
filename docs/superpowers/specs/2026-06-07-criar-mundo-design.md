# Criar mundo (jogador) + dono + começar — Design

> **Data**: 2026-06-07
> **Contexto**: mundo = temporada (UMA coisa só). Hoje mundos são semeados por
> admin (`12_SQL_SEED`), sem dono registrado. O start-gate (`51`) já existe:
> `kw_begin_world` fecha entrada + agenda início p/ 00:00 do dia seguinte;
> `kw_activate_scheduled_worlds` (cron) flipa open→running. O join por código já
> existe e já bloqueia depois de "começar" (`joins_closed_at`).

## Objetivo

Um jogador cria um mundo (vira dono), convida por **código**, e **só o dono**
aperta "Começar mundo" (que começa às 00:00 do dia seguinte). Versão **enxuta**:
o criador digita só o **nome**; o resto é config padrão.

## Arquitetura

### 1. Banco
- `alter table public.worlds add column if not exists created_by_user_id uuid references public.users(id)`.
- Backfill: setar `created_by_user_id` do Alpha Expresso (`b8b32ba3-...`) p/ o
  usuário operador (id obtido via query no momento da migração).

### 2. Criar mundo — `POST /api/worlds/create`
- Auth: `requireAuthenticatedAppUser()`.
- Body: `{ name: string }` (só o nome).
- Insere uma linha em `worlds` com **config padrão clonada do preset "express"**
  (mesmos valores do mundo atual): `status='open'`, `phase='phase_1'`,
  `day_number=0`, `map_width/height/hex_radius`, `*_move_time_minutes`,
  `player_cap`, `tribe_member_cap`, e as datas NOT NULL do schedule original
  (`registration_opens_at`, `starts_at`, `phase_2_starts_at`, `ends_at`) com
  defaults sensatos relativos a `now()` (respeitando os checks de ordem).
  `created_by_user_id = <user>`. `join_code` gerado (reusa o gerador do `23_SQL_JOIN_CODE`).
- Onboarding do criador: ele **entra no próprio mundo** como jogador (reusa o
  fluxo humano existente que cria `world_player` + capital + `imperial_state`),
  e `ensureWorldFilled` (npc-fill) povoa NPCs. *(Traçar o fluxo exato de
  onboarding humano na implementação — reaproveitar, não reescrever.)*
- Retorna `{ slug, name, join_code, href }`.

### 3. Lobby — botão "Criar mundo"
- Em `components/lobby-world-selector.tsx` (ou `app/lobby/page.tsx`): botão
  "Criar mundo" → input de nome → chama `/api/worlds/create` → mostra o código
  gerado (pra convidar) e navega pro mundo.

### 4. Entrar por código
- **Já existe** (`/api/worlds/join`, `join_code`). **Já bloqueia** quando
  `joins_closed_at` setado (feito). Sem mudança.

### 5. Começar mundo — `POST /api/worlds/[worldId]/begin` + botão (só dono)
- Botão "Começar mundo" no shell do mundo, visível **só** quando
  `world.created_by_user_id === currentUserId` **e** `status==='open'`.
- API: verifica que o caller é o dono → chama `kw_begin_world(world_id)` (service
  role) → retorna o horário de início. UI mostra "Começa às 00:00 (amanhã)" e,
  depois de começado, "Entrada encerrada".
- O payload do mundo (`/api/worlds/[worldId]`) passa a expor `created_by_user_id`,
  `joins_closed_at`, `manual_start_at` pro cliente decidir o botão/estado.

## Fluxo de dados
criar (nome) → insert world (open, dono, código, config padrão) → criador vira
rei + NPCs preenchidos → convida por código → outros entram (open) → dono aperta
"Começar" → `kw_begin_world` (fecha entrada + agenda 00:00) → cron flipa
open→running no 00:00 + re-ancora recursos → Dia 1.

## Tratamento de erro
- `/create`: nome vazio → 400. Falha no insert → 500 (rollback).
- `/begin`: caller não-dono → 403; mundo não 'open' → 409.
- Join após fechar → 403 (já feito).

## Fora de escopo (YAGNI)
- Tela de config elaborada (duração/velocidade/mapa) — só o nome, resto padrão.
- Convite por link/deep link — só o código por enquanto.
- Transferir propriedade do mundo, kickar jogador, etc.

## Verificação
- Criar mundo → aparece no lobby com código.
- Outro usuário entra com o código (open) → vira rei.
- Dono vê "Começar mundo"; não-dono não vê.
- Dono começa → entrada fecha (join 403) → 00:00 vira running (Dia 1).
- `npm run typecheck` + `npm run build` limpos.

## Decisões em aberto (resolver na implementação)
- Valores exatos das datas de schedule padrão (relativas a now, respeitando
  `phase_2_starts_at > starts_at` e `ends_at > phase_2_starts_at`).
- Fluxo exato de onboarding do humano (onde `world_player`+capital+imperial_state
  do humano são criados) — rastrear e reusar.
