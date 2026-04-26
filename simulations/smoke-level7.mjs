import fs from "node:fs";
import path from "node:path";
const ROOT_DIR = process.cwd();
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const LEVEL7_REPORT_PATH = path.join(REPORTS_DIR, "smoke-level7.json");
const LEVEL6_REPORT_PATH = path.join(REPORTS_DIR, "smoke-level6.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function pushCheck(checks, label, ok, details = null) {
  checks.push({ label, ok: Boolean(ok), details });
}

function inspectConnectionFlow() {
  const checks = [];
  const worldShell = readText("components/world-shell.tsx");
  const imperialState = readText("lib/imperial-state.ts");
  const imperialRoute = readText("app/api/worlds/[worldId]/imperial-state/route.ts");
  const worldData = readText("lib/world-data.ts");
  const supabaseServer = readText("lib/supabase-server.ts");
  const appUser = readText("lib/app-user.ts");
  const profileRoute = readText("app/api/me/profile/route.ts");
  const lobbyPage = readText("app/lobby/page.tsx");
  const lobbySelector = readText("components/lobby-world-selector.tsx");
  const alphaWorldRoute = readText("app/api/worlds/alpha/route.ts");
  const devWorldRoute = readText("app/api/dev-worlds/test/route.ts");
  const profilePage = readText("app/profile/page.tsx");
  const profileClient = readText("components/profile-client.tsx");
  const globalsCss = readText("app/globals.css");
  const layout = readText("app/layout.tsx");
  const kingProfiles = readText("lib/king-profiles.ts");
  const villageScene = readText("components/base/VillageScene.tsx");

  pushCheck(checks, "layout em pt-BR", layout.includes('<html lang="pt-BR"'));
  pushCheck(checks, "metadata sem mojibake conhecido", !/Ã|Â|�/.test(layout));
  pushCheck(checks, "setImperialState retorna Promise<boolean>", imperialState.includes("): Promise<boolean>"));
  pushCheck(checks, "persistencia de estado confirma response.ok", imperialState.includes(".then((response) => response.ok)"));
  pushCheck(checks, "confirmacao da Coroa aguarda persistencia", worldShell.includes("const persisted = await setImperialState"));
  pushCheck(checks, "Coroa mostra salvando", worldShell.includes("kingSelectionSaving"));
  pushCheck(checks, "Coroa mostra erro se Supabase nao confirmar", worldShell.includes("kingSelectionError"));
  pushCheck(checks, "entrada bloqueia jogo ate carregar Coroa", worldShell.includes("waitingForKingState") && worldShell.includes("showWorldChrome"));
  pushCheck(checks, "modal de rei so abre depois do estado pronto", worldShell.includes("isImperialStateReady && !imperialState.kingProfileId"));
  pushCheck(checks, "reis tem traits positivos e negativos", kingProfiles.includes('tone: "bonus"') && kingProfiles.includes('tone: "penalty"'));
  pushCheck(checks, "GET carrega rei da tabela dedicada", imperialRoute.includes("loadKingState(payload.worldPlayerId)"));
  pushCheck(checks, "PUT persiste rei na tabela dedicada", imperialRoute.includes("persistKingState(payload.world.id, payload.worldPlayerId, nextStateRecord)"));
  pushCheck(checks, "world payload cria app user autenticado", worldData.includes("fetchOrCreateAppUser(authUser)"));
  pushCheck(checks, "world payload garante world player", worldData.includes("await ensureWorldPlayer(worldRecord, appUser)"));
  pushCheck(checks, "server auth usa Supabase ou dev cookie", supabaseServer.includes("supabase.auth.getUser()") && supabaseServer.includes("DEV_AUTH_COOKIE"));
  pushCheck(checks, "rota de perfil exige app user", profileRoute.includes("requireAuthenticatedAppUser()"));
  pushCheck(checks, "perfil atualiza username", appUser.includes("auth_user_id") && profileRoute.includes("username"));
  pushCheck(checks, "lobby nasce com app user real", lobbyPage.includes("requireAuthenticatedAppUser()") && !lobbyPage.includes("Visitante"));
  pushCheck(checks, "perfil nasce com app user real", profilePage.includes("requireAuthenticatedAppUser()") && profilePage.includes("initialUsername={appUser.username}"));
  pushCheck(checks, "perfil nao usa placeholder Seu reino", !profilePage.includes('initialUsername="Seu reino"'));
  pushCheck(checks, "lobby lembra ultimo mundo por conta", lobbySelector.includes("kw:last-world") && lobbySelector.includes("localStorage.setItem"));
  pushCheck(checks, "lobby tem botao de criar campanha Alpha", lobbySelector.includes("create-test-world") && lobbySelector.includes("/api/worlds/alpha"));
  pushCheck(checks, "lobby permite Alpha expressa", lobbySelector.includes("create-express-world") && lobbySelector.includes('"express"'));
  pushCheck(checks, "rota Alpha exige usuario autenticado", alphaWorldRoute.includes("requireAuthenticatedAppUser()"));
  pushCheck(checks, "rota Alpha grava no Supabase", alphaWorldRoute.includes('supabaseInsertReturning') && alphaWorldRoute.includes('"worlds"'));
  pushCheck(checks, "rota Alpha suporta modo expresso sem quebrar SQL antigo", alphaWorldRoute.includes("speed_multiplier") && alphaWorldRoute.includes("includeModeColumns"));
  pushCheck(checks, "rota Alpha reutiliza mundo aberto", alphaWorldRoute.includes("reused: true") && alphaWorldRoute.includes('status !== "finalized"'));
  pushCheck(checks, "rota Alpha nasce aberta dia zero", alphaWorldRoute.includes('status: "open"') && alphaWorldRoute.includes("day_number: 0"));
  pushCheck(checks, "rota cria mundo teste apenas em dev", devWorldRoute.includes('process.env.NODE_ENV !== "production"') && devWorldRoute.includes('slug: "teste-local"'));
  pushCheck(checks, "mundo teste nasce aberto dia zero", devWorldRoute.includes('status: "open"') && devWorldRoute.includes("day_number: 0"));
  pushCheck(checks, "mundo finalizado abre relatorio", lobbySelector.includes('`/world/${world.id}/report`') && profileClient.includes('`/world/${world.id}/report`'));
  pushCheck(checks, "label finalizado fala relatorio", worldData.includes('return "Ver relatorio"'));
  pushCheck(checks, "acoes inline centralizadas", globalsCss.includes(".inline-actions") && globalsCss.includes("justify-content: center"));
  pushCheck(checks, "botoes centralizam texto", globalsCss.includes("text-align: center"));
  pushCheck(checks, "perfil global sem mojibake conhecido", !/Ã|Â|�/.test(profileClient));

  pushCheck(checks, "modal de predio usa medalha sem label Nivel", !villageScene.includes('tracking-[0.18em] text-slate-300">Nível</div>'));

  return checks;
}

function main() {
  const level6 = readJsonIfExists(LEVEL6_REPORT_PATH);
  const checks = [
    {
      label: "smoke:level6 ja passou",
      ok: level6?.status === "PASS",
      details: level6?.status ?? "rode npm run smoke:level6 antes do gate 7",
    },
    ...inspectConnectionFlow(),
  ];
  const failed = checks.filter((check) => !check.ok);
  const report = {
    status: failed.length === 0 ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    checks,
    failed,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(LEVEL7_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
