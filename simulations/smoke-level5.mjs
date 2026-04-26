import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const REPORT_PATH = path.join(REPORTS_DIR, "smoke-level5.json");

function runNpm(script) {
  const result = spawnSync("cmd.exe", ["/c", "npm", "run", script], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
  });

  return {
    script,
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
  };
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function assertContains(errors, label, text, expected) {
  if (!text.includes(expected)) {
    errors.push(`${label}: trecho esperado nao encontrado: ${expected}`);
  }
}

function assertNotContains(errors, label, text, forbidden) {
  if (text.includes(forbidden)) {
    errors.push(`${label}: trecho proibido encontrado: ${forbidden}`);
  }
}

function staticChecks() {
  const errors = [];
  const warnings = [];
  const gameBalance = readText("core/GameBalance.ts");
  const empireSystems = readText("lib/empire-systems.ts");
  const villageScene = readText("components/base/VillageScene.tsx");
  const imperialRoute = readText("app/api/worlds/[worldId]/imperial-state/route.ts");

  assertContains(errors, "Score maximo", gameBalance, "export const SOVEREIGNTY_SCORE_MAX = 2500");
  assertContains(errors, "Corte do portal", gameBalance, "export const SOVEREIGNTY_PORTAL_CUT = 1500");
  assertContains(errors, "Infraestrutura 1000", gameBalance, "production: 1000");
  assertContains(errors, "Governo 500", gameBalance, "government: 500");
  assertContains(errors, "Militar 400", gameBalance, "military: SOVEREIGNTY_MILITARY_SCORE_CAP");
  assertContains(errors, "Sociedade 300", gameBalance, "society: 300");
  assertContains(errors, "Legado 300", gameBalance, "legacy: 300");
  assertContains(errors, "Governo por heroi", gameBalance, "const governmentScore = clamp(heroCount * 50");
  assertContains(errors, "Tribo vale 100", gameBalance, "export const TRIBE_LOYALTY_FULL_BONUS = 100");
  assertContains(errors, "Legado com duas maravilhas", gameBalance, "clamp(wonderCount, 0, 2) * 50");
  assertContains(errors, "UI legado duas maravilhas", empireSystems, "/2 maravilhas");
  assertContains(errors, "UI governo por heroi", empireSystems, "Cada heroi vale 50 pontos fixos");

  assertNotContains(errors, "Persistencia real", imperialRoute, "influence_stock");
  assertNotContains(errors, "Persistencia real", imperialRoute, "energy_stock");
  assertNotContains(errors, "Yield visivel da cidade", villageScene, " I/d");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function main() {
  const staticResult = staticChecks();
  const typecheck = runNpm("typecheck");
  const build = runNpm("build");
  const balance = runNpm("smoke:balance");
  const campaign = runNpm("smoke:campaign:code");
  const executions = [typecheck, build, balance, campaign];
  const executionErrors = executions
    .filter((entry) => !entry.ok)
    .map((entry) => `${entry.script} falhou: ${entry.stderr || entry.stdout || `status ${entry.status}`}`);
  const errors = [...staticResult.errors, ...executionErrors];
  const warnings = [...staticResult.warnings];
  const status = errors.length === 0 ? "PASS" : "FAIL";

  const report = {
    status,
    generatedAt: new Date().toISOString(),
    checks: {
      staticRules: staticResult.ok,
      typecheck: typecheck.ok,
      build: build.ok,
      balance: balance.ok,
      campaignCode: campaign.ok,
    },
    errors,
    warnings,
    executions: executions.map((entry) => ({
      script: entry.script,
      ok: entry.ok,
      status: entry.status,
    })),
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (status !== "PASS") {
    process.exitCode = 1;
  }
}

main();
