// Installed-app shell (native-app/) against the real Next API routes and the local fixture database.
// Checks: bundled screens open, API calls go cross-origin with a bearer token, only Classic 120 and
// Express 30 are offered, and a world opens and accepts an action.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {createServer as netServer} from "node:net";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {createServer as viteServer} from "vite";
import {startCozyRest} from "./lib/cozy-fixture.mjs";
import {createCozyFoundingDatabase} from "./lib/cozy-founding-fixture.mjs";
import {loadCozyEngine} from "./lib/load-cozy-engine.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const reports = path.join(root, "reports/app-shell");
await mkdir(reports, {recursive: true});
const freePort = async () => {
  const socket = netServer();
  await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
  const {port} = socket.address();
  await new Promise(resolve => socket.close(resolve));
  return port;
};

const db = await createCozyFoundingDatabase({persistent: false});
const rest = await startCozyRest(db);
const apiPort = await freePort();
const api = `http://127.0.0.1:${apiPort}`;
const fixtureEnv = {NEXT_PUBLIC_SUPABASE_URL: rest.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
  SUPABASE_SECRET_KEY: "fixture-service", SUPABASE_SERVICE_ROLE_KEY: "fixture-service"};
const next = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(apiPort)], {
  cwd: root, windowsHide: true, stdio: "ignore",
  env: {...process.env, ...fixtureEnv, NEXT_DIST_DIR: ".next-app-shell-test", KW_COZY_PERSISTENT_PREVIEW: "", KW_ENABLE_PVP: ""},
});
Object.assign(process.env, fixtureEnv, {KW_APP_API_URL: api, KW_APP_DEV_AUTH: "1", NEXT_PUBLIC_KW_SHOW_PVP: ""});
let vite, browser;
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(api + "/api/release")).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (i === 119) throw Error("A API local não iniciou");
  }
  vite = await viteServer({configFile: path.join(root, "native-app/vite.config.mjs"), mode: "development", server: {port: await freePort()}});
  await vite.listen();
  const app = vite.resolvedUrls.local[0].replace(/\/$/, "");

  // Warm the routes the app uses so the timing below measures the app, not Next's first compile.
  for (const route of ["/api/lobby", "/api/me/entitlements", "/api/worlds/discover"])
    await fetch(api + route, {headers: {authorization: "Bearer dev:1"}});

  browser = await chromium.launch();
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  const apiCalls = [], failures = [], errors = [];
  page.on("request", request => {
    if (request.url().includes("/api/")) apiCalls.push({url: request.url(), auth: request.headers().authorization ?? ""});
  });
  page.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", error => errors.push(error.message));
  if (process.env.KW_TEST_DEBUG) {
    page.on("console", message => console.log("[console]", message.type(), message.text().slice(0, 200)));
    page.on("request", request => { if (request.method() !== "GET") console.log("[req]", request.method(), request.url()); });
    page.on("requestfailed", request => console.log("[failed]", request.method(), request.url(), request.failure()?.errorText));
  }

  // CORS preflight from the app origin.
  const preflight = await fetch(api + "/api/lobby", {method: "OPTIONS", headers: {origin: "https://localhost",
    "access-control-request-method": "GET", "access-control-request-headers": "authorization"}});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://localhost");

  const opened = Date.now();
  await page.goto(app + "/lobby");
  await page.getByRole("button", {name: "Criar", exact: true}).first().waitFor({timeout: 60_000});
  const lobbyMs = Date.now() - opened;
  await page.screenshot({path: path.join(reports, "lobby-390.png")});

  await page.getByRole("button", {name: "Criar", exact: true}).first().tap();
  await page.getByRole("button", {name: "Clássico · 120 dias"}).waitFor();
  await page.getByRole("button", {name: "Expresso · 30 dias"}).waitFor();
  assert.equal(await page.getByText("Competitivo").count(), 0, "PvP must stay hidden");
  await page.getByRole("button", {name: "Expresso · 30 dias"}).tap();
  await page.getByLabel("Nome do novo mundo").fill("Reino do App");
  await page.screenshot({path: path.join(reports, "create-390.png")});
  await page.locator('[data-smoke="create-world-submit"]').tap();
  await page.locator('[data-smoke="enter-created-world"]').waitFor({timeout: 30_000});
  await page.locator('[data-smoke="enter-created-world"]').tap();
  await page.waitForURL(/\/world\//, {timeout: 30_000});
  await page.waitForFunction(() => !document.body.innerText.includes("Abrindo") && document.body.innerText.trim().length > 40, null, {timeout: 60_000});
  await page.waitForTimeout(1500);
  await page.screenshot({path: path.join(reports, "world-390.png")});
  const worldText = (await page.locator("body").innerText()).slice(0, 600);

  // Every API call went to the game server, cross-origin, with the bearer token.
  assert(apiCalls.length > 3, "the app must call the API");
  for (const call of apiCalls) {
    assert(call.url.startsWith(api + "/api/"), `call outside the API: ${call.url}`);
    assert.equal(call.auth, "Bearer dev:1", `call without token: ${call.url}`);
  }
  assert.deepEqual(errors, [], "page errors");
  const unexpected = failures.filter(line => !/\/api\/me\/(royal-attributes|appearance)/.test(line));
  assert.deepEqual(unexpected, [], "API failures");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "horizontal scroll");

  // --- Instant taps: the predicted result shows before the server answers. ---
  const slug = decodeURIComponent(/\/world\/([^/]+)/.exec(page.url())[1]);
  const command = async action => {
    const response = await fetch(`${api}/api/worlds/${encodeURIComponent(slug)}/cozy`, {method: "POST",
      headers: {authorization: "Bearer dev:1", "content-type": "application/json"},
      body: JSON.stringify({action, requestId: crypto.randomUUID()})});
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body).slice(0, 300));
    return body;
  };
  await command({type: "king_choose", profileId: "builder", nickname: "afonso_dev"});
  let snapshot = await command({type: "start_world"});

  // The phone runs the same rules: its prediction must match the server's answer.
  const {predictCozyPayload} = loadCozyEngine("predict");
  for (const action of [{type: "recruit", troop: "militia", amount: 3}, {type: "recruit", troop: "militia", amount: 2}]) {
    const predicted = predictCozyPayload(snapshot, action, snapshot.serverNow);
    assert(predicted, `no prediction for ${action.type}`);
    const confirmed = await command(action);
    assert.deepEqual(predicted.state.army, confirmed.state.army, "army prediction");
    assert(Math.abs(predicted.state.resources.materials - confirmed.state.resources.materials) <= 5, "materials prediction");
    assert.equal(predicted.computed.influence.military, confirmed.computed.influence.military, "influence prediction");
    snapshot = confirmed;
  }

  // In the app, a tap shows its result while the server is still answering (2 s delay here).
  await page.route(/\/api\/worlds\/[^/]+\/cozy$/, async route => {
    if (route.request().method() === "POST") await new Promise(resolve => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes("Militar"), null, {timeout: 60_000});
  await page.screenshot({path: path.join(reports, "world-started-390.png")});
  const skip = page.getByRole("button", {name: "Pular", exact: true});
  if (await skip.isVisible().catch(() => false)) await skip.tap();
  await page.getByRole("button", {name: "Militar", exact: true}).tap();
  await page.waitForTimeout(500);
  if (await skip.isVisible().catch(() => false)) await skip.tap();
  const recruit = page.getByRole("button", {name: /^Recrutar \d+ /}).first();
  await recruit.waitFor({timeout: 20_000});
  const armyCount = page.getByLabel(/ no exército$/).first();
  const before = await armyCount.getAttribute("aria-label");
  if (process.env.KW_TEST_DEBUG) {
    await page.screenshot({path: path.join(reports, "military-before-390.png")});
    console.log("[debug-pre]", JSON.stringify({before, enabled: await recruit.isEnabled(), label: await recruit.getAttribute("aria-label"),
      trial: await recruit.tap({trial: true, timeout: 4000}).then(() => "ok", error => error.message.split(/\r?\n/).slice(0, 6).join(" | "))}));
  }
  const posted = page.waitForResponse(response => /\/cozy$/.test(response.url()) && response.request().method() === "POST");
  const tapped = Date.now();
  await recruit.tap();
  await page.waitForFunction(previous => [...document.querySelectorAll("[aria-label$=' no exército']")]
    .some(node => node.getAttribute("aria-label") !== previous), before, {timeout: 1500});
  const tapToScreenMs = Date.now() - tapped;
  if (process.env.KW_TEST_DEBUG) {
    await page.waitForTimeout(3000);
    console.log("[debug]", JSON.stringify({before, now: await armyCount.getAttribute("aria-label"), errors,
      text: (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 900)}));
  }
  await page.screenshot({path: path.join(reports, "recruit-instant-390.png")});
  const confirmedResponse = await posted;
  const serverMs = Date.now() - tapped;
  assert.equal(confirmedResponse.status(), 200);
  await page.waitForTimeout(300);
  const after = await armyCount.getAttribute("aria-label");
  assert.notEqual(after, before, "the confirmed result keeps the recruited troops");
  assert(tapToScreenMs < serverMs, "the screen must change before the server answers");

  // Two quick taps in a row are both accepted (no lock while the first is confirmed).
  const second = page.waitForResponse(response => /\/cozy$/.test(response.url()) && response.request().method() === "POST");
  await recruit.tap();
  await recruit.tap();
  await second;
  await page.waitForTimeout(2600);
  const finalSnapshot = await (await fetch(`${api}/api/worlds/${encodeURIComponent(slug)}/cozy`, {headers: {authorization: "Bearer dev:1"}})).json();
  assert.equal(await armyCount.getAttribute("aria-label"), `${finalSnapshot.state.army.militia} no exército`, "screen matches the server after the queue");
  console.log(JSON.stringify({lobbyMs, tapToScreenMs, serverMs, army: {before, after, final: finalSnapshot.state.army.militia}}, null, 1));
  console.log("PASS app shell: lobby, modos 120/Expresso, criação, mundo, previsão = servidor, clique instantâneo e cliques em sequência.");
} finally {
  await browser?.close();
  await vite?.close();
  next.kill();
  await rest.close();
  await db.close();
}
