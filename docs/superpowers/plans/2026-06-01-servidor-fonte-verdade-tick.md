# Servidor = Fonte da Verdade + Tick Híbrido (sub-projeto #1, esqueleto andante) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar materiais e suprimentos do jogador **autoritativos no servidor** via modelo âncora+taxa, processados por um tick `pg_cron → RPC` idempotente e seguro sob concorrência — provando a fundação do mundo online ponta a ponta com a menor superfície possível.

**Architecture:** Estado autoritativo guardado como tripla `(anchor_value, anchor_at, rate_per_sec)`. Leitura = `clamp0(anchor_value + rate × elapsed)` (função pura do tempo). O **tick em SQL apenas integra/re-ancora** (sem lógica de jogo no Postgres), sob `for update` lock, no molde da RPC `grant_kw_entitlement`. A **taxa é computada em TS** (onde mora a config de cidade) e gravada nas colunas. `pg_cron` re-ancora a cada minuto; re-ancorar N vezes dá o mesmo resultado → idempotente por construção.

**Tech Stack:** Next.js 14 (App Router, route handlers), TypeScript, Supabase (Postgres + `@supabase/supabase-js`), `pg_cron`. **Sem framework de teste unitário**: a verificação do repo é `npm run typecheck` (tsc) + scripts node `.mjs` em `simulations/` rodando contra o Supabase real (carregam `.env.local`, usam service-role key). Este plano segue esse mesmo toolset.

**Spec:** `docs/superpowers/specs/2026-06-01-servidor-fonte-verdade-tick-design.md`

---

## File Structure

- **Create** `24_SQL_TICK_RECURSO_AUTORITATIVO.sql` — colunas de âncora + backfill + RPCs (`kw_settle_player`, `kw_apply_resource_write`, `kw_world_tick`, `kw_tick_all_running_worlds`) + agendamento `pg_cron`. (Maior número atual no repo é `23_*`; há números duplicados, então `24` é o próximo livre. Conferir no Passo 1.)
- **Create** `lib/imperial-derive.ts` — funções puras `deriveStock()` (leitura) e helpers de tempo. Sem dependência de Supabase; reutilizável por route e smoke.
- **Create** `lib/resource-rate.ts` — `computeResourceRatesPerSecond()`: deriva `materials_rate_per_sec`/`supplies_rate_per_sec` a partir da config da capital + `runtime_game_day_seconds`. Fórmula linear simples do esqueleto (calibração marcada); fatia futura troca por `calculateCityDailyProduction`.
- **Modify** `app/api/worlds/[worldId]/imperial-state/route.ts` — GET devolve materiais/suprimentos **derivados**; PUT roteia a mutação de recurso pela RPC `kw_apply_resource_write` (settle + reconcilia gasto + grava taxa), em vez de confiar no valor cru do cliente.
- **Create** `simulations/smoke-world-tick.mjs` — teste de integração: idempotência do settle, concorrência tick-vs-gasto, e correção da derivação. Self-contained (semeia e limpa suas próprias linhas).

---

## Task 1: Funções puras de derivação (`lib/imperial-derive.ts`)

Começamos pelo núcleo determinístico, sem I/O — é o que todo o resto referencia.

**Files:**
- Create: `lib/imperial-derive.ts`

- [ ] **Step 1: Escrever a lib pura**

```ts
// lib/imperial-derive.ts
// Modelo "âncora + taxa": o estoque autoritativo é função pura do tempo.
// derived(now) = clamp0(anchorValue + ratePerSec * elapsedSeconds)
// Settlement = recomputar derived(now) e gravar como nova âncora (idempotente).

export type ResourceAnchor = {
  anchorValue: number;
  anchorAtMs: number;
  ratePerSec: number;
};

/** Leitura autoritativa do estoque num instante. Nunca negativo. */
export function deriveStock(anchor: ResourceAnchor, nowMs: number): number {
  const elapsedSec = Math.max(0, (nowMs - anchor.anchorAtMs) / 1000);
  const raw = anchor.anchorValue + anchor.ratePerSec * elapsedSec;
  return Math.max(0, raw);
}

/** Re-ancora para `nowMs`: mesmo valor derivado, âncora movida. Idempotente. */
export function settleAnchor(anchor: ResourceAnchor, nowMs: number): ResourceAnchor {
  return {
    anchorValue: deriveStock(anchor, nowMs),
    anchorAtMs: nowMs,
    ratePerSec: anchor.ratePerSec,
  };
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npm run typecheck`
Expected: PASS (sem erros). Se aparecer erro, é só nesta lib nova.

