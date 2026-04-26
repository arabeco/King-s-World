import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const reportsDir = path.join(projectRoot, "reports", "smoke-campaign-code");
const reportPath = path.join(reportsDir, "latest.json");
async function readEnvFile() {
  try {
    const raw = await readFile(path.join(projectRoot, ".env.local"), "utf8");
    const entries = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");
      entries[key] = value;
    }
    return entries;
  } catch {
    return {};
  }
}

const fileEnv = await readEnvFile();
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const useExternalServer = process.env.SMOKE_USE_EXISTING_SERVER === "1";
const waitServerTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
const smokeCookie = "kw_dev_auth=1";
const requireSupabasePersistence = process.env.SMOKE_REQUIRE_SUPABASE_PERSISTENCE !== "0";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  fileEnv.SUPABASE_SERVICE_ROLE_KEY ??
  fileEnv.SUPABASE_SECRET_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  fileEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        headers: { cookie: smokeCookie, "x-kw-smoke": "1" },
        redirect: "manual",
      });
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
    } catch {}
    await delay(1200);
  }
  throw new Error(`App server did not respond in time at ${url}.`);
}

function spawnServer() {
  return spawn("cmd.exe", ["/c", "set KW_SMOKE=1&& npm run start"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
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

async function fetchJson(input, init = {}) {
  const response = await fetch(`${baseUrl}${input}`, {
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
  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

function buildImperialSeed(stage, currentState) {
  const next = structuredClone(currentState);
  const villageIds = Object.keys(next.buildingLevelsByVillage ?? {});
  const capitalVillageId =
    next.royalCapitalVillageId ??
    villageIds[0] ??
    Object.keys(next.populationByVillage ?? {})[0] ??
    null;

  const ensureVillage = (villageId) => {
    next.buildingLevelsByVillage ??= {};
    next.buildingSkillsByVillage ??= {};
    next.populationByVillage ??= {};
    next.cityClassByVillage ??= {};
    next.cityClassLockedByVillage ??= {};
    next.productionWorkersByVillage ??= {};
    next.jobsByVillage ??= {};
    next.recruitsByVillage ??= {};
    next.defenseRecruitsByVillage ??= {};
    next.heroByVillage ??= {};
    next.heroBuildByVillage ??= {};
    next.villageNameByVillage ??= {};
    next.deployedByVillage ??= {};
    next.exploredCoordKeys ??= [];
    next.discoveriesByCoord ??= {};
    next.extraVillages ??= [];

    next.buildingLevelsByVillage[villageId] ??= {};
    next.buildingSkillsByVillage[villageId] ??= {};
    next.populationByVillage[villageId] ??= 18;
    next.cityClassByVillage[villageId] ??= "neutral";
    next.cityClassLockedByVillage[villageId] ??= false;
    next.productionWorkersByVillage[villageId] ??= { materials: 0, supplies: 0, commerce: 0, logistics: 0 };
    next.jobsByVillage[villageId] ??= { medics: 0, crafts: 0, order: 0, scholars: 0 };
    next.recruitsByVillage[villageId] ??= { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
    next.defenseRecruitsByVillage[villageId] ??= { guards: 0, archers: 0, ballistae: 0 };
    next.heroByVillage[villageId] ??= "none";
    next.heroBuildByVillage[villageId] ??= "leadership";
    next.villageNameByVillage[villageId] ??= villageId.includes("capital") ? "Capital" : "Cidade";
    next.deployedByVillage[villageId] ??= 0;
  };

  if (capitalVillageId) {
    ensureVillage(capitalVillageId);
    next.royalCapitalVillageId = capitalVillageId;
  }

  next.logs ??= [];
  next.resources ??= { materials: 0, supplies: 0, influence: 0 };
  next.troops ??= { militia: 0, shooters: 0, scouts: 0, machinery: 0 };

  if (stage === "opening") {
    next.kingProfileId = null;
    next.kingName = null;
    next.resources.materials = 3600;
    next.resources.supplies = 3100;
    next.resources.influence = 0;
    if (capitalVillageId) {
      next.cityClassLockedByVillage[capitalVillageId] = true;
      next.cityClassByVillage[capitalVillageId] = "neutral";
      next.populationByVillage[capitalVillageId] = 22;
      next.buildingSkillsByVillage[capitalVillageId] = {
        crown: { a: 0, b: 0, c: 0, d: 0 },
        economy: { a: 0, b: 0, c: 0, d: 0 },
        society: { a: 0, b: 0, c: 0, d: 0 },
        recruitment: { a: 0, b: 0, c: 0, d: 0 },
        defense: { a: 0, b: 0, c: 0, d: 0 },
      };
      next.buildingLevelsByVillage[capitalVillageId] = {
        crown: 0,
        economy: 0,
        society: 0,
        recruitment: 0,
        defense: 0,
      };
    }
    next.logs = ["Smoke code: abertura do reino."];
    return next;
  }

  if (stage === "mid") {
    next.kingProfileId = "aurelian";
    next.kingName = "Smoke Crown";
    next.resources.materials = 8200;
    next.resources.supplies = 7400;
    next.troops = { militia: 180, shooters: 120, scouts: 45, machinery: 12 };
    if (capitalVillageId) {
      ensureVillage(capitalVillageId);
      next.cityClassByVillage[capitalVillageId] = "metropole";
      next.cityClassLockedByVillage[capitalVillageId] = true;
      next.populationByVillage[capitalVillageId] = 48;
      next.buildingSkillsByVillage[capitalVillageId] = {
        crown: { a: 1, b: 1, c: 0, d: 0 },
        economy: { a: 1, b: 1, c: 1, d: 0 },
        society: { a: 1, b: 1, c: 0, d: 0 },
        recruitment: { a: 1, b: 0, c: 0, d: 0 },
        defense: { a: 1, b: 0, c: 0, d: 0 },
      };
      next.buildingLevelsByVillage[capitalVillageId] = {
        crown: 2,
        economy: 3,
        society: 2,
        recruitment: 1,
        defense: 1,
      };
      next.productionWorkersByVillage[capitalVillageId] = { materials: 8, supplies: 7, commerce: 4, logistics: 3 };
      next.jobsByVillage[capitalVillageId] = { medics: 1, crafts: 3, order: 2, scholars: 2 };
      next.recruitsByVillage[capitalVillageId] = { militia: 12, shooters: 8, scouts: 2, machinery: 1 };
      next.defenseRecruitsByVillage[capitalVillageId] = { guards: 6, archers: 3, ballistae: 1 };
      next.heroByVillage[capitalVillageId] = "engineer";
      next.heroBuildByVillage[capitalVillageId] = "logistics";
    }
    next.logs = ["Smoke code: metade da campanha carregada."];
    return next;
  }

  if (stage === "late") {
    next.kingProfileId = "aurelian";
    next.kingName = "Smoke Crown";
    next.resources.materials = 14600;
    next.resources.supplies = 12800;
    next.troops = { militia: 420, shooters: 260, scouts: 110, machinery: 44 };
    if (capitalVillageId) {
      ensureVillage(capitalVillageId);
      next.cityClassByVillage[capitalVillageId] = "metropole";
      next.cityClassLockedByVillage[capitalVillageId] = true;
      next.populationByVillage[capitalVillageId] = 72;
      next.buildingSkillsByVillage[capitalVillageId] = {
        crown: { a: 2, b: 2, c: 1, d: 0 },
        economy: { a: 2, b: 2, c: 2, d: 1 },
        society: { a: 2, b: 2, c: 1, d: 1 },
        recruitment: { a: 2, b: 1, c: 1, d: 1 },
        defense: { a: 2, b: 1, c: 1, d: 1 },
      };
      next.buildingLevelsByVillage[capitalVillageId] = {
        crown: 5,
        economy: 7,
        society: 6,
        recruitment: 5,
        defense: 5,
      };
      next.productionWorkersByVillage[capitalVillageId] = { materials: 12, supplies: 12, commerce: 8, logistics: 7 };
      next.jobsByVillage[capitalVillageId] = { medics: 3, crafts: 5, order: 4, scholars: 4 };
      next.recruitsByVillage[capitalVillageId] = { militia: 22, shooters: 16, scouts: 6, machinery: 4 };
      next.defenseRecruitsByVillage[capitalVillageId] = { guards: 12, archers: 8, ballistae: 3 };
      next.heroByVillage[capitalVillageId] = "marshal";
      next.heroBuildByVillage[capitalVillageId] = "discipline";
    }
    next.exploredCoordKeys = Array.from(new Set([...(next.exploredCoordKeys ?? []), "0:0", "1:0", "1:-1", "2:-1"]));
    next.discoveriesByCoord = {
      ...(next.discoveriesByCoord ?? {}),
      "1:-1": {
        type: "opportunity",
        status: "new",
        title: "Ruína antiga",
        summary: "Estruturas antigas prometem ganho se a expedição voltar preparada.",
        riskLabel: "médio",
        rewardLabel: "alto",
        imageSrc: "/images/threat-empty-ruins.jpg",
        actionLabel: "Investigar",
      },
    };
    next.logs = ["Smoke code: fase tardia carregada."];
    return next;
  }

  const finalState = buildImperialSeed("late", next);
  finalState.resources.materials = 18200;
  finalState.resources.supplies = 16900;
  finalState.troops = { militia: 520, shooters: 340, scouts: 130, machinery: 68 };
  finalState.logs = ["Smoke code: estado final da temporada."];
  return finalState;
}

function createSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchSingle(supabase, table, match, select = "*") {
  const query = supabase.from(table).select(select).match(match).limit(1);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] ?? null;
}

async function fetchMany(supabase, table, match, select = "*") {
  const query = supabase.from(table).select(select).match(match);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function safeFetchTable(supabase, table, match, select = "*") {
  try {
    return { exists: true, rows: await fetchMany(supabase, table, match, select) };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

async function probeTableExists(supabase, table) {
  try {
    const { error } = await supabase.from(table).select("*").limit(1);
    return { exists: !error, error: error?.message ?? null };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

function compareFields(label, actual, expected) {
  return {
    label,
    ok: actual === expected,
    actual,
    expected,
  };
}

function unwrapImperialStatePayload(value) {
  let current = value;
  for (let index = 0; index < 4; index += 1) {
    if (current && typeof current === "object" && current.resources && current.troops) {
      return current;
    }
    if (current && typeof current === "object" && current.imperialState) {
      current = current.imperialState;
      continue;
    }
    break;
  }
  return current;
}

function summarizePersistenceCapabilities(tableProbe) {
  return {
    resourcesAndTroops: "supabase:world_player_imperial_states",
    worldPhaseAndRank: "supabase:worlds + world_players",
    buildingSkillsAndLevels: tableProbe.structureTable.exists
      ? "supabase:village_structure_states"
      : "supabase:world_player_imperial_states.sandbox_snapshots_json.__clientState (transition)",
    populationJobsAndRecruitment: tableProbe.cityTable.exists
      ? "supabase:village_city_states"
      : "supabase:world_player_imperial_states.sandbox_snapshots_json.__clientState (transition)",
    troopStacksBySite: tableProbe.stacksTable.exists ? "supabase:site_troop_stacks" : "snapshot-only fallback",
    kingSelection: tableProbe.kingTable.exists
      ? "supabase:world_player_king_states"
      : "supabase:world_player_imperial_states.sandbox_snapshots_json.__clientState",
    exploredTiles: tableProbe.explorationTable.exists
      ? "supabase:world_player_exploration_states"
      : "supabase:world_player_imperial_states.sandbox_snapshots_json.__clientState",
    discoveries: tableProbe.explorationTable.exists
      ? "supabase:world_player_exploration_states"
      : "supabase:world_player_imperial_states.sandbox_snapshots_json.__clientState",
    logs: "supabase:world_player_imperial_states.logs_json",
  };
}

async function main() {
  await ensureDir(reportsDir);

  const report = {
    ok: false,
    generatedAt: new Date().toISOString(),
    baseUrl,
    world: null,
    server: { mode: useExternalServer ? "external" : "start", booted: false },
    supabaseConfigured: Boolean(supabaseUrl && supabaseKey),
    persistenceModel: null,
    stages: [],
    assertions: [],
    warnings: [],
    error: null,
  };

  const supabase = createSupabase();
  let serverProcess = null;
  let snapshot = null;
  let imperialOriginal = null;

  try {
    if (!useExternalServer) {
      serverProcess = spawnServer();
      serverProcess.stdout.on("data", () => {});
      serverProcess.stderr.on("data", () => {});
      await waitForServer(`${baseUrl}/api/worlds`, waitServerTimeoutMs);
      report.server.booted = true;
    }

    const worldsResponse = await fetchJson("/api/worlds");
    if (!worldsResponse.ok || !Array.isArray(worldsResponse.json?.worlds)) {
      throw new Error(`Could not load worlds: ${JSON.stringify(worldsResponse.json)}`);
    }

    const worldSummary =
      worldsResponse.json.worlds.find((world) => world.status === "Em Andamento") ??
      worldsResponse.json.worlds.find((world) => world.status !== "Finalizado") ??
      worldsResponse.json.worlds[0] ??
      null;
    if (!worldSummary) {
      throw new Error("No world available for smoke.");
    }

    const worldId = worldSummary.id;
    report.world = { routeId: worldId, name: worldSummary.name, status: worldSummary.status };

    const snapshotResponse = await fetchJson(`/api/dev-smoke/worlds/${worldId}/campaign`);
    if (!snapshotResponse.ok) {
      throw new Error(`Could not snapshot campaign state: ${JSON.stringify(snapshotResponse.json)}`);
    }
    snapshot = snapshotResponse.json.snapshot;

    const imperialResponse = await fetchJson(`/api/worlds/${worldId}/imperial-state`);
    if (!imperialResponse.ok) {
      throw new Error(`Could not snapshot imperial state: ${JSON.stringify(imperialResponse.json)}`);
    }
    imperialOriginal = unwrapImperialStatePayload(imperialResponse.json);

    let tableProbe = {
      structureTable: { exists: false },
      cityTable: { exists: false },
      stacksTable: { exists: false },
      kingTable: { exists: false },
      explorationTable: { exists: false },
      structure: { exists: false },
      city: { exists: false },
      stacks: { exists: false },
    };

    if (supabase) {
      tableProbe = {
        structureTable: await probeTableExists(supabase, "village_structure_states"),
        cityTable: await probeTableExists(supabase, "village_city_states"),
        stacksTable: await probeTableExists(supabase, "site_troop_stacks"),
        kingTable: await probeTableExists(supabase, "world_player_king_states"),
        explorationTable: await probeTableExists(supabase, "world_player_exploration_states"),
        structure: await safeFetchTable(
          supabase,
          "village_structure_states",
          { world_player_id: snapshotResponse.json.worldPlayerId },
          "village_site_id,structure_code,slot_a,slot_b,slot_c,slot_d,level",
        ),
        city: await safeFetchTable(
          supabase,
          "village_city_states",
          { world_player_id: snapshotResponse.json.worldPlayerId },
          "village_site_id,population_current,production_materials_workers,production_supplies_workers,production_commerce_workers,production_logistics_workers,jobs_medics,jobs_crafts,jobs_order,jobs_scholars,recruits_militia,recruits_shooters,recruits_scouts,recruits_machinery,defense_guards,defense_archers,defense_ballistae",
        ),
        stacks: await safeFetchTable(
          supabase,
          "site_troop_stacks",
          { owner_world_player_id: snapshotResponse.json.worldPlayerId },
          "site_id,unit_code,quantity",
        ),
      };
    }

    report.persistenceModel = summarizePersistenceCapabilities(tableProbe);
    if (requireSupabasePersistence) {
      const missingTables = [
        ["village_structure_states", tableProbe.structureTable.exists],
        ["village_city_states", tableProbe.cityTable.exists],
        ["site_troop_stacks", tableProbe.stacksTable.exists],
        ["world_player_king_states", tableProbe.kingTable.exists],
        ["world_player_exploration_states", tableProbe.explorationTable.exists],
      ].filter(([, exists]) => !exists);

      if (!supabase) {
        throw new Error("Supabase persistence is required for this smoke, but Supabase env is not configured.");
      }

      if (missingTables.length > 0) {
        throw new Error(
          `Dedicated persistence tables missing: ${missingTables.map(([name]) => name).join(", ")}.`,
        );
      }
    }

    for (const stage of ["opening", "mid", "late", "final"]) {
      const seededState = buildImperialSeed(stage, imperialOriginal);

      const stageResponse = await fetchJson(`/api/dev-smoke/worlds/${worldId}/campaign`, {
        method: "POST",
        body: JSON.stringify({ action: "stage", stage }),
      });
      if (!stageResponse.ok) {
        throw new Error(`Could not move campaign to stage ${stage}: ${JSON.stringify(stageResponse.json)}`);
      }

      const putResponse = await fetchJson(`/api/worlds/${worldId}/imperial-state`, {
        method: "PUT",
        body: JSON.stringify(seededState),
      });
      if (!putResponse.ok) {
        throw new Error(`Could not persist imperial state for ${stage}: ${JSON.stringify(putResponse.json)}`);
      }

      const worldPayloadResponse = await fetchJson(`/api/worlds/${worldId}`);
      if (!worldPayloadResponse.ok) {
        throw new Error(`Could not reload world payload for ${stage}: ${JSON.stringify(worldPayloadResponse.json)}`);
      }

      const getResponse = await fetchJson(`/api/worlds/${worldId}/imperial-state`);
      if (!getResponse.ok) {
        throw new Error(`Could not reload imperial state for ${stage}: ${JSON.stringify(getResponse.json)}`);
      }

      const persisted = unwrapImperialStatePayload(getResponse.json);
      const capitalVillageId =
        persisted.royalCapitalVillageId ??
        Object.keys(persisted.buildingLevelsByVillage ?? {})[0] ??
        Object.keys(persisted.populationByVillage ?? {})[0] ??
        null;

      const stageAssertions = [
        compareFields(`${stage}: materials`, persisted.resources.materials, seededState.resources.materials),
        compareFields(`${stage}: supplies`, persisted.resources.supplies, seededState.resources.supplies),
        compareFields(`${stage}: militia`, persisted.troops.militia, seededState.troops.militia),
        compareFields(`${stage}: kingProfileId`, persisted.kingProfileId ?? null, seededState.kingProfileId ?? null),
        compareFields(`${stage}: kingName`, persisted.kingName ?? null, seededState.kingName ?? null),
      ];

      if (capitalVillageId) {
        stageAssertions.push(
          compareFields(
            `${stage}: capital crown level`,
            persisted.buildingLevelsByVillage?.[capitalVillageId]?.crown ?? null,
            seededState.buildingLevelsByVillage?.[capitalVillageId]?.crown ?? null,
          ),
        );
        stageAssertions.push(
          compareFields(
            `${stage}: capital population`,
            persisted.populationByVillage?.[capitalVillageId] ?? null,
            seededState.populationByVillage?.[capitalVillageId] ?? null,
          ),
        );
      }

      if (stage === "late" || stage === "final") {
        stageAssertions.push(
          compareFields(
            `${stage}: explored ruin tile`,
            Array.isArray(persisted.exploredCoordKeys) && persisted.exploredCoordKeys.includes("1:-1"),
            true,
          ),
        );
        stageAssertions.push(
          compareFields(
            `${stage}: discovery title`,
            persisted.discoveriesByCoord?.["1:-1"]?.title ?? null,
            "Ruína antiga",
          ),
        );
      }

      const worldMeta = worldPayloadResponse.json?.worldMeta ?? {};
      if (stage === "final") {
        stageAssertions.push(compareFields(`${stage}: readOnly final`, Boolean(worldMeta.readOnly), true));
        stageAssertions.push(compareFields(`${stage}: final world status`, worldMeta.status, "finalized"));
      } else {
        stageAssertions.push(compareFields(`${stage}: world running`, worldMeta.status, "running"));
      }

      let dbState = null;
      let dbStructure = null;
      let dbCity = null;
      let dbKing = null;
      let dbExplorationRows = [];
      if (supabase) {
        dbState = await fetchSingle(
          supabase,
          "world_player_imperial_states",
          { world_player_id: snapshotResponse.json.worldPlayerId },
          "materials_stock,supplies_stock,militia_count,shooters_count,scouts_count,machinery_count,sandbox_snapshots_json,logs_json",
        );

        if (tableProbe.structureTable.exists && capitalVillageId) {
          dbStructure = await fetchSingle(
            supabase,
            "village_structure_states",
            { world_player_id: snapshotResponse.json.worldPlayerId, village_site_id: capitalVillageId, structure_code: "crown" },
            "slot_a,slot_b,slot_c,slot_d,level",
          );
        }

        if (tableProbe.cityTable.exists && capitalVillageId) {
          dbCity = await fetchSingle(
            supabase,
            "village_city_states",
            { world_player_id: snapshotResponse.json.worldPlayerId, village_site_id: capitalVillageId },
            "population_current,production_materials_workers,production_supplies_workers,production_commerce_workers,production_logistics_workers,jobs_medics,jobs_crafts,jobs_order,jobs_scholars,recruits_militia,recruits_shooters,recruits_scouts,recruits_machinery,defense_guards,defense_archers,defense_ballistae",
          );
        }

        if (tableProbe.kingTable.exists) {
          dbKing = await fetchSingle(
            supabase,
            "world_player_king_states",
            { world_player_id: snapshotResponse.json.worldPlayerId },
            "king_profile_id,king_name",
          );
        }

        if (tableProbe.explorationTable.exists) {
          dbExplorationRows = await fetchMany(
            supabase,
            "world_player_exploration_states",
            { world_player_id: snapshotResponse.json.worldPlayerId },
            "coord_key,title,status,discovery_type",
          );
        }
      }

      if (requireSupabasePersistence && dbState) {
        stageAssertions.push(compareFields(`${stage}: snapshot has no king`, Boolean(dbState.sandbox_snapshots_json?.__clientState?.kingProfileId), false));
        stageAssertions.push(compareFields(`${stage}: snapshot has no structure`, Boolean(dbState.sandbox_snapshots_json?.__clientState?.buildingSkillsByVillage), false));
        stageAssertions.push(compareFields(`${stage}: snapshot has no city`, Boolean(dbState.sandbox_snapshots_json?.__clientState?.populationByVillage), false));
        stageAssertions.push(compareFields(`${stage}: snapshot has no exploration`, Array.isArray(dbState.sandbox_snapshots_json?.__clientState?.exploredCoordKeys), false));
      }

      if (requireSupabasePersistence && stage !== "opening") {
        stageAssertions.push(compareFields(`${stage}: king dedicated row`, dbKing?.king_profile_id ?? null, seededState.kingProfileId ?? null));
      }

      if (requireSupabasePersistence && (stage === "late" || stage === "final")) {
        stageAssertions.push(
          compareFields(
            `${stage}: exploration dedicated row`,
            dbExplorationRows.some((row) => row.coord_key === "1:-1" && row.title === "Ruína antiga"),
            true,
          ),
        );
      }

      report.stages.push({
        stage,
        worldMeta: {
          status: worldMeta.status,
          readOnly: worldMeta.readOnly,
          result: worldMeta.result ?? null,
          finalRank: worldMeta.finalRank ?? null,
          finalScore: worldMeta.finalScore ?? null,
        },
        capitalVillageId,
        assertions: stageAssertions,
        persistence: {
          supabaseStateRow: dbState
            ? {
                materials_stock: dbState.materials_stock,
                supplies_stock: dbState.supplies_stock,
                militia_count: dbState.militia_count,
                snapshot_has_king: Boolean(dbState.sandbox_snapshots_json?.__clientState?.kingProfileId),
                snapshot_has_exploration: Array.isArray(dbState.sandbox_snapshots_json?.__clientState?.exploredCoordKeys),
                snapshot_has_structure: Boolean(dbState.sandbox_snapshots_json?.__clientState?.buildingSkillsByVillage),
                snapshot_has_city: Boolean(dbState.sandbox_snapshots_json?.__clientState?.populationByVillage),
              }
            : null,
          structureRow: dbStructure,
          cityRow: dbCity,
          kingRow: dbKing,
          explorationRows: dbExplorationRows,
          sourceSummary: {
            resources: "world_player_imperial_states",
            troops: "world_player_imperial_states",
            king: tableProbe.kingTable.exists
              ? "world_player_king_states"
              : "world_player_imperial_states.sandbox_snapshots_json.__clientState",
            exploration: tableProbe.explorationTable.exists
              ? "world_player_exploration_states"
              : "world_player_imperial_states.sandbox_snapshots_json.__clientState",
            structure: tableProbe.structureTable.exists
              ? "village_structure_states"
              : "world_player_imperial_states.sandbox_snapshots_json.__clientState",
            city: tableProbe.cityTable.exists
              ? "village_city_states"
              : "world_player_imperial_states.sandbox_snapshots_json.__clientState",
          },
        },
      });
    }

    const failedAssertions = report.stages.flatMap((stage) => stage.assertions.filter((entry) => !entry.ok));
    if (failedAssertions.length > 0) {
      report.error = `Smoke found ${failedAssertions.length} numeric/persistence mismatches.`;
    } else {
      report.ok = true;
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      if (snapshot && report.world?.routeId && imperialOriginal) {
        await fetchJson(`/api/worlds/${report.world.routeId}/imperial-state`, {
          method: "PUT",
          body: JSON.stringify(imperialOriginal),
        });
        await fetchJson(`/api/dev-smoke/worlds/${report.world.routeId}/campaign`, {
          method: "POST",
          body: JSON.stringify({ action: "restore", snapshot }),
        });
      }
    } catch (restoreError) {
      report.warnings.push(
        restoreError instanceof Error ? `Restore warning: ${restoreError.message}` : `Restore warning: ${String(restoreError)}`,
      );
    }

    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (serverProcess) {
      await killProcessTree(serverProcess.pid);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
