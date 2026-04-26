import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const reportPath = path.join(projectRoot, "reports", "smoke-participant-flow.json");

const defaultSmokePort = process.env.SMOKE_PORT ?? "3217";
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${defaultSmokePort}`;
const useExternalServer = process.env.SMOKE_USE_EXISTING_SERVER === "1";
const smokeCookie = "kw_dev_auth=1";
const waitServerTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    try {
      const raw = await readFile(path.join(projectRoot, fileName), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const index = trimmed.indexOf("=");
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        process.env[key] ??= value;
      }
    } catch {}
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeReport(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

function spawnServer() {
  return spawn("cmd.exe", ["/c", "set KW_SMOKE=1&& npm run start"], {
    cwd: projectRoot,
    env: { ...process.env, FORCE_COLOR: "0", PORT: defaultSmokePort },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function killProcessTree(pid) {
  if (!pid) return Promise.resolve();
  return new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("close", () => resolve());
    killer.on("error", () => resolve());
  });
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        headers: { cookie: smokeCookie, "x-kw-smoke": "1" },
        redirect: "manual",
      });
      if (response.ok || response.status === 307 || response.status === 308) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Servidor nao respondeu em ${url}.`);
}

async function fetchJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      cookie: smokeCookie,
      "x-kw-smoke": "1",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: response.ok, status: response.status, json };
}

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  if (!url || !key) {
    throw new Error("Supabase env ausente.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function assertCheck(checks, label, ok, details = null) {
  checks.push({ label, ok: Boolean(ok), details });
}

async function fetchSingle(supabase, table, match, select = "*") {
  const { data, error } = await supabase.from(table).select(select).match(match).limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function main() {
  await loadLocalEnv();
  const checks = [];
  const report = {
    status: "FAIL",
    generatedAt: new Date().toISOString(),
    server: { mode: useExternalServer ? "external" : "spawned" },
    flow: {},
    checks,
    failed: [],
  };

  const supabase = createSupabase();
  let serverProcess = null;

  try {
    if (!useExternalServer) {
      serverProcess = spawnServer();
      serverProcess.stdout.on("data", () => {});
      serverProcess.stderr.on("data", () => {});
    }

    await waitForServer(`${baseUrl}/lobby`, waitServerTimeoutMs);

    const devLogin = await fetchJson("/api/dev-login", { method: "POST" });
    assertCheck(checks, "dev login cria sessao de participante", devLogin.ok, { status: devLogin.status });

    const createWorld = await fetchJson("/api/worlds/alpha", {
      method: "POST",
      body: JSON.stringify({ mode: "express" }),
    });
    assertCheck(checks, "cria/reusa Alpha Expressa", createWorld.ok && createWorld.json?.world?.slug === "alpha-expresso", {
      status: createWorld.status,
      body: createWorld.json,
    });

    const worldPayload = await fetchJson("/api/worlds/alpha-expresso");
    const world = worldPayload.json?.world;
    const worldPlayerId = worldPayload.json?.worldPlayerId;
    const activeVillageId = world?.activeVillageId;
    assertCheck(checks, "participante entrou no mundo", worldPayload.ok && Boolean(worldPlayerId), {
      status: worldPayload.status,
      worldId: world?.id,
      worldPlayerId,
      activeVillageId,
    });

    const initialStateResponse = await fetchJson("/api/worlds/alpha-expresso/imperial-state");
    const initialState = initialStateResponse.json?.imperialState;
    assertCheck(checks, "estado imperial carregou", initialStateResponse.ok && Boolean(initialState), { status: initialStateResponse.status });

    const upgradedState = structuredClone(initialState);
    upgradedState.version = Number(upgradedState.version ?? 16);
    upgradedState.kingProfileId = "serenna";
    upgradedState.kingName = "Smoke Serenna";
    upgradedState.resources = {
      ...(upgradedState.resources ?? {}),
      materials: 9900,
      supplies: 8800,
      influence: 0,
    };
    upgradedState.troops = {
      ...(upgradedState.troops ?? {}),
      militia: 78,
      shooters: 0,
      scouts: 0,
      machinery: 0,
    };
    upgradedState.royalCapitalVillageId = activeVillageId;
    upgradedState.buildingSkillsByVillage ??= {};
    upgradedState.buildingLevelsByVillage ??= {};
    upgradedState.populationByVillage ??= {};
    upgradedState.logs ??= [];
    upgradedState.buildingSkillsByVillage[activeVillageId] = {
      ...(upgradedState.buildingSkillsByVillage[activeVillageId] ?? {}),
      crown: { a: 1, b: 0, c: 0, d: 0 },
    };
    upgradedState.buildingLevelsByVillage[activeVillageId] = {
      ...(upgradedState.buildingLevelsByVillage[activeVillageId] ?? {}),
      crown: 1,
    };
    upgradedState.populationByVillage[activeVillageId] = Math.max(8, Number(upgradedState.populationByVillage[activeVillageId] ?? 8));
    upgradedState.logs = [`Smoke participante: Coroa escolhida e Governo +1.`, ...upgradedState.logs].slice(0, 12);

    const putState = await fetchJson("/api/worlds/alpha-expresso/imperial-state", {
      method: "PUT",
      body: JSON.stringify(upgradedState),
    });
    assertCheck(checks, "upgrade persistiu via API", putState.ok, putState.json);

    const reloadedStateResponse = await fetchJson("/api/worlds/alpha-expresso/imperial-state");
    const reloadedState = reloadedStateResponse.json?.imperialState;
    const reloadedCrownSkill = reloadedState?.buildingSkillsByVillage?.[activeVillageId]?.crown?.a;
    assertCheck(checks, "reload ve rei escolhido", reloadedState?.kingProfileId === "serenna" && reloadedState?.kingName === "Smoke Serenna", {
      kingProfileId: reloadedState?.kingProfileId,
      kingName: reloadedState?.kingName,
    });
    assertCheck(checks, "reload ve predio upado", reloadedCrownSkill === 1, { crownA: reloadedCrownSkill });

    const worldRow = await fetchSingle(supabase, "worlds", { slug: "alpha-expresso" }, "id,slug,season_mode,speed_multiplier");
    const playerRow = await fetchSingle(supabase, "world_players", { id: worldPlayerId }, "id,world_id,user_id,status,current_capital_site_id");
    const stateRow = await fetchSingle(
      supabase,
      "world_player_imperial_states",
      { world_player_id: worldPlayerId },
      "world_player_id,materials_stock,supplies_stock,militia_count,sandbox_snapshots_json,logs_json",
    );
    const kingRow = await fetchSingle(supabase, "world_player_king_states", { world_player_id: worldPlayerId }, "world_player_id,king_profile_id,king_name");
    const structureRow = await fetchSingle(
      supabase,
      "village_structure_states",
      { world_player_id: worldPlayerId, village_site_id: activeVillageId, structure_code: "crown" },
      "world_player_id,village_site_id,structure_code,slot_a,slot_b,slot_c,slot_d,level",
    );

    assertCheck(checks, "Supabase tem mundo express x4", worldRow?.season_mode === "express" && Number(worldRow?.speed_multiplier) === 4, worldRow);
    assertCheck(checks, "Supabase tem participante vivo", playerRow?.status === "alive" && playerRow?.current_capital_site_id === activeVillageId, playerRow);
    assertCheck(checks, "Supabase tem estado imperial atualizado", Number(stateRow?.materials_stock) === 9900 && Number(stateRow?.militia_count) === 78, {
      materials_stock: stateRow?.materials_stock,
      militia_count: stateRow?.militia_count,
    });
    assertCheck(checks, "Supabase tem rei dedicado", kingRow?.king_profile_id === "serenna" && kingRow?.king_name === "Smoke Serenna", kingRow);
    assertCheck(checks, "Supabase tem predio dedicado upado", Number(structureRow?.slot_a) === 1 && Number(structureRow?.level) >= 1, structureRow);
    assertCheck(
      checks,
      "snapshot nao guarda rei/predio como verdade escondida",
      !stateRow?.sandbox_snapshots_json?.__clientState?.kingProfileId &&
        !stateRow?.sandbox_snapshots_json?.__clientState?.buildingSkillsByVillage,
      {
        snapshot_has_king: Boolean(stateRow?.sandbox_snapshots_json?.__clientState?.kingProfileId),
        snapshot_has_structure: Boolean(stateRow?.sandbox_snapshots_json?.__clientState?.buildingSkillsByVillage),
      },
    );

    report.flow = {
      world: worldRow,
      worldPlayerId,
      activeVillageId,
      king: kingRow,
      structure: structureRow,
    };
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (serverProcess) {
      await killProcessTree(serverProcess.pid);
    }
  }

  report.failed = checks.filter((check) => !check.ok);
  report.status = report.failed.length === 0 && !report.error ? "PASS" : "FAIL";
  await writeReport(report);
  if (report.status !== "PASS") {
    process.exitCode = 1;
  }
}

main();
