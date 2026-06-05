import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = "3231";
const baseUrl = `http://localhost:${PORT}`;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(url, { redirect: "manual" }); if (r.ok || r.status === 307 || r.status === 308) return; } catch {}
    await delay(1200);
  }
  throw new Error("server timeout");
}

const server = spawn("cmd.exe", ["/c", `set KW_SMOKE=1&& set PORT=${PORT}&& npm run start`], { cwd: process.cwd(), env: { ...process.env, PORT }, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", () => {}); server.stderr.on("data", () => {});

try {
  await waitForServer(`${baseUrl}/login`, 120000);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1280 }, deviceScaleFactor: 2, locale: "pt-BR" });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await fetch("/api/dev-login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); });
  await page.goto(`${baseUrl}/lobby`, { waitUntil: "networkidle" });
  const worldId = await page.locator('[data-smoke="lobby-world-picker"]').inputValue();
  await page.goto(`${baseUrl}/world/${worldId}/empire`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !/Carregando mundo|Preparando ac/i.test(document.body?.innerText ?? ""), { timeout: 30000 }).catch(() => {});
  await delay(2500);
  const info = await page.evaluate(() => {
    const out = { innerWidth: window.innerWidth, mq768: window.matchMedia("(min-width:768px)").matches };
    // acha a lista de cidades pelo texto "no reino"
    const article = [...document.querySelectorAll("article")].find((a) => /no reino/i.test(a.textContent ?? ""));
    const list = article ? article.querySelector("div.mt-3, div[class*='space-y-2']") : null;
    if (list) { const cs = getComputedStyle(list); out.listDisplay = cs.display; out.listCols = cs.gridTemplateColumns; out.listClass = list.className; }
    else out.listFound = false;
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
} catch (e) { console.log("ERRO:", String(e).split("\n")[0]); }
finally { if (server.pid) { try { spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"]); } catch {} } }
process.exit(0);