- [ ] **Step 3: Commit**

```bash
git add lib/imperial-derive.ts
git commit -m "feat: lib pura de derivacao ancora+taxa (deriveStock/settleAnchor)"
```

---

## Task 2: Derivação da taxa a partir da config (`lib/resource-rate.ts`)

A lógica de jogo (de onde vem a taxa) fica em TS. Esqueleto: fórmula linear simples a partir dos workers da capital. **Não** usa `calculateCityDailyProduction` ainda (precisa do mapeamento structure-code → BuildingId, que é fidelidade de fatia posterior — ver "Fora de escopo" no spec).

**Files:**
- Create: `lib/resource-rate.ts`

- [ ] **Step 1: Escrever a lib de taxa**

```ts
// lib/resource-rate.ts
// Esqueleto: taxa de produção/consumo linear a partir dos workers da capital.
// Materiais: so producao (>= 0). Suprimentos: producao - consumo de tropas (pode ser < 0).
// Constantes marcadas para CALIBRACAO; fatia futura substitui por calculateCityDailyProduction.

// Espelham a base economica de core/GameBalance.ts (baseMaterials ~30 + ..., perWorker ~8).
const MATERIALS_BASE_PER_DAY = 30;
const MATERIALS_PER_WORKER_PER_DAY = 8; // CALIBRACAO
const SUPPLIES_BASE_PER_DAY = 28;
const SUPPLIES_PER_WORKER_PER_DAY = 7; // CALIBRACAO
const SUPPLY_UPKEEP_PER_TROOP_PER_DAY = 0.5; // CALIBRACAO: faz suprimento poder ficar negativo

export type CapitalProductionConfig = {
  materialsWorkers: number;
  suppliesWorkers: number;
  troopsTotal: number;
};

export type ResourceRates = {
  materialsRatePerSec: number;
  suppliesRatePerSec: number;
};

function clampWorkers(value: number): number {
  return Math.max(0, Math.min(100, Math.floor(Number.isFinite(value) ? value : 0)));
}

export function computeResourceRatesPerSecond(
  config: CapitalProductionConfig,
  gameDaySeconds: number,
): ResourceRates {
  const safeDay = Math.max(1, Math.floor(gameDaySeconds) || 86400);
  const matWorkers = clampWorkers(config.materialsWorkers);
  const supWorkers = clampWorkers(config.suppliesWorkers);
  const troops = Math.max(0, Math.floor(config.troopsTotal) || 0);

  const materialsPerDay = MATERIALS_BASE_PER_DAY + MATERIALS_PER_WORKER_PER_DAY * matWorkers;
  const suppliesPerDay =
    SUPPLIES_BASE_PER_DAY + SUPPLIES_PER_WORKER_PER_DAY * supWorkers - SUPPLY_UPKEEP_PER_TROOP_PER_DAY * troops;

  return {
    materialsRatePerSec: Math.max(0, materialsPerDay) / safeDay,
    suppliesRatePerSec: suppliesPerDay / safeDay, // pode ser negativo
  };
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/resource-rate.ts
git commit -m "feat: derivacao de taxa de recurso por segundo a partir da config da capital"
```

---

## Task 3: Migração SQL — colunas, RPCs e pg_cron (`24_SQL_TICK_RECURSO_AUTORITATIVO.sql`)

O coração do servidor-autoritativo. Arquivo SQL numerado, rodado à mão no Supabase SQL Editor (convenção do repo).

