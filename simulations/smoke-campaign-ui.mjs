import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const reportsDir = path.join(projectRoot, "reports", "smoke-campaign");
const screenshotsDir = path.join(reportsDir, "screenshots");
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const useExternalServer = process.env.SMOKE_USE_EXISTING_SERVER === "1";
const smokeTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180_000);

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
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
    } catch {}
    await delay(1200);
  }
  throw new Error(`Dev server did not respond in time at ${url}.`);
}

function spawnDevServer() {
  return spawn("cmd.exe", ["/c", "set KW_SMOKE=1&& npm run start"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function pageJson(page, input, init) {
  return page.evaluate(
    async ({ input, init }) => {
      const response = await fetch(input, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
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
    },
    { input, init },
  );
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
  next.exploredCoordKeys ??= [];
  next.discoveriesByCoord ??= {};
  next.extraVillages ??= [];

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
    }
    next.logs = ["Smoke: abertura do reino."];
    return next;
  }

  if (stage === "mid") {
    next.kingProfileId ??= "aurelian";
    next.kingName ??= "Smoke Crown";
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
    }
    next.logs = ["Smoke: metade da campanha carregada."];
    return next;
  }

  if (stage === "late") {
    next.kingProfileId ??= "aurelian";
    next.kingName ??= "Smoke Crown";
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
    }
    next.exploredCoordKeys = Array.from(new Set([...(next.exploredCoordKeys ?? []), "0:0", "1:0", "1:-1", "2:-1"]));
    next.discoveriesByCoord = {
      ...(next.discoveriesByCoord ?? {}),
      "1:-1": {
        type: "opportunity",
        title: "Ruína antiga",
        summary: "Estruturas antigas prometem ganho se a expedição voltar preparada.",
        risk: "médio",
        value: "alto",
        imageSrc: "/images/ruins.jpg",
        suggestedAction: "Investigar",
      },
    };
    next.logs = ["Smoke: fase tardia carregada."];
    return next;
  }

  next.kingProfileId ??= "aurelian";
  next.kingName ??= "Smoke Crown";
  next.resources.materials = 18200;
  next.resources.supplies = 16900;
  next.troops = { militia: 520, shooters: 340, scouts: 130, machinery: 68 };
  next.logs = ["Smoke: estado final da temporada."];
  return next;
}

