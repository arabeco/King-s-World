# Criar mundo (jogador) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** Um jogador cria um mundo (vira dono), convida por código, e só o dono aperta "Começar mundo" (start-gate já pronto: 00:00 do dia seguinte).

**Architecture:** Reaproveita ao máximo o que existe — `generate_world_join_code()` (23), o onboarding humano `ensurePlayerCapital` + seed de imperial_state (lib/world-data.ts), `ensureWorldFilled` (npc-fill), o start-gate `kw_begin_world` (51) e o join-block (já feito). O único código novo: coluna `created_by_user_id`, `POST /api/worlds/create`, botão no lobby, expor campos no payload, `POST /api/worlds/[worldId]/begin` + botão do dono.

**Tech Stack:** Next.js (app router) + Supabase (PostgREST via lib/supabase-rest.ts) + plpgsql RPC.

---

## File Structure
- **SQL (rodar no Supabase):** `52_SQL_CRIAR_MUNDO.sql` — coluna `created_by_user_id` + backfill Alpha Expresso.
- **Create:** `app/api/worlds/create/route.ts` — POST cria mundo + onboard criador.
- **Begin:** `app/api/worlds/[worldId]/begin/route.ts` — POST dono → kw_begin_world.
- **Modify:** `components/lobby-world-selector.tsx` — botão "Criar mundo".
- **Modify:** `app/api/worlds/[worldId]/route.ts` (payload) — expor `created_by_user_id`, `joins_closed_at`, `manual_start_at`.
- **Modify:** `components/world-shell.tsx` — botão "Começar mundo" (só dono, status open).
- **Reuse (não reescrever):** `lib/world-data.ts:753` `ensurePlayerCapital`, o orquestrador de entrada humana, `lib/npc-fill.ts` `ensureWorldFilled`, `lib/supabase-rest.ts`.

---

### Task 0: Rastrear o orquestrador de entrada humana

**Files:** ler `lib/world-data.ts`, `lib/app-user.ts`, `app/api/worlds/[worldId]/route.ts`.

- [ ] **Step 1:** Achar a função que, dado `worldId` + usuário logado, garante o `world_players` (linka user_id↔world), o `world_player_imperial_states` (seed) e chama `ensurePlayerCapital`. Procurar quem chama `ensurePlayerCapital` (world-data.ts:753). Anotar o nome/assinatura (ex. `ensureWorldAccess(worldSlugOrId, user)`).
- [ ] **Step 2:** Confirmar como o `world_player` recebe `user_id` e `username`. Anotar a coluna de link (ex. `world_players.user_id`).
- [ ] **Step 3:** Sem código a commitar — é levantamento. Registrar o nome do orquestrador como `ENTER_FN` pras tasks seguintes.

---

### Task 1: Coluna de dono + backfill (SQL)

**Files:** Create `52_SQL_CRIAR_MUNDO.sql`

- [ ] **Step 1:** Escrever o SQL:
```sql
alter table public.worlds
  add column if not exists created_by_user_id uuid references public.users(id);

-- Backfill: dono do Alpha Expresso = usuário operador.
-- Troque <USER_ID> pelo id do teu usuário:
--   select id, email from public.users order by created_at limit 20;
update public.worlds
   set created_by_user_id = '<USER_ID>'::uuid, updated_at = now()
 where id = 'b8b32ba3-07b6-464b-b283-7774fd04aafb';
```
- [ ] **Step 2:** Usuário roda no SQL Editor; confere `select id, name, created_by_user_id from worlds`.
- [ ] **Step 3:** Commit do arquivo.

---

### Task 2: API `POST /api/worlds/create`

**Files:** Create `app/api/worlds/create/route.ts`