**Files:**
- Create: `24_SQL_TICK_RECURSO_AUTORITATIVO.sql`

- [ ] **Step 1: Confirmar o próximo número de migração**

Run: `ls *.sql`
Expected: o maior número atual é `23_*` (com duplicatas em 22/23). Use **24**. Se por acaso já existir um `24_*`, use **25** e ajuste o nome do arquivo.

- [ ] **Step 2: Escrever o arquivo SQL completo**

```sql
-- =============================================================
-- KingsWorld: Tick de recurso autoritativo (sub-projeto #1)
-- Modelo ancora+taxa. RPCs security definer + for update lock,
-- no molde de 22_SQL_RPC_GRANT_ENTITLEMENT.sql. Idempotente.
-- Rodar no Supabase SQL Editor.
-- =============================================================

-- 1) Colunas de ancora --------------------------------------------------------
alter table public.world_player_imperial_states
  add column if not exists materials_anchor_value numeric not null default 0,
  add column if not exists materials_anchor_at     timestamptz not null default now(),
  add column if not exists materials_rate_per_sec  numeric not null default 0,
  add column if not exists supplies_anchor_value   numeric not null default 0,
  add column if not exists supplies_anchor_at      timestamptz not null default now(),
  add column if not exists supplies_rate_per_sec   numeric not null default 0;

-- 2) Backfill 1:1 dos estoques atuais (rodar UMA vez; seguro re-rodar pois
--    *_stock e' espelhado a cada settle, entao ancora=stock e' consistente).
update public.world_player_imperial_states
set materials_anchor_value = coalesce(materials_stock, 0),
    materials_anchor_at    = now(),
    supplies_anchor_value  = coalesce(supplies_stock, 0),
    supplies_anchor_at     = now();

-- 3) Settle de um jogador: re-ancora materiais e suprimentos para now(). ------
--    Idempotente: chamar 2x seguidas e' no-op de efeito.
create or replace function public.kw_settle_player(p_world_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r        public.world_player_imperial_states%rowtype;
  now_ts   timestamptz := now();
  mat      numeric;
  sup      numeric;
  mat_el   numeric;
  sup_el   numeric;
begin
  select * into r
  from public.world_player_imperial_states
  where world_player_id = p_world_player_id
  for update;
  if not found then
    return;
  end if;

  mat_el := greatest(0, extract(epoch from (now_ts - coalesce(r.materials_anchor_at, now_ts))));
  sup_el := greatest(0, extract(epoch from (now_ts - coalesce(r.supplies_anchor_at, now_ts))));
  mat := greatest(0, coalesce(r.materials_anchor_value, 0) + coalesce(r.materials_rate_per_sec, 0) * mat_el);
  sup := greatest(0, coalesce(r.supplies_anchor_value, 0) + coalesce(r.supplies_rate_per_sec, 0) * sup_el);

  update public.world_player_imperial_states
  set materials_anchor_value = mat,
      materials_anchor_at     = now_ts,
      materials_stock         = floor(mat),
      supplies_anchor_value   = sup,
      supplies_anchor_at      = now_ts,
      supplies_stock          = floor(sup)
  where world_player_id = p_world_player_id;
end;
$$;

-- 4) Escrita de recurso vinda do cliente: settle, reconcilia GASTO (so quedas)
--    e grava a taxa nova. Producao (aumento do cliente) e' IGNORADA — e' do
--    servidor. Tudo sob o mesmo lock. -----------------------------------------
create or replace function public.kw_apply_resource_write(
  p_world_player_id   uuid,
  p_client_materials  numeric,
  p_client_supplies   numeric,
  p_materials_rate    numeric,
  p_supplies_rate     numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.world_player_imperial_states%rowtype;
  now_ts     timestamptz := now();
  cur_mat    numeric;
  cur_sup    numeric;
  spent_mat  numeric;
  spent_sup  numeric;
  new_mat    numeric;
  new_sup    numeric;
begin
  select * into r
  from public.world_player_imperial_states
  where world_player_id = p_world_player_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  -- valor autoritativo agora (settle implicito)
  cur_mat := greatest(0, coalesce(r.materials_anchor_value, 0)
            + coalesce(r.materials_rate_per_sec, 0)
            * greatest(0, extract(epoch from (now_ts - coalesce(r.materials_anchor_at, now_ts)))));
  cur_sup := greatest(0, coalesce(r.supplies_anchor_value, 0)
            + coalesce(r.supplies_rate_per_sec, 0)
            * greatest(0, extract(epoch from (now_ts - coalesce(r.supplies_anchor_at, now_ts)))));

  -- so quedas contam como gasto; aumentos do cliente sao ignorados
  spent_mat := greatest(0, cur_mat - coalesce(p_client_materials, cur_mat));
  spent_sup := greatest(0, cur_sup - coalesce(p_client_supplies, cur_sup));
  new_mat := greatest(0, cur_mat - spent_mat);
  new_sup := greatest(0, cur_sup - spent_sup);

  update public.world_player_imperial_states
  set materials_anchor_value = new_mat,
      materials_anchor_at     = now_ts,
      materials_rate_per_sec  = coalesce(p_materials_rate, materials_rate_per_sec),
      materials_stock         = floor(new_mat),
      supplies_anchor_value   = new_sup,
      supplies_anchor_at      = now_ts,
      supplies_rate_per_sec   = coalesce(p_supplies_rate, supplies_rate_per_sec),
      supplies_stock          = floor(new_sup)
  where world_player_id = p_world_player_id;

  return jsonb_build_object('ok', true, 'materials', floor(new_mat), 'supplies', floor(new_sup));
end;
$$;

-- 5) Tick de um mundo: settle de cada jogador vivo, sob lock do mundo. --------
create or replace function public.kw_world_tick(p_world_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  w   public.worlds%rowtype;
  pid uuid;
  n   integer := 0;
begin
  select * into w from public.worlds where id = p_world_id for update;
  if not found or w.status <> 'running' then
    return 0;
  end if;

  for pid in
    select id from public.world_players where world_id = p_world_id and status = 'alive'
  loop
    perform public.kw_settle_player(pid);
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- 6) Wrapper do cron: tick de todos os mundos running. -----------------------
create or replace function public.kw_tick_all_running_worlds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  wid   uuid;
  total integer := 0;
begin
  for wid in select id from public.worlds where status = 'running'
  loop
    total := total + public.kw_world_tick(wid);
  end loop;
  return total;
end;
$$;

-- 7) Seguranca: so service_role chama. ---------------------------------------
revoke all on function public.kw_settle_player(uuid)                       from public, authenticated, anon;
revoke all on function public.kw_apply_resource_write(uuid, numeric, numeric, numeric, numeric) from public, authenticated, anon;
revoke all on function public.kw_world_tick(uuid)                          from public, authenticated, anon;
revoke all on function public.kw_tick_all_running_worlds()                 from public, authenticated, anon;
grant execute on function public.kw_settle_player(uuid)                       to service_role;
grant execute on function public.kw_apply_resource_write(uuid, numeric, numeric, numeric, numeric) to service_role;
grant execute on function public.kw_world_tick(uuid)                          to service_role;
grant execute on function public.kw_tick_all_running_worlds()                 to service_role;

-- 8) Agendamento pg_cron: a cada 1 min. --------------------------------------
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'kw_world_tick_every_minute') then
    perform cron.unschedule('kw_world_tick_every_minute');
  end if;
end $$;
select cron.schedule(
  'kw_world_tick_every_minute',
  '* * * * *',
  $$select public.kw_tick_all_running_worlds();$$
);
```