async function run() {
  await ensureDir(reportsDir);
  await ensureDir(screenshotsDir);

  const runStartedAt = new Date();
  const report = {
    ok: false,
    startedAt: runStartedAt.toISOString(),
    finishedAt: null,
    worldId: null,
    worldUrl: null,
    clicks: [],
    assertions: [],
    console: [],
    screenshots: [],
    restore: null,
    error: null,
  };

  let serverProcess = null;
  let browser;
  let page;
  let snapshot = null;
  let imperialSnapshot = null;

  try {
    if (!useExternalServer) {
      serverProcess = spawnDevServer();
      serverProcess.stdout.on("data", () => {});
      serverProcess.stderr.on("data", () => {});
      await waitForServer(`${baseUrl}/login`, smokeTimeoutMs);
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "pt-BR",
    });
    page = await context.newPage();

    page.on("console", (message) => {
      const text = message.text();
      if (!text) return;
      report.console.push({ type: message.type(), text });
    });
    page.on("pageerror", (error) => {
      report.console.push({ type: "pageerror", text: String(error) });
    });

    const noteClick = async (label, locator, screenshotName = null) => {
      report.clicks.push({
        at: new Date().toISOString(),
        label,
        url: page.url(),
      });
      await locator.click();
      if (screenshotName) {
        const filePath = path.join(screenshotsDir, screenshotName);
        await page.screenshot({ path: filePath, fullPage: true });
        report.screenshots.push(filePath);
      }
    };

    const assertVisible = async (label, locator) => {
      await locator.waitFor({ state: "visible", timeout: 20_000 });
      report.assertions.push({
        at: new Date().toISOString(),
        label,
        ok: true,
        url: page.url(),
      });
    };

    const callCampaignStage = async (worldId, stage) => {
      const response = await pageJson(page, `/api/dev-smoke/worlds/${worldId}/campaign`, {
        method: "POST",
        body: JSON.stringify({ action: "stage", stage }),
      });
      if (!response.ok) {
        throw new Error(`Smoke stage "${stage}" failed: ${JSON.stringify(response.json)}`);
      }
      report.assertions.push({
        at: new Date().toISOString(),
        label: `Campanha movida para ${stage}`,
        ok: true,
        url: page.url(),
      });
    };

    const putImperialState = async (worldId, nextState) => {
      const response = await pageJson(page, `/api/worlds/${worldId}/imperial-state`, {
        method: "PUT",
        body: JSON.stringify(nextState),
      });
      if (!response.ok) {
        throw new Error(`Imperial state PUT failed: ${JSON.stringify(response.json)}`);
      }
    };

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    const devLoginResponse = await pageJson(page, "/api/dev-login", { method: "POST" });
    if (!devLoginResponse.ok) {
      throw new Error(`Dev login failed in smoke: ${JSON.stringify(devLoginResponse.json)}`);
    }
    report.clicks.push({
      at: new Date().toISOString(),
      label: "Entrada dev por API de smoke",
      url: page.url(),
    });
    await page.goto(`${baseUrl}/lobby`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(screenshotsDir, "01-login.png"), fullPage: true });
    report.screenshots.push(path.join(screenshotsDir, "01-login.png"));
    await assertVisible("Lobby carregou", page.locator('[data-smoke="lobby-world-picker"]'));

    const worldPicker = page.locator('[data-smoke="lobby-world-picker"]');
    const selectedWorldId = await worldPicker.inputValue();
    if (!selectedWorldId) {
      throw new Error("No playable world selected in lobby.");
    }

    await noteClick("Entrar no mundo", page.locator('[data-smoke="lobby-enter-world"]'), "02-lobby.png");
    await page.waitForURL(/\/world\/.+/, { timeout: 20_000 });

    const worldMatch = page.url().match(/\/world\/([^/]+)/);
    const worldId = worldMatch?.[1] ?? null;
    if (!worldId) {
      throw new Error(`Could not extract world id from ${page.url()}.`);
    }
    report.worldId = worldId;
    report.worldUrl = page.url();

    const snapshotResponse = await pageJson(page, `/api/dev-smoke/worlds/${worldId}/campaign`);
    if (!snapshotResponse.ok) {
      throw new Error(`Could not snapshot campaign state: ${JSON.stringify(snapshotResponse.json)}`);
    }
    snapshot = snapshotResponse.json.snapshot;

    const imperialResponse = await pageJson(page, `/api/worlds/${worldId}/imperial-state`);
    if (!imperialResponse.ok) {
      throw new Error(`Could not snapshot imperial state: ${JSON.stringify(imperialResponse.json)}`);
    }
    imperialSnapshot = imperialResponse.json;

    await callCampaignStage(worldId, "opening");
    await putImperialState(worldId, buildImperialSeed("opening", imperialSnapshot));
    await page.reload({ waitUntil: "networkidle" });

    await assertVisible("Modal de rei apareceu", page.locator('[data-smoke="king-selection-modal"]'));
    await noteClick("Escolher rei Aurelian", page.locator('[data-smoke="king-card-aurelian"]'), "03-king-selection.png");
    const kingNameInput = page.locator('[data-smoke="king-name-input"]');
    await kingNameInput.fill("Smoke Crown");
    report.clicks.push({ at: new Date().toISOString(), label: "Preencher nome do rei", url: page.url() });
    await noteClick("Confirmar rei", page.locator('[data-smoke="confirm-king-selection"]'));
    await page.locator('[data-smoke="king-selection-modal"]').waitFor({ state: "hidden", timeout: 20_000 });

    await noteClick("Abrir Cidades", page.getByRole("button", { name: /Cidades/i }), "04-base-tab.png");
    await assertVisible("Cena da cidade visível", page.locator('[data-smoke="village-scene"]'));
    await noteClick("Abrir setor Governo", page.locator('[data-smoke="city-sector-crown"]'));
    await assertVisible("Modal de setor visível", page.locator('[data-smoke="city-sector-modal"]'));
    await noteClick("Subir skill da Coroa", page.locator('[data-smoke="skill-up-crown-a"]'));
    await assertVisible("Popup de upgrade apareceu", page.locator('[data-smoke="skill-upgrade-popup"]'));
    await noteClick("Confirmar upgrade", page.locator('[data-smoke="confirm-skill-upgrade"]'), "05-city-upgrade.png");
    await page.locator('[data-smoke="skill-upgrade-popup"]').waitFor({ state: "hidden", timeout: 20_000 });
    await page.keyboard.press("Escape");

    await noteClick("Abrir Mundo", page.getByRole("button", { name: /Mundo/i }), "06-board-tab.png");
    await assertVisible("Mapa estratégico carregou", page.locator('[data-smoke="strategic-map"]'));
    await noteClick("Zoom out do mapa", page.locator('[data-smoke="map-zoom-out"]'));
    await delay(900);
    await noteClick("Zoom out do mapa novamente", page.locator('[data-smoke="map-zoom-out"]'));
    await delay(900);
    const viewport = page.locator('[data-smoke="map-viewport"]');
    await viewport.click({ position: { x: 190, y: 220 } });
    report.clicks.push({ at: new Date().toISOString(), label: "Clique no mapa para aproximar (Z2)", url: page.url() });
    await delay(1100);
    await viewport.click({ position: { x: 215, y: 240 } });
    report.clicks.push({ at: new Date().toISOString(), label: "Clique no mapa para aproximar (Z3)", url: page.url() });
    await delay(1100);
    await noteClick("Focar capital no mapa", page.locator('[data-smoke="map-focus-capital"]'), "07-map-opening.png");
    await delay(1100);

    await callCampaignStage(worldId, "mid");
    await putImperialState(worldId, buildImperialSeed("mid", imperialSnapshot));
    await page.reload({ waitUntil: "networkidle" });
    await noteClick("Abrir Intel na metade da campanha", page.getByRole("button", { name: /Intel/i }), "08-mid-intel.png");
    await assertVisible("Intel abriu na metade", page.getByText(/Dia 38|Dia 39|Dia 40/i).first());
    await noteClick("Voltar para Cidades na metade", page.getByRole("button", { name: /Cidades/i }));
    await assertVisible("Cidade ainda abre na metade", page.locator('[data-smoke="village-scene"]'));

    await callCampaignStage(worldId, "late");
    await putImperialState(worldId, buildImperialSeed("late", imperialSnapshot));
    await page.goto(`${baseUrl}/world/${worldId}/board`, { waitUntil: "networkidle" });
    await assertVisible("Mapa abriu na fase tardia", page.locator('[data-smoke="strategic-map"]'));
    await noteClick("Focar capital na fase tardia", page.locator('[data-smoke="map-focus-capital"]'));
    await delay(1000);
    await page.locator('[data-smoke="map-zoom-out"]').click();
    await delay(900);
    await page.locator('[data-smoke="map-zoom-in"]').click();
    await delay(900);
    await page.screenshot({ path: path.join(screenshotsDir, "09-late-map.png"), fullPage: true });
    report.screenshots.push(path.join(screenshotsDir, "09-late-map.png"));

    await callCampaignStage(worldId, "final");
    await putImperialState(worldId, buildImperialSeed("final", imperialSnapshot));
    await page.goto(`${baseUrl}/world/${worldId}/intelligence`, { waitUntil: "networkidle" });
    await assertVisible("Modal final abriu", page.locator('[data-smoke="final-season-modal"]'));
    await page.screenshot({ path: path.join(screenshotsDir, "10-final-modal.png"), fullPage: true });
    report.screenshots.push(path.join(screenshotsDir, "10-final-modal.png"));

    await noteClick("Continuar em leitura", page.locator('[data-smoke="continue-readonly"]'));
    await noteClick("Abrir Mundo em leitura", page.getByRole("button", { name: /Mundo/i }));
    await assertVisible("Mapa em leitura segue abrindo", page.locator('[data-smoke="strategic-map"]'));
    await noteClick("Abrir relatório final", page.getByRole("button", { name: /Intel/i }));
    await assertVisible("Modal final reapareceu", page.locator('[data-smoke="final-season-modal"]'));
    await noteClick("Entrar no relatório final", page.locator('[data-smoke="open-final-report"]'), "11-final-report-link.png");
    await assertVisible("Página de relatório final abriu", page.locator('[data-smoke="final-report-page"]'));
    await page.screenshot({ path: path.join(screenshotsDir, "12-final-report.png"), fullPage: true });
    report.screenshots.push(path.join(screenshotsDir, "12-final-report.png"));
    await noteClick("Voltar ao lobby pelo relatório", page.locator('[data-smoke="final-report-lobby-link"]'), "13-back-lobby.png");
    await page.waitForURL(/\/lobby$/, { timeout: 20_000 });

    report.ok = true;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (page && report.worldId && snapshot && imperialSnapshot) {
      try {
        const restoreImperial = await pageJson(page, `/api/worlds/${report.worldId}/imperial-state`, {
          method: "PUT",
          body: JSON.stringify(imperialSnapshot),
        });
        const restoreCampaign = await pageJson(page, `/api/dev-smoke/worlds/${report.worldId}/campaign`, {
          method: "POST",
          body: JSON.stringify({ action: "restore", snapshot }),
        });
        report.restore = {
          imperial: restoreImperial.ok,
          campaign: restoreCampaign.ok,
        };
      } catch (restoreError) {
        report.restore = {
          ok: false,
          error: restoreError instanceof Error ? restoreError.message : String(restoreError),
        };
      }
    }

    report.finishedAt = new Date().toISOString();
    const reportPath = path.join(reportsDir, "latest.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    if (browser) {
      await browser.close();
    }

    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
