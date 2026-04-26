import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "simulations", "output");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const OUTPUT_BASENAME = "season_v2_paired8";
const VALIDATION_PATH = path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_validation.json`);
const RESULTS_PATH = path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_results.json`);
const REPORT_PATH = path.join(REPORTS_DIR, "smoke-balance.json");

const HARD_RULES = Object.freeze({
  days: 120,
  players: 50,
  influenceCap: 2500,
  portalCut: 1500,
  infrastructureCap: 1000,
  governmentCap: 500,
  militaryCap: 400,
  societyCap: 300,
  legacyCap: 300,
});

const BALANCE_WINDOWS = Object.freeze({
  secondVillageDay: { target: 15, tolerance: 2 },
  firstVillage100Day: { target: 45, tolerance: 5 },
  portalSurvivors: { min: 10, max: 22 },
  day90Eligible: { min: 15, max: 30 },
  reached2500: { min: 0.25, max: 2 },
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runSimulation() {
  const result = spawnSync(process.execPath, ["simulations/simulate-season-v2.mjs"], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      SEED_MODE: "paired8",
    },
    encoding: "utf8",
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function collectRecords(results) {
  return (results?.runsDetailed ?? []).flatMap((run) => run.records ?? []);
}

function checkEqual(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: esperado ${expected}, recebido ${actual}.`);
  }
}

function checkWindow(errors, label, actual, { min, max }) {
  if (typeof actual !== "number" || actual < min || actual > max) {
    errors.push(`${label}: esperado entre ${min} e ${max}, recebido ${actual}.`);
  }
}

function checkTarget(errors, label, actual, { target, tolerance }) {
  if (typeof actual !== "number" || Math.abs(actual - target) > tolerance) {
    errors.push(`${label}: alvo ${target} +/- ${tolerance}, recebido ${actual}.`);
  }
}

function checkMetadata(results) {
  const errors = [];
  const warnings = [];
  const metadata = results?.metadata ?? {};
  const world = metadata.world ?? {};
  const scoreWeights = metadata.scoreWeights ?? {};
  const scoreTotal = Object.values(scoreWeights).reduce((sum, value) => sum + Number(value || 0), 0);

  checkEqual(errors, "Duracao da campanha", world.days, HARD_RULES.days);
  checkEqual(errors, "Jogadores por mundo", world.players, HARD_RULES.players);
  checkEqual(errors, "Cap maximo de influencia", metadata.influenceCap, HARD_RULES.influenceCap);
  checkEqual(errors, "Corte do Portal", metadata.portalCut, HARD_RULES.portalCut);
  checkEqual(errors, "Infraestrutura maxima", scoreWeights.buildings, HARD_RULES.infrastructureCap);
  checkEqual(errors, "Governo maximo", scoreWeights.council, HARD_RULES.governmentCap);
  checkEqual(errors, "Militar maximo", scoreWeights.military, HARD_RULES.militaryCap);
  checkEqual(errors, "Sociedade maxima", scoreWeights.society, HARD_RULES.societyCap);
  checkEqual(errors, "Legado maximo", scoreWeights.legacy, HARD_RULES.legacyCap);
  checkEqual(errors, "Soma das fontes de influencia", scoreTotal, HARD_RULES.influenceCap);

  return { ok: errors.length === 0, errors, warnings };
}

function checkArtifacts(validation) {
  const errors = [];
  const warnings = [];

  if (!validation) {
    errors.push("Arquivo de validacao da simulacao nao encontrado.");
  } else {
    if (validation.status !== "PASS") {
      errors.push(`Validacao da simulacao retornou ${validation.status}.`);
    }
    errors.push(...(validation.errors ?? []));
    warnings.push(...(validation.warnings ?? []));
  }

  return { ok: errors.length === 0, errors, warnings };
}

function checkBalance(results) {
  const errors = [];
  const warnings = [];
  const lock = results?.lock ?? {};
  const records = collectRecords(results);
  const maxInfluenceObserved = records.reduce(
    (max, record) => Math.max(max, record.maxInfluenceObserved ?? record.influenceD120 ?? 0),
    0,
  );
  const recordsAboveCap = records.filter((record) => (record.maxInfluenceObserved ?? 0) > HARD_RULES.influenceCap);
  const recordsEnteringBelowCut = records.filter(
    (record) => record.enteredPortal && (record.influenceD120 ?? 0) < HARD_RULES.portalCut,
  );

  checkTarget(errors, "Dia medio da segunda cidade", lock.avgSecondVillageDay, BALANCE_WINDOWS.secondVillageDay);
  checkTarget(errors, "Dia medio da primeira cidade 100/100", lock.avgFirstVillage100Day, BALANCE_WINDOWS.firstVillage100Day);
  checkWindow(errors, "Sobreviventes medios no objetivo final", lock.avgPortalSurvivors, BALANCE_WINDOWS.portalSurvivors);
  checkWindow(errors, "Elegiveis medios no dia 90", lock.avgDay90Eligible, BALANCE_WINDOWS.day90Eligible);
  checkWindow(errors, "Picos medios em 2500", lock.avgReached2500, BALANCE_WINDOWS.reached2500);

  if (records.length === 0) {
    errors.push("Nenhum registro de jogador encontrado na simulacao.");
  }
  if (recordsAboveCap.length > 0) {
    errors.push(`${recordsAboveCap.length} jogadores passaram do cap ${HARD_RULES.influenceCap}.`);
  }
  if (recordsEnteringBelowCut.length > 0) {
    errors.push(`${recordsEnteringBelowCut.length} jogadores entraram no Portal abaixo de ${HARD_RULES.portalCut}.`);
  }
  if (maxInfluenceObserved < HARD_RULES.portalCut) {
    errors.push(`Nenhum jogador chegou perto do objetivo: maxInfluenceObserved=${maxInfluenceObserved}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      records: records.length,
      maxInfluenceObserved,
      avgSecondVillageDay: lock.avgSecondVillageDay,
      avgFirstVillage100Day: lock.avgFirstVillage100Day,
      avgPortalSurvivors: lock.avgPortalSurvivors,
      avgDay90Eligible: lock.avgDay90Eligible,
      avgReached2500: lock.avgReached2500,
    },
  };
}

function main() {
  const execution = runSimulation();
  const validation = fs.existsSync(VALIDATION_PATH) ? readJson(VALIDATION_PATH) : null;
  const results = fs.existsSync(RESULTS_PATH) ? readJson(RESULTS_PATH) : null;

  const executionErrors = execution.status === 0 ? [] : [execution.stderr || execution.stdout || "Simulacao falhou."];
  const artifacts = checkArtifacts(validation);
  const metadata = checkMetadata(results);
  const balance = checkBalance(results);
  const errors = [...executionErrors, ...artifacts.errors, ...metadata.errors, ...balance.errors];
  const warnings = [...artifacts.warnings, ...metadata.warnings, ...balance.warnings];
  const status = errors.length === 0 ? "PASS" : "FAIL";

  const report = {
    status,
    generatedAt: new Date().toISOString(),
    rules: HARD_RULES,
    windows: BALANCE_WINDOWS,
    checks: {
      execution: execution.status === 0,
      artifacts: artifacts.ok,
      metadata: metadata.ok,
      balance: balance.ok,
    },
    metrics: balance.metrics,
    errors,
    warnings,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (status !== "PASS") {
    process.exitCode = 1;
  }
}

main();