- [ ] **Step 3: Aplicar no Supabase**

Cole o arquivo no **Supabase SQL Editor** (projeto linkado em `supabase/.temp/linked-project.json`) e rode. `pg_cron` precisa estar habilitado no projeto (Database → Extensions → `pg_cron`); o `create extension if not exists` cuida disso se você tiver permissão.
Expected: sem erro; `cron.schedule` retorna um `jobid` inteiro.

- [ ] **Step 4: Smoke manual rápido da RPC**

No SQL Editor: `select public.kw_tick_all_running_worlds();`
Expected: retorna um inteiro (nº de jogadores settled; 0 se não houver mundo running). Sem erro de função inexistente.

- [ ] **Step 5: Commit**

```bash
git add 24_SQL_TICK_RECURSO_AUTORITATIVO.sql
git commit -m "feat(sql): tick de recurso autoritativo (ancora+taxa) com pg_cron + RPCs locked"
```

---

## Task 4: GET devolve valores derivados (`imperial-state/route.ts`)

A fonte da verdade de materiais/suprimentos passa a ser a âncora.

**Files:**
- Modify: `app/api/worlds/[worldId]/imperial-state/route.ts`

- [ ] **Step 1: Adicionar import e as colunas de âncora ao SELECT do GET**

No topo do arquivo, junto aos imports existentes:

