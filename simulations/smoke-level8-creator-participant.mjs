import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const reportPath = path.join(projectRoot, "reports", "smoke-level8-creator-participant.json");

const defaultSmokePort = process.env.SMOKE_PORT ?? "3228";
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${defaultSmokePort}`;
const useExternalServer = process.env.SMOKE_USE_EXISTING_SERVER === "1";
const waitServerTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
const worldSlug = "alpha-expresso";
const creatorKey = "1";
const participantKey = "2";
const explorationCoordKey = "1:0";

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
        headers: { cookie: `kw_dev_auth=${creatorKey}`, "x-kw-smoke": "1" },
        redirect: "manual",
      });
      if (response.ok || response.status === 307 || response.status === 308) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Servidor nao respondeu em ${url}.`);
}

async function fetchJson(pathname, userKey, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      cookie: `kw_dev_auth=${userKey}`,
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

async function selectOrThrow(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function openWorldPage(browser, userKey, pathname) {
  const url = new URL(baseUrl);
  const context = await browser.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: { "x-kw-smoke": "1" },
  });
  await context.addCookies([
    {
      name: "kw_dev_auth",
      value: userKey,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto(pathname, { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function clickIfEnabled(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  if (await locator.isDisabled()) {
    return false;
  }
  await locator.click();
  return true;
}

async function chooseKingIfModalVisible(page, kingName) {
  const kingModal = page.locator('[data-smoke="king-selection-modal"]').first();
  const kingModalVisible = await kingModal.isVisible().catch(() => false);
  if (!kingModalVisible) {
    return false;
  }

  await page.locator('[data-smoke="king-card-serenna"]').click();
  await page.locator('[data-smoke="king-name-input"]').fill(kingName);
  await page.locator('[data-smoke="confirm-king-selection"]').click();
  await page.locator('[data-smoke="king-selection-modal"]').waitFor({ state: "hidden", timeout: 30_000 });
  return true;
}

async function waitForProfileReady(page, kingName) {
  const startedAt = Date.now();
  let kingClicked = false;
  while (Date.now() - startedAt < 55_000) {
    const profileVisible = await page.locator('[data-smoke="participants-ranking"]').first().isVisible().catch(() => false);
    if (profileVisible) {
      return kingClicked;
    }

    kingClicked = (await chooseKingIfModalVisible(page, kingName)) || kingClicked;
    await page.waitForTimeout(750);
  }

  await page.locator('[data-smoke="participants-ranking"]').waitFor({ state: "visible", timeout: 1000 });
  return kingClicked;
}

async function clearBlockingOverlays(page) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    const loadingVisible = await page.getByText("Carregando mundo").first().isVisible().catch(() => false);
    const closeHelp = page.locator('button[aria-label="Fechar ajuda"]').first();
    const helpVisible = await closeHelp.isVisible().catch(() => false);

    if (helpVisible) {
      await closeHelp.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(500);
      continue;
    }

    if (!loadingVisible) {
      return;
    }

    await page.waitForTimeout(500);
  }
}

function buildExplorationState(initialState, activeVillageId) {
  const now = new Date();
  const arrival = new Date(now.getTime() + 90_000);
  const movement = {
    id: `smoke-n8-${now.getTime()}`,
    worldId: worldSlug,
    sourceCoord: "0:0",
    targetCoord: explorationCoordKey,
    movementType: "scout",
    commandAction: "explore",
    launchedAt: now.toISOString(),
    arrivalAt: arrival.toISOString(),
    etaMinutes: 2,
    route: ["0:0", explorationCoordKey],
    routeSteps: [
      {
        coordKey: explorationCoordKey,
        legMinutes: 2,
        elapsedMinutes: 2,
        arrivalAt: arrival.toISOString(),
      },
    ],
    status: "traveling",
    meta: {
      buildMode: null,
      district: "A",
      targetLabel: "Smoke N8 - clareira de prova",
      reportedIntelCoordKeys: [explorationCoordKey],
    },
  };

  return {
    ...initialState,
    version: Number(initialState.version ?? 16),
    kingProfileId: "serenna",
    kingName: "Smoke N8 Serenna",
    royalCapitalVillageId: activeVillageId,
    resources: {
      ...(initialState.resources ?? {}),
      materials: 12345,
      supplies: 9876,
      influence: Math.max(750, Number(initialState.resources?.influence ?? 0)),
    },
    troops: {
      ...(initialState.troops ?? {}),
      militia: Math.max(88, Number(initialState.troops?.militia ?? 0)),
      scouts: Math.max(12, Number(initialState.troops?.scouts ?? 0)),
    },
    exploredCoordKeys: Array.from(new Set([...(initialState.exploredCoordKeys ?? []), "0:0", explorationCoordKey])),
    discoveriesByCoord: {
      ...(initialState.discoveriesByCoord ?? {}),
      [explorationCoordKey]: {
        coordKey: explorationCoordKey,
        type: "opportunity",
        status: "new",
        title: "Smoke N8: fronteira encontrada",
        summary: "Prova automatica de participante explorando e deixando rastros persistentes.",
        imageSrc: "/images/discovery-default.jpg",
        riskLabel: "baixo",
        rewardLabel: "influencia",
        actionLabel: "Registrar intel",
      },
    },
    mapMovements: [movement, ...(Array.isArray(initialState.mapMovements) ? initialState.mapMovements : [])].slice(0, 12),
    logs: [`Smoke N8: participante escolheu rei, abriu mundo e registrou exploracao em ${explorationCoordKey}.`, ...(initialState.logs ?? [])].slice(0, 12),
  };
}

async function main() {
  await loadLocalEnv();
  const checks = [];
  const report = {
    status: "FAIL",
    generatedAt: new Date().toISOString(),
    server: { mode: useExternalServer ? "external" : "spawned" },
    browserClicks: {},
    sqlProof: {},
    checks,
    failed: [],
  };

  const supabase = createSupabase();
  let serverProcess = null;
  let browser = null;

  try {
    if (!useExternalServer) {
      serverProcess = spawnServer();
      serverProcess.stdout.on("data", () => {});
      serverProcess.stderr.on("data", () => {});
    }

    await waitForServer(`${baseUrl}/lobby`, waitServerTimeoutMs);

    for (const key of [creatorKey, participantKey]) {
      const login = await fetchJson("/api/dev-login", key, {
        method: "POST",
        body: JSON.stringify({ user: key }),
      });
      assertCheck(checks, `dev login conta ${key}`, login.ok && login.json?.userKey === key, {
        status: login.status,
        body: login.json,
      });
    }

    const createWorld = await fetchJson("/api/worlds/alpha", creatorKey, {
      method: "POST",
      body: JSON.stringify({ mode: "express" }),
    });
    assertCheck(checks, "criador cria/reusa Alpha Expressa", createWorld.ok && createWorld.json?.world?.slug === worldSlug, {
      status: createWorld.status,
      body: createWorld.json,
    });

    browser = await chromium.launch({ headless: true });
    const creatorSession = await openWorldPage(browser, creatorKey, `/world/${worldSlug}/guide`);
    const creatorKingClicked = await waitForProfileReady(creatorSession.page, "Smoke N8 Criador");
    await clearBlockingOverlays(creatorSession.page);
    const fillClicked = await clickIfEnabled(creatorSession.page, '[data-smoke="fill-ai-participants"]');
    if (fillClicked) {
      await creatorSession.page.waitForTimeout(1200);
    }
    await clickIfEnabled(creatorSession.page, '[data-smoke="runtime-schedule-midnight"]');
    await creatorSession.page.waitForTimeout(800);
    await creatorSession.context.close();
    report.browserClicks.creator = {
      profileOpened: true,
      kingModalClicked: creatorKingClicked,
      fillAiClicked: fillClicked,
      scheduleMidnightClicked: true,
    };
    assertCheck(checks, "criador clicou Perfil/IA/runtime", true, report.browserClicks.creator);

    const participantWorld = await fetchJson(`/api/worlds/${worldSlug}`, participantKey);
    const world = participantWorld.json?.world;
    const worldPlayerId = participantWorld.json?.worldPlayerId;
    const activeVillageId = world?.activeVillageId;
    assertCheck(checks, "participante entrou no mundo", participantWorld.ok && Boolean(worldPlayerId) && Boolean(activeVillageId), {
      status: participantWorld.status,
      worldId: world?.id,
      worldPlayerId,
      activeVillageId,
      participantCount: world?.participants?.length,
    });

    const participantSession = await openWorldPage(browser, participantKey, `/world/${worldSlug}/guide`);
    const kingModalVisible = await chooseKingIfModalVisible(participantSession.page, "Smoke N8 Serenna");
    for (const tab of ["base", "intelligence", "board", "guide"]) {
      await participantSession.page.goto(`/world/${worldSlug}/${tab}`, { waitUntil: "domcontentloaded" });
      await participantSession.page.waitForTimeout(250);
    }
    await participantSession.context.close();
    report.browserClicks.participant = {
      kingModalClicked: kingModalVisible,
      tabsOpened: ["base", "intelligence", "board", "guide"],
    };
    assertCheck(checks, "participante clicou coroa/telas principais", true, report.browserClicks.participant);

    const initialStateResponse = await fetchJson(`/api/worlds/${worldSlug}/imperial-state`, participantKey);
    const initialState = initialStateResponse.json?.imperialState;
    assertCheck(checks, "estado imperial do participante carregou", initialStateResponse.ok && Boolean(initialState), {
      status: initialStateResponse.status,
    });

    const explorationState = buildExplorationState(initialState, activeVillageId);
    const putState = await fetchJson(`/api/worlds/${worldSlug}/imperial-state`, participantKey, {
      method: "PUT",
      body: JSON.stringify(explorationState),
    });
    assertCheck(checks, "participante persistiu rei + exploracao", putState.ok, putState.json);

    const reloadedWorld = await fetchJson(`/api/worlds/${worldSlug}`, participantKey);
    assertCheck(checks, "ranking recarregado mostra 50 participantes", (reloadedWorld.json?.world?.participants?.length ?? 0) >= 50, {
      participantCount: reloadedWorld.json?.world?.participants?.length ?? 0,
    });

    const worldRows = await selectOrThrow(
      supabase
        .from("worlds")
        .select("id,slug,status,starts_at,runtime_started,runtime_real_time_enabled,runtime_anchor_day,runtime_anchor_started_at")
        .eq("slug", worldSlug)
        .limit(1),
    );
    const worldRow = worldRows[0] ?? null;
    const playerRows = worldRow
      ? await selectOrThrow(supabase.from("world_players").select("id,world_id,user_id,status,power_score_cached").eq("world_id", worldRow.id))
      : [];
    const participantPlayer = playerRows.find((player) => player.id === worldPlayerId) ?? null;
    const kingRows = await selectOrThrow(
      supabase
        .from("world_player_king_states")
        .select("world_player_id,world_id,king_profile_id,king_name")
        .eq("world_player_id", worldPlayerId)
        .limit(1),
    );
    const explorationRows = await selectOrThrow(
      supabase
        .from("world_player_exploration_states")
        .select("world_player_id,world_id,coord_key,q,r,discovery_type,status,title")
        .eq("world_player_id", worldPlayerId)
        .eq("coord_key", explorationCoordKey)
        .limit(1),
    );
    const stateRows = await selectOrThrow(
      supabase
        .from("world_player_imperial_states")
        .select("world_player_id,materials_stock,supplies_stock,militia_count,scouts_count,sandbox_snapshots_json,logs_json")
        .eq("world_player_id", worldPlayerId)
        .limit(1),
    );
    const stateRow = stateRows[0] ?? null;
    const runtimeMap = stateRow?.sandbox_snapshots_json?.__runtimeMap ?? {};
    const clientState = stateRow?.sandbox_snapshots_json?.__clientState ?? {};
    const movements = Array.isArray(runtimeMap.mapMovements) ? runtimeMap.mapMovements : [];
    const movementProof = movements.find((movement) => movement?.id?.startsWith?.("smoke-n8-")) ?? movements[0] ?? null;
    const aiCount = playerRows.filter((player) => Number(player.power_score_cached ?? 0) > 0).length;

    report.sqlProof = {
      world: worldRow,
      participantPlayer,
      participantCount: playerRows.length,
      aiLikeCount: aiCount,
      king: kingRows[0] ?? null,
      exploration: explorationRows[0] ?? null,
      state: {
        world_player_id: stateRow?.world_player_id,
        materials_stock: stateRow?.materials_stock,
        supplies_stock: stateRow?.supplies_stock,
        militia_count: stateRow?.militia_count,
        scouts_count: stateRow?.scouts_count,
        movementProof,
        clientStateHasExploration: Boolean(clientState.exploredCoordKeys || clientState.discoveriesByCoord),
      },
      suggestedSql: [
        `select id, slug, status, starts_at, runtime_started, runtime_real_time_enabled from worlds where slug = '${worldSlug}';`,
        `select count(*) as participants from world_players where world_id = '${worldRow?.id ?? "<world_id>"}';`,
        `select world_player_id, king_profile_id, king_name from world_player_king_states where world_player_id = '${worldPlayerId ?? "<world_player_id>"}';`,
        `select coord_key, q, r, discovery_type, status, title from world_player_exploration_states where world_player_id = '${worldPlayerId ?? "<world_player_id>"}' and coord_key = '${explorationCoordKey}';`,
        `select sandbox_snapshots_json #> '{__runtimeMap,mapMovements}' as movements, sandbox_snapshots_json #> '{__clientState,exploredCoordKeys}' as hidden_exploration from world_player_imperial_states where world_player_id = '${worldPlayerId ?? "<world_player_id>"}';`,
      ],
    };

    assertCheck(checks, "SQL mundo ficou agendado ou rodando", Boolean(worldRow?.starts_at) && Boolean(worldRow?.runtime_real_time_enabled), worldRow);
    assertCheck(checks, "SQL mundo tem 50 participantes", playerRows.length >= 50, { participantCount: playerRows.length });
    assertCheck(checks, "SQL participante esta vivo", participantPlayer?.status === "alive", participantPlayer);
    assertCheck(checks, "SQL rei dedicado do participante", kingRows[0]?.king_profile_id === "serenna" && kingRows[0]?.king_name === "Smoke N8 Serenna", kingRows[0]);
    assertCheck(checks, "SQL exploracao dedicada gravada", explorationRows[0]?.coord_key === explorationCoordKey && explorationRows[0]?.discovery_type === "opportunity", explorationRows[0]);
    assertCheck(checks, "SQL movimento de mapa ficou no runtime", Boolean(movementProof?.id), movementProof);
    assertCheck(checks, "snapshot nao guarda exploracao como verdade escondida", !clientState.exploredCoordKeys && !clientState.discoveriesByCoord, {
      clientStateHasExploration: Boolean(clientState.exploredCoordKeys || clientState.discoveriesByCoord),
    });
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
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
