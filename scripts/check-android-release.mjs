// Release gate for the installed app: the screens are bundled, and the game server they call
// must already accept app requests (bearer token + CORS for https://localhost).
import {readFile, writeFile, mkdir, readdir} from "node:fs/promises";

const report = {at: new Date().toISOString(), status: "PENDING",
  scope: "Bundled app identity and game server readiness; not Play billing or device performance"};
try {
  const config = JSON.parse(await readFile(new URL("../android/app/src/main/assets/capacitor.config.json", import.meta.url), "utf8"));
  if (config.appId !== "com.kingsworld.app") throw Error("Release requires the com.kingsworld.app package");
  if (config.server?.url) throw Error("Release must bundle the screens; remove KW_REMOTE_SHELL_URL and sync again");
  report.package = config.appId;

  const assets = new URL("../android/app/src/main/assets/public/", import.meta.url);
  const html = await readFile(new URL("index.html", assets), "utf8");
  const scripts = (await readdir(new URL("assets/", assets))).filter(name => name.endsWith(".js"));
  const bundle = (await Promise.all(scripts.map(name => readFile(new URL(`assets/${name}`, assets), "utf8")))).join("\n");
  const api = /KW_APP_API_URL:"([^"]+)"/.exec(bundle)?.[1];
  if (!html.includes("<div id=\"app\">") || !api) throw Error("The bundled app is missing; run npm run app:build first");
  if (/KW_APP_DEV_AUTH:"/.test(bundle)) throw Error("The bundle contains development sign-in");
  const url = new URL(api);
  if (url.protocol !== "https:") throw Error("The game server must use HTTPS");
  report.api = url.origin;

  const preflight = await fetch(new URL("/api/lobby", url), {method: "OPTIONS", signal: AbortSignal.timeout(20000),
    headers: {origin: "https://localhost", "access-control-request-method": "GET", "access-control-request-headers": "authorization"}});
  report.preflightStatus = preflight.status;
  if (preflight.headers.get("access-control-allow-origin") !== "https://localhost")
    throw Error("The game server does not accept the installed app yet; deploy the API first");
  const release = await fetch(new URL("/api/release", url), {signal: AbortSignal.timeout(20000)});
  if (!release.ok || (await release.json()).application !== "kingsworld") throw Error("The game server does not identify itself as KingsWorld");
  report.status = "PASS";
} catch (error) {
  report.reason = error instanceof Error ? error.message : "Release verification unavailable";
}
await mkdir(new URL("../reports/cozy/", import.meta.url), {recursive: true});
await writeFile(new URL("../reports/cozy/android-release-gate.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