```ts
import { deriveStock } from "@/lib/imperial-derive";
```

No tipo `StoredImperialStateRow`, adicionar os campos de âncora:

```ts
  materials_anchor_value: number;
  materials_anchor_at: string;
  materials_rate_per_sec: number;
  supplies_anchor_value: number;
  supplies_anchor_at: string;
  supplies_rate_per_sec: number;
```

No `search.set("select", "...")` do GET, acrescentar ao final da string de colunas (antes de `logs_json`):

```
,materials_anchor_value,materials_anchor_at,materials_rate_per_sec,supplies_anchor_value,supplies_anchor_at,supplies_rate_per_sec
```

- [ ] **Step 2: Derivar materiais/suprimentos antes de responder**

No GET, logo após obter `rows[0]` e antes de montar a resposta `NextResponse.json({ imperialState: { ... } })`, calcular os valores derivados a partir da linha crua:

```ts
    const storedRow = rows[0];
    const nowMs = Date.now();
    const derivedMaterials = storedRow
      ? Math.floor(
          deriveStock(
            {
              anchorValue: Number(storedRow.materials_anchor_value ?? storedRow.materials_stock ?? 0),
              anchorAtMs: storedRow.materials_anchor_at ? Date.parse(storedRow.materials_anchor_at) : nowMs,
              ratePerSec: Number(storedRow.materials_rate_per_sec ?? 0),
            },
            nowMs,
          ),
        )
      : 0;
    const derivedSupplies = storedRow
      ? Math.floor(
          deriveStock(
            {
              anchorValue: Number(storedRow.supplies_anchor_value ?? storedRow.supplies_stock ?? 0),
              anchorAtMs: storedRow.supplies_anchor_at ? Date.parse(storedRow.supplies_anchor_at) : nowMs,
              ratePerSec: Number(storedRow.supplies_rate_per_sec ?? 0),
            },
            nowMs,
          ),
        )
      : 0;
```

Em seguida, no objeto `resources` que hoje vem de `mapRowToImperialState` (que usa `row.materials_stock`/`row.supplies_stock`), sobrescrever com os valores derivados. Na resposta `NextResponse.json`, dentro do objeto `imperialState`, adicionar:

```ts
        resources: {
          ...(isRecord((imperialState as Record<string, unknown>).resources)
            ? (imperialState as Record<string, unknown>).resources as Record<string, unknown>
            : {}),
          materials: derivedMaterials,
          supplies: derivedSupplies,
          influence: 0,
        },
```

(Coloque essa chave `resources` **depois** dos spreads existentes, para que ela vença.)

