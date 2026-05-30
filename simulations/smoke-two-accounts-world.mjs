import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const reportPath = path.join(projectRoot, "reports", "smoke-two-accounts-world.json");

const defaultSmokePort = process.env.SMOKE_PORT ?? "3218";
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${defaultSmokePort}`;
const useExternalServer = process.env.SMOKE_USE_EXISTING_SERVER === "1";
const waitServerTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000);
const accountKeys = ["1", "2"];

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
        headers: { cookie: "kw_dev_auth=1", "x-kw-smoke": "1" },
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

function devUserIdFromKey(key) {
  if (key === "1") return "00000000-0000-4000-8000-000000000001";
  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const suffix = Math.max(2, hash).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
}

function assertCheck(checks, label, ok, details = null) {
  checks.push({ label, ok: Boolean(ok), details });
}

async function selectOrThrow(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function main() {
  await loadLocalEnv();
  const checks = [];
  const report = {
    status: "FAIL",
    generatedAt: new Date().toISOString(),
    server: { mode: useExternalServer ? "external" : "spawned" },
    accounts: [],
    sqlProof: {},
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

    for (const key of accountKeys) {
      const login = await fetchJson("/api/dev-login", key, {
        method: "POST",
        body: JSON.stringify({ user: key }),
      });
      assertCheck(checks, `dev login conta ${key}`, login.ok && login.json?.userKey === key, {
        status: login.status,
        body: login.json,
      });
    }

    const createWorld = await fetchJson("/api/worlds/alpha", "1", {
      method: "POST",
      body: JSON.stringify({ mode: "express" }),
    });
    assertCheck(checks, "cria/reusa Alpha Expressa", createWorld.ok && createWorld.json?.world?.slug === "alpha-expresso", {
      status: createWorld.status,
      body: createWorld.json,
    });

    for (const key of accountKeys) {
      const payload = await fetchJson("/api/worlds/alpha-expresso", key);
      const account = {
        key,
        ok: payload.ok,
        worldPlayerId: payload.json?.worldPlayerId ?? null,
        activeVillageId: payload.json?.world?.activeVillageId ?? null,
        day: payload.json?.world?.day ?? null,
        durationDays: payload.json?.world?.durationDays ?? null,
        speedMultiplier: payload.json?.world?.speedMultiplier ?? null,
      };
      report.accounts.push(account);
      assertCheck(checks, `conta ${key} entrou no mesmo mundo`, payload.ok && Boolean(account.worldPlayerId), account);
    }

    const worldRows = await selectOrThrow(
      supabase.from("worlds").select("id,slug,season_mode,speed_multiplier").eq("slug", "alpha-expresso").limit(1),
    );
    const worldRow = worldRows[0] ?? null;
    const authIds = accountKeys.map(devUserIdFromKey);
    const userRows = await selectOrThrow(
      supabase.from("users").select("id,username,email,auth_user_id").in("auth_user_id", authIds),
    );
    const userIds = userRows.map((user) => user.id);
    const playerRows = worldRow
      ? await selectOrThrow(
          supabase
            .from("world_players")
            .select("id,world_id,user_id,status,current_capital_site_id")
            .eq("world_id", worldRow.id)
            .in("user_id", userIds),
        )
      : [];
    const playerIds = playerRows.map((player) => player.id);
    const villageRows = playerIds.length
      ? await selectOrThrow(
          supabase
            .from("villages")
            .select("site_id,world_id,owner_world_player_id,name,village_type,is_original_capital")
            .eq("world_id", worldRow.id)
            .in("owner_world_player_id", playerIds),
        )
      : [];
    const stateRows = playerIds.length
      ? await selectOrThrow(
          supabase
            .from("world_player_imperial_states")
            .select("world_player_id,materials_stock,supplies_stock,militia_count")
            .eq("world_id", worldRow.id)
            .in("world_player_id", playerIds),
        )
      : [];

    report.sqlProof = {
      world: worldRow,
      users: userRows,
      players: playerRows,
      villages: villageRows,
      imperialStates: stateRows,
      suggestedSql: [
        "select id, slug, season_mode, speed_multiplier from worlds where slug = 'alpha-expresso';",
        `select id, username, email, auth_user_id from users where auth_user_id in (${authIds.map((id) => `'${id}'`).join(", ")});`,
        `select id, world_id, user_id, status, current_capital_site_id from world_players where world_id = '${worldRow?.id ?? "<world_id>"}' and user_id in (${userIds.map((id) => `'${id}'`).join(", ")});`,
        `select site_id, owner_world_player_id, name, village_type, is_original_capital from villages where world_id = '${worldRow?.id ?? "<world_id>"}' and owner_world_player_id in (${playerIds.map((id) => `'${id}'`).join(", ")});`,
      ],
    };

    assertCheck(checks, "SQL tem mundo express x4", worldRow?.season_mode === "express" && Number(worldRow?.speed_multiplier) === 4, worldRow);
    assertCheck(checks, "SQL tem 2 usuarios dev diferentes", userRows.length === 2 && new Set(userRows.map((user) => user.id)).size === 2, userRows);
    assertCheck(checks, "SQL tem 2 participantes no mesmo mundo", playerRows.length === 2 && new Set(playerRows.map((player) => player.world_id)).size === 1, playerRows);
    assertCheck(checks, "SQL tem 2 capitais diferentes", new Set(playerRows.map((player) => player.current_capital_site_id).filter(Boolean)).size === 2, playerRows);
    assertCheck(checks, "SQL tem cidades/capitais para os 2", villageRows.length >= 2, villageRows);
    assertCheck(checks, "SQL tem estado imperial para os 2", stateRows.length === 2, stateRows);
    for (const account of report.accounts) {
      const user = userRows.find((row) => row.auth_user_id === devUserIdFromKey(account.key));
      const player = user ? playerRows.find((row) => row.user_id === user.id) : null;
      assertCheck(
        checks,
        `payload da conta ${account.key} aponta para a propria capital`,
        Boolean(player?.current_capital_site_id) && account.activeVillageId === player.current_capital_site_id,
        {
          payloadActiveVillageId: account.activeVillageId,
          sqlCurrentCapitalSiteId: player?.current_capital_site_id ?? null,
        },
      );
    }
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