- [ ] **Step 1:** Implementar: auth via `requireAuthenticatedAppUser()`; body `{ name }`; validar nome (não vazio, trim, <= 40 chars). Gerar `join_code` via RPC `generate_world_join_code` (chamar por `supabaseRpc` — ver lib/supabase-rest.ts). Inserir em `worlds` seguindo o preset do seed 12 + datas de schedule relativas a now():
```ts
const slug = slugify(name) + "-" + code6; // único
insert worlds {
  slug, name, status:'open', phase:'phase_1', day_number:0,
  player_cap:50, tribe_member_cap:10, map_width:81, map_height:81, map_hex_radius:40,
  base_move_time_minutes:11, road_move_time_minutes:4,
  registration_opens_at: now, starts_at: now+1d, phase_2_starts_at: now+15d, ends_at: now+30d,
  runtime_started:false, runtime_real_time_enabled:false, runtime_anchor_day:0,
  join_code, created_by_user_id: user.id,
}
```
- [ ] **Step 2:** Após inserir, chamar o `ENTER_FN` (Task 0) pro criador (cria world_player + imperial_state + capital) e `ensureWorldFilled(worldId, slug)` (NPCs). Não-fatal: se NPC fill falhar, segue.
- [ ] **Step 3:** Retornar `{ slug, name, join_code, href: '/world/<slug>/intelligence' }`.
- [ ] **Step 4:** Testar manual: `curl -X POST .../api/worlds/create -d '{"name":"Teste"}'` (logado) → 200 com join_code. `npm run build`.
- [ ] **Step 5:** Commit.

---

### Task 3: Botão "Criar mundo" no lobby

**Files:** Modify `components/lobby-world-selector.tsx`

- [ ] **Step 1:** Adicionar botão "Criar mundo" → abre input de nome → `fetch('/api/worlds/create', {method:'POST', body:{name}})` → on success mostra o `join_code` (copiável) e `router.push(href)`. Reusar o estilo de botão existente (`.primary-button`).
- [ ] **Step 2:** Estados: loading, erro (nome vazio → mensagem).
- [ ] **Step 3:** `npm run typecheck` + `build`. Commit.

---

### Task 4: Expor campos do dono/gate no payload do mundo

**Files:** Modify `app/api/worlds/[worldId]/route.ts` e o tipo do payload (lib/world-runtime.ts WorldPayload).

- [ ] **Step 1:** No SELECT do mundo, incluir `created_by_user_id, joins_closed_at, manual_start_at`. Adicionar ao `worldMeta` do payload: `createdByUserId`, `joinsClosedAt`, `manualStartAt`, e `currentUserId` (do usuário logado).
- [ ] **Step 2:** Atualizar o tipo `WorldPayload`/`worldMeta` em lib/world-runtime.ts.
- [ ] **Step 3:** `npm run typecheck`. Commit.

---

### Task 5: API `POST /api/worlds/[worldId]/begin`

**Files:** Create `app/api/worlds/[worldId]/begin/route.ts`

- [ ] **Step 1:** Auth; buscar world (`select id,status,created_by_user_id`). Verificar `created_by_user_id === user.id` senão 403. Verificar `status==='open'` senão 409.
- [ ] **Step 2:** Chamar RPC `kw_begin_world(world_id)` via service role (supabaseRpc). Retornar `{ startsAt }`.
- [ ] **Step 3:** `npm run build`. Commit.

---

### Task 6: Botão "Começar mundo" (só dono)

**Files:** Modify `components/world-shell.tsx`

- [ ] **Step 1:** No header (perto do "?"), se `worldMeta.createdByUserId === worldMeta.currentUserId` E `world.status==='open'` E `!worldMeta.joinsClosedAt`: botão "Começar mundo" → `POST /api/worlds/[id]/begin` → on success mostra "Começa às 00:00".
- [ ] **Step 2:** Se `joinsClosedAt` setado: mostrar "Entrada encerrada · começa em <horário>".
- [ ] **Step 3:** `npm run typecheck` + `build`. Commit.

---

## Self-Review
- **Spec coverage:** schema (T1), create (T2), lobby (T3), join (já feito), begin+botão (T4-6), backfill (T1). ✓
- **Dependência:** T2 e T5/T6 dependem do `ENTER_FN` (T0) e dos campos do payload (T4). Ordem: T0→T1→T4→T2→T3→T5→T6.
- **Placeholders:** `<USER_ID>` é input do usuário (documentado como tal). `ENTER_FN` é resolvido em T0 antes de T2 usá-lo.

## Verificação final
- Criar mundo no lobby → código aparece → outro user entra com código → dono vê "Começar mundo", não-dono não → dono começa → join 403 → 00:00 vira running (Dia 1).
- `npm run typecheck` + `npm run build` limpos.