- [ ] **Step 3: Verificar compilação**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/api/worlds/[worldId]/imperial-state/route.ts"
git commit -m "feat(api): GET imperial-state devolve materiais/suprimentos derivados da ancora"
```

---

## Task 5: PUT roteia mutação de recurso pela RPC (`imperial-state/route.ts`)

O cliente deixa de ser fonte da verdade dos dois recursos: gasto é honrado como queda; produção é ignorada; a taxa é recomputada em TS.

**Files:**
- Modify: `app/api/worlds/[worldId]/imperial-state/route.ts`

- [ ] **Step 1: Imports da taxa e do RPC**

No topo:

```ts
import { computeResourceRatesPerSecond } from "@/lib/resource-rate";
import { supabaseRpc } from "@/lib/supabase-rest";
```

(`supabaseUpsert`/`supabaseSelect` já são importados de `@/lib/supabase-rest`; só acrescente `supabaseRpc` à lista existente.)

- [ ] **Step 2: Buscar `runtime_game_day_seconds` do mundo no PUT**

No início do `PUT`, depois de `const payload = await getWorldPayload(params.worldId);` e da checagem de `worldPlayerId`, buscar a duração do dia do mundo:

```ts
    const worldRows = await supabaseSelect<{ runtime_game_day_seconds: number | null }>(
      "worlds",
      (() => {
        const p = new URLSearchParams();
        p.set("select", "runtime_game_day_seconds");
        p.set("id", `eq.${payload.world.id}`);
        p.set("limit", "1");
        return p;
      })(),
    );
    const gameDaySeconds = Number(worldRows[0]?.runtime_game_day_seconds ?? 86400);
```

- [ ] **Step 3: Computar a taxa a partir da capital e chamar a RPC**

Depois do `await supabaseUpsert("world_player_imperial_states", { ... })` existente (que cria/atualiza a linha e demais campos), e **antes** do `return`, inserir:

```ts
    const capitalId =
      typeof nextStateRecord.royalCapitalVillageId === "string"
        ? nextStateRecord.royalCapitalVillageId
        : payload.world.activeVillageId;
    const workersByVillage = isRecord(nextStateRecord.productionWorkersByVillage)
      ? nextStateRecord.productionWorkersByVillage
      : {};
    const capitalWorkers = isRecord(workersByVillage[capitalId]) ? workersByVillage[capitalId] : {};
    const troopsTotal =
      Number(nextTroops.militia ?? 0) +
      Number(nextTroops.shooters ?? 0) +
      Number(nextTroops.scouts ?? 0) +
      Number(nextTroops.machinery ?? 0);

    const rates = computeResourceRatesPerSecond(
      {
        materialsWorkers: Number(capitalWorkers.materials ?? 0),
        suppliesWorkers: Number(capitalWorkers.supplies ?? 0),
        troopsTotal,
      },
      gameDaySeconds,
    );

    await supabaseRpc("kw_apply_resource_write", {
      p_world_player_id: payload.worldPlayerId,
      p_client_materials: Number(nextResources.materials ?? 0),
      p_client_supplies: Number(nextResources.supplies ?? 0),
      p_materials_rate: rates.materialsRatePerSec,
      p_supplies_rate: rates.suppliesRatePerSec,
    });
```

> Nota: o `supabaseUpsert` existente ainda grava `materials_stock`/`supplies_stock` com o valor do cliente, mas a chamada `kw_apply_resource_write` logo em seguida **sobrescreve** ambos com o valor autoritativo reconciliado. Pode deixar o upsert como está (mais simples e garante que a linha exista antes da RPC).

- [ ] **Step 4: Verificar compilação**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/worlds/[worldId]/imperial-state/route.ts"
git commit -m "feat(api): PUT imperial-state roteia recurso pela RPC kw_apply_resource_write (settle+gasto+taxa)"
```

---

## Task 6: Teste de integração — idempotência e concorrência (`smoke-world-tick.mjs`)

Red-green real contra o Supabase: semeia um mundo+jogador, exercita as RPCs, asserta, limpa.

**Files:**
- Create: `simulations/smoke-world-tick.mjs`

- [ ] **Step 1: Escrever o smoke (espelha o padrão de `simulations/smoke-world-create.mjs`)**

> **Nota sobre o seed:** a tabela `worlds` pode ter colunas `not null` sem default (ex.: `map_width`, `map_height`, `base_move_time_minutes`, `starts_at`). Se o `insert` do mundo falhar com erro de `null value in column ...`, copie o `buildPayload()` de `simulations/smoke-world-create.mjs` (que já tem o conjunto completo de colunas) e só sobrescreva `slug`, `status: "running"` e `runtime_game_day_seconds: 86400`. O mesmo vale para `users`/`world_players` se houver colunas obrigatórias além das usadas aqui.

