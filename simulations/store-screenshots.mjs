// =============================================================
// KingsWorld — Gera screenshots de TELEFONE e TABLET pra ficha da Play Store
// Rodar: node simulations/store-screenshots.mjs
// Sobe servidor local (KW_SMOKE=1 -> dev-login), entra como usuário de teste,
// captura as telas principais em 3 tamanhos. RAW (sem moldura/legenda) — base
// pra a ficha; polimento ASO é etapa de design separada.
// Saída: store-assets/screenshots/{phone,tablet7,tablet10}/NN-tela.png
// =============================================================
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outRoot = path.join(projectRoot, "store-assets", "screenshots");
// porta aleatória por run -> evita conectar num servidor velho/fantasma de runs anteriores
const PORT = process.env.SS_PORT ?? String(3300 + Math.floor(Math.random() * 600));
const baseUrl = `http://localhost:${PORT}`;
const useExternal = process.env.SMOKE_USE_EXISTING_SERVER === "1";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(url, { redirect: "manual" }); if (r.ok || r.status === 307 || r.status === 308) return; } catch {}
    await delay(1200);
  }
  throw new Error(`Servidor não respondeu a tempo em ${url}`);
}

function spawnServer() {
  return spawn("cmd.exe", ["/c", `set KW_SMOKE=1&& set PORT=${PORT}&& npm run start`], {
    cwd: projectRoot, env: { ...process.env, FORCE_COLOR: "0", PORT }, stdio: ["ignore", "pipe", "pipe"],
  });
}

async function devLogin(page) {
  return page.evaluate(async () => {
    const r = await fetch("/api/dev-login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    return r.ok;
  });
}

// CSS width/height + deviceScaleFactor -> resolução final (px)
const DEVICES = {
  phone:    { width: 360, height: 640,  deviceScaleFactor: 3 },  // 1080x1920 (9:16)
  tablet7:  { width: 600, height: 960,  deviceScaleFactor: 2 },  // 1200x1920
  tablet10: { width: 800, height: 1280, deviceScaleFactor: 2 },  // 1600x2560
};

function screensFor(worldId) {
  return [
    { name: "01-lobby", url: `/lobby` },
    { name: "02-mapa", url: `/world/${worldId}/board` },
    { name: "03-imperio", url: `/world/${worldId}/empire` },
    { name: "04-cidade", url: `/world/${worldId}/base` },
  ];
}

async function run() {
  const report = { ok: false, captured: [], failed: [] };
  let server = null, browser = null;
  try {
    if (!useExternal) {
      server = spawnServer();
      server.stdout.on("data", () => {});
      server.stderr.on("data", () => {});
      await waitForServer(`${baseUrl}/login`, 180_000);
    }
    browser = await chromium.launch({ headless: true });

    // descobre o mundo jogável uma vez (contexto temporário)
    const tmp = await browser.newContext({ viewport: { width: 800, height: 1280 }, locale: "pt-BR" });
    const tmpPage = await tmp.newPage();
    await tmpPage.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    if (!(await devLogin(tmpPage))) throw new Error("dev-login falhou");
    await tmpPage.goto(`${baseUrl}/lobby`, { waitUntil: "networkidle" });
    let worldId = null;
    try {
      const picker = tmpPage.locator('[data-smoke="lobby-world-picker"]');
      await picker.waitFor({ state: "visible", timeout: 20_000 });
      worldId = await picker.inputValue();
    } catch {}
    await tmp.close();
    if (!worldId) throw new Error("Nenhum mundo jogável no lobby (não deu pra achar worldId)");

    const screens = screensFor(worldId);
    for (const [device, vp] of Object.entries(DEVICES)) {
      const dir = path.join(outRoot, device);
      await mkdir(dir, { recursive: true });
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, locale: "pt-BR" });
      const page = await ctx.newPage();
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
      await devLogin(page);
      for (const screen of screens) {
        try {
          // domcontentloaded (não networkidle): páginas do mundo vivo fazem polling
          // contínuo e nunca ficam "idle". Espera fixa cobre a hidratação/render.
          await page.goto(`${baseUrl}${screen.url}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
          // espera a splash "Carregando mundo" sumir (FASE x/4) antes de capturar
          await page.waitForFunction(
            () => !/Carregando mundo|Preparando ac/i.test(document.body?.innerText ?? ""),
            { timeout: 30_000 },
          ).catch(() => {});
          await delay(3500); // render final da tela real
          const file = path.join(dir, `${screen.name}.png`);
          await page.screenshot({ path: file, fullPage: false });
          report.captured.push(path.relative(projectRoot, file));
          console.log(`  ✅ ${device}/${screen.name}`);
        } catch (e) {
          report.failed.push({ device, screen: screen.name, error: String(e).split("\n")[0] });
          console.log(`  ❌ ${device}/${screen.name}: ${String(e).split("\n")[0]}`);
        }
      }
      await ctx.close();
    }
    report.ok = report.failed.length === 0;
  } catch (e) {
    report.error = String(e).split("\n")[0];
    console.log("ERRO:", report.error);
  } finally {
    if (browser) await browser.close();
    if (server && server.pid) { try { spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"]); } catch {} }
  }
  console.log(`\nCapturadas: ${report.captured.length}  |  Falhas: ${report.failed.length}`);
  console.log(`Pasta: store-assets/screenshots/{phone,tablet7,tablet10}/`);
  process.exit(report.captured.length > 0 ? 0 : 1);
}
run();
