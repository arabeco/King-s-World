import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "simulations", "output");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const MAIN_VALIDATION_PATH = path.join(OUTPUT_DIR, "season_v2_paired8_validation.json");
const AUDIT_VALIDATION_PATH = path.join(OUTPUT_DIR, "audit_validation.json");
const AUDIT_REPORT_PATH = path.join(REPORTS_DIR, "audit-season.json");

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runSimulationWithAudit() {
  const result = spawnSync(process.execPath, ["simulations/simulate-season-v2.mjs"], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      SEED_MODE: "paired8",
      GENERATE_AUDIT: "1",
      AUDIT_FAIL_ON_ERROR: "1",
    },
    encoding: "utf8",
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function main() {
  const execution = runSimulationWithAudit();
  const mainValidation = readJsonIfExists(MAIN_VALIDATION_PATH);
  const auditValidation = readJsonIfExists(AUDIT_VALIDATION_PATH);

  const errors = [];
  const warnings = [];

  if (execution.status !== 0) {
    errors.push(execution.stderr || execution.stdout || "A simulacao com auditoria falhou.");
  }

  if (!mainValidation) {
    errors.push("Relatorio principal de validacao nao encontrado.");
  } else {
    if (mainValidation.status !== "PASS") {
      errors.push("Validacao principal dos artefatos retornou FAIL.");
    }
    warnings.push(...(mainValidation.warnings ?? []));
  }

  if (!auditValidation) {
    errors.push("Relatorio de validacao da auditoria nao encontrado.");
  } else {
    if (auditValidation.status !== "PASS") {
      errors.push("Validacao estrutural da auditoria retornou FAIL.");
    }
    warnings.push(...(auditValidation.warnings ?? []));
  }

  const report = {
    status: errors.length === 0 ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    execution,
    checks: {
      simulation: execution.status === 0,
      mainArtifacts: mainValidation?.status === "PASS",
      auditArtifacts: auditValidation?.status === "PASS",
    },
    errors,
    warnings,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(AUDIT_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (report.status !== "PASS") {
    process.exitCode = 1;
  }
}

main();