```js
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();

function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}
loadLocalEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("FALTA env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY/SECRET_KEY");
  process.exit(2);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const SUFFIX = `tick_${Date.now()}`;
let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} - ${name}`);
  if (!cond) failures += 1;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // --- seed: world running + user + world_player + imperial_state ---
  const { data: world, error: we } = await db
    .from("worlds")
    .insert({ slug: `smoke-${SUFFIX}`, name: "Smoke Tick", status: "running", day_number: 0,
              runtime_game_day_seconds: 86400 })
    .select().single();
  if (we) throw new Error(`seed world: ${we.message}`);

  const { data: user, error: ue } = await db
    .from("users").insert({ username: `smoke_${SUFFIX}`, email: `${SUFFIX}@smoke.local` })
    .select().single();
  if (ue) throw new Error(`seed user: ${ue.message}`);

  const { data: wp, error: pe } = await db
    .from("world_players").insert({ world_id: world.id, user_id: user.id, status: "alive" })
    .select().single();
  if (pe) throw new Error(`seed world_player: ${pe.message}`);

  // estado: 1000 materiais, taxa 10/seg; 1000 suprimentos, taxa -5/seg
  const t0 = new Date().toISOString();
  const { error: ie } = await db.from("world_player_imperial_states").insert({
    world_id: world.id, world_player_id: wp.id, version: 9,
    materials_stock: 1000, supplies_stock: 1000,
    materials_anchor_value: 1000, materials_anchor_at: t0, materials_rate_per_sec: 10,
    supplies_anchor_value: 1000, supplies_anchor_at: t0, supplies_rate_per_sec: -5,
  });
  if (ie) throw new Error(`seed imperial_state: ${ie.message}`);

  const read = async () => {
    const { data } = await db.from("world_player_imperial_states")
      .select("materials_anchor_value,supplies_anchor_value")
      .eq("world_player_id", wp.id).single();
    return data;
  };

  // --- 1) settle move o estoque conforme o tempo ---
  await sleep(1500);
  await db.rpc("kw_settle_player", { p_world_player_id: wp.id });
  const a = await read();
  check("materiais subiram com o tempo (>1000)", Number(a.materials_anchor_value) > 1000);
  check("suprimentos cairam com o tempo (<1000)", Number(a.supplies_anchor_value) < 1000);

  // --- 2) IDEMPOTENCIA: settle 2x em sequencia quase nao muda (so o dt minimo) ---
  await db.rpc("kw_settle_player", { p_world_player_id: wp.id });
  const b1 = await read();
  await db.rpc("kw_settle_player", { p_world_player_id: wp.id });
  const b2 = await read();
  const drift = Math.abs(Number(b2.materials_anchor_value) - Number(b1.materials_anchor_value));
  check("settle repetido nao duplica (drift < 1 material por chamada imediata)", drift < 1);

  // --- 3) GASTO: kw_apply_resource_write honra queda, ignora aumento ---
  const cur = await read();
  const spendTo = Math.floor(Number(cur.materials_anchor_value)) - 300;
  await db.rpc("kw_apply_resource_write", {
    p_world_player_id: wp.id,
    p_client_materials: spendTo,                 // queda de 300 => gasto
    p_client_supplies: 9_999_999,                // aumento absurdo => ignorado
    p_materials_rate: 10, p_supplies_rate: -5,
  });
  const c = await read();
  check("gasto aplicado (materiais ~= alvo do gasto)", Math.abs(Number(c.materials_anchor_value) - spendTo) < 30);
  check("aumento do cliente ignorado (suprimentos nao saltaram p/ milhoes)", Number(c.supplies_anchor_value) < 100000);

  // --- 4) CONCORRENCIA: tick do mundo + gasto concorrentes nao corrompem ---
  const before = await read();
  await Promise.all([
    db.rpc("kw_world_tick", { p_world_id: world.id }),
    db.rpc("kw_apply_resource_write", {
      p_world_player_id: wp.id,
      p_client_materials: Math.floor(Number(before.materials_anchor_value)) - 100,
      p_client_supplies: null, p_materials_rate: 10, p_supplies_rate: -5,
    }),
  ]);
  const after = await read();
  check("apos tick+gasto concorrentes, materiais nao ficaram negativos", Number(after.materials_anchor_value) >= 0);
  check("apos concorrencia, suprimentos nunca negativos (clamp 0)", Number(after.supplies_anchor_value) >= 0);

  // --- cleanup ---
  await db.from("world_player_imperial_states").delete().eq("world_player_id", wp.id);
  await db.from("world_players").delete().eq("id", wp.id);
  await db.from("users").delete().eq("id", user.id);
  await db.from("worlds").delete().eq("id", world.id);

  console.log(failures ? `\n${failures} FALHA(S)` : "\nTUDO PASSOU");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Rodar antes de aplicar a migração — deve FALHAR**

