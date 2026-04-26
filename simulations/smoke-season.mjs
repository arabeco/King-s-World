import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "simulations", "output");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const OUTPUT_BASENAME = "season_v2_paired8";
const VALIDATION_PATH = path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_validation.json`);
const RESULTS_PATH = path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_results.json`);
const SMOKE_REPORT_PATH = path.join(REPORTS_DIR, "smoke-season.json");
const TARGETS = Object.freeze({
  secondVillageDay: 15,
  firstVillage100Day: 45,
  portalSurvivorsPerSeed: 15,
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function avg(items, selector) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

function pairRunsByProfile(runTable) {
  const pairs = new Map();

  for (const row of runTable) {
    const bucket = pairs.get(row.focusProfile) ?? {};
    if (String(row.scenario).endsWith("perfect")) {
      bucket.perfect = row;
    } else if (String(row.scenario).endsWith("lazy")) {
      bucket.lazy = row;
    }
    pairs.set(row.focusProfile, bucket);
  }

  return pairs;
}

function evaluateBalance(results) {
  const errors = [];
  const warnings = [];
  const lock = results?.lock ?? {};
  const runTable = Array.isArray(results?.runTable) ? results.runTable : [];

  if (Math.abs((lock.avgSecondVillageDay ?? Infinity) - TARGETS.secondVillageDay) > 1.5) {
    errors.push(`Media da 2a aldeia fora da faixa: ${lock.avgSecondVillageDay}.`);
  }
  if (Math.abs((lock.avgFirstVillage100Day ?? Infinity) - TARGETS.firstVillage100Day) > 3) {
    errors.push(`Media da 1a aldeia 100/100 fora da faixa: ${lock.avgFirstVillage100Day}.`);
  }
  if (Math.abs((lock.avgPortalSurvivors ?? Infinity) - TARGETS.portalSurvivorsPerSeed) > 3) {
    errors.push(`Sobreviventes no Portal fora da faixa: ${lock.avgPortalSurvivors}.`);
  }

  const pairs = pairRunsByProfile(runTable);
  const comparablePairs = [...pairs.values()].filter((entry) => entry.perfect && entry.lazy);
  if (comparablePairs.length === 0) {
    errors.push("Nao foi possivel comparar cenarios perfect vs lazy.");
  } else {
    const portalImproved = comparablePairs.filter((entry) => entry.perfect.portalSurvivors > entry.lazy.portalSurvivors).length;
    const d90Improved = comparablePairs.filter((entry) => entry.perfect.day90Eligible >= entry.lazy.day90Eligible).length;
    const first100Improved = comparablePairs.filter((entry) => entry.perfect.avgFirstVillage100Day <= entry.lazy.avgFirstVillage100Day).length;
    const avgPerfectPortal = avg(comparablePairs, (entry) => entry.perfect.portalSurvivors);
    const avgLazyPortal = avg(comparablePairs, (entry) => entry.lazy.portalSurvivors);

    if (!(avgPerfectPortal > avgLazyPortal)) {
      errors.push(`Perfect nao superou lazy em Portal na media: ${avgPerfectPortal} <= ${avgLazyPortal}.`);
    }
    if (portalImproved < 3) {
      errors.push(`Perfect superou lazy em Portal em apenas ${portalImproved}/4 perfis.`);
    }
    if (d90Improved < 3) {
      errors.push(`Perfect manteve/ganhou D90 elegivel em apenas ${d90Improved}/4 perfis.`);
    }
    if (first100Improved < 3) {
      errors.push(`Perfect antecipou a 1a aldeia 100/100 em apenas ${first100Improved}/4 perfis.`);
    }
  }

  if ((lock.avgReached2500 ?? 0) < 0.5) {
    warnings.push(`Poucos picos 2500 por seed: ${lock.avgReached2500}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function evaluateArtifacts(validationReport) {
  const errors = [];
  const warnings = [];

  if (!validationReport) {
    errors.push("Relatorio de validacao de artefatos nao encontrado.");
  } else {
    if (validationReport.status !== "PASS") {
      errors.push("Validacao de artefatos retornou FAIL.");
    }
    for (const error of validationReport.errors ?? []) {
      errors.push(error);
    }
    for (const warning of validationReport.warnings ?? []) {
      warnings.push(warning);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function evaluateRuntime() {
  const errors = [];
  const warnings = [];
  const expectedDayMs = (24 * 60 * 60 * 1000) / 120;
  const worldDataPath = path.join(ROOT_DIR, "lib", "world-data.ts");
  const worldData = fs.existsSync(worldDataPath) ? fs.readFileSync(worldDataPath, "utf8") : "";

  if (expectedDayMs !== 720000) {
    errors.push(`Formula de runtime inesperada: ${expectedDayMs}.`);
  }

  if (!worldData.includes("KINGSWORLD_RUNTIME_GAME_DAY_MS")) {
    errors.push("world-data.ts nao referencia KINGSWORLD_RUNTIME_GAME_DAY_MS.");
  }

  if (!worldData.includes("Math.floor((Date.now() - anchorStartedAtMs) / gameDayMs)")) {
    warnings.push("A verificacao estatica do runtime nao encontrou a formula esperada de progresso por dia.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function runSimulation() {
  const result = spawnSync(process.execPath, ["simulations/simulate-season-v2.mjs"], {
    cwd: ROOT_DIR,
    env: { ...process.env, SEED_MODE: "paired8" },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Falha ao executar a simulacao paired8.");
  }

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function main() {
  const simulation = runSimulation();
  const validationReport = fs.existsSync(VALIDATION_PATH) ? readJson(VALIDATION_PATH) : null;
  const results = fs.existsSync(RESULTS_PATH) ? readJson(RESULTS_PATH) : null;

  const artifacts = evaluateArtifacts(validationReport);
  const balance = evaluateBalance(results);
  const runtime = evaluateRuntime();
  const allErrors = [...artifacts.errors, ...balance.errors, ...runtime.errors];
  const allWarnings = [...artifacts.warnings, ...balance.warnings, ...runtime.warnings];
  const status = allErrors.length === 0 ? "PASS" : "FAIL";

  const report = {
    status,
    generatedAt: new Date().toISOString(),
    simulation: {
      mode: "paired8",
      stdout: simulation.stdout,
    },
    checks: {
      balance: balance.ok,
      artifacts: artifacts.ok,
      runtime: runtime.ok,
    },
    errors: allErrors,
    warnings: allWarnings,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(SMOKE_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (status !== "PASS") {
    process.exitCode = 1;
  }
}

main();