Se você rodar isto **antes** da Task 3 estar aplicada no banco:
Run: `node simulations/smoke-world-tick.mjs`
Expected: erro de RPC inexistente (`function public.kw_settle_player does not exist`) ou FAIL. Confirma que o teste exercita o código novo.

- [ ] **Step 3: Com a migração aplicada (Task 3) e o código (Tasks 1–5), rodar — deve PASSAR**

Run: `node simulations/smoke-world-tick.mjs`
Expected: todas as linhas `PASS` e `TUDO PASSOU` (exit 0).

- [ ] **Step 4: Adicionar script npm e commitar**

Em `package.json`, na seção `scripts`, adicionar:

```json
    "smoke:world:tick": "node simulations/smoke-world-tick.mjs",
```

```bash
git add simulations/smoke-world-tick.mjs package.json
git commit -m "test: smoke de integracao do tick (idempotencia, gasto, concorrencia, clamp 0)"
```

---

## Task 7: Verificação final e fechamento

**Files:** nenhum novo; validação de ponta a ponta.

- [ ] **Step 1: Typecheck do projeto inteiro**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Smoke completo**

Run: `npm run smoke:world:tick`
Expected: `TUDO PASSOU` (exit 0).

- [ ] **Step 3: Confirmar o job do cron no banco**

No Supabase SQL Editor: `select jobname, schedule, active from cron.job where jobname = 'kw_world_tick_every_minute';`
Expected: 1 linha, `schedule = '* * * * *'`, `active = true`.

- [ ] **Step 4: Conferir critérios de sucesso do spec**

Revisar contra `docs/superpowers/specs/2026-06-01-servidor-fonte-verdade-tick-design.md` → seção "Critérios de sucesso":
- pg_cron dispara sem erro ✓ (Step 3)
- materiais sobem / suprimentos sobem-descem por fórmula, GET reflete a qualquer instante ✓ (smoke 1 + Task 4)
- idempotência provada ✓ (smoke 2)
- concorrência provada, estoque nunca negativo ✓ (smoke 4)
- PUT do cliente não sobrescreve mais os dois recursos diretamente ✓ (Task 5 + smoke 3)

- [ ] **Step 5: Commit de fechamento (se houver ajustes pendentes)**

```bash
git add -A
git commit -m "chore: fecha sub-projeto #1 esqueleto (servidor fonte da verdade + tick)" || echo "nada a commitar"
```

---

## Notas de escopo (do spec, reafirmadas)

- **Fora desta fatia:** tropas/prédios/cidade autoritativos, NPCs, combate, ETA de marcha/ataque, penalidade de déficit de suprimento. A taxa usa fórmula linear simples; a adoção de `calculateCityDailyProduction` (com mapeamento structure-code → BuildingId) e agregação multi-aldeia ficam para fatias seguintes.
- **Intervalo do cron:** 1 min fixo. Como o valor é função pura do tempo, mudar o intervalo depois não tem risco.
