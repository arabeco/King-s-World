const STRATEGY_IDS = ["metropole", "posto_avancado", "bastiao", "celeiro"];

const SECTION_TO_ID = Object.freeze({
  Metropole: "metropole",
  "Posto Avancado": "posto_avancado",
  Bastiao: "bastiao",
  Celeiro: "celeiro",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function splitMarkdownRow(row) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseNumber(input) {
  const normalized = String(input ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function extractMetaNumber(line) {
  const match = String(line ?? "").match(/D(\d+)/i);
  return match ? Number(match[1]) : NaN;
}

function extractSummary(line) {
  const [, summary = ""] = String(line ?? "").split(":");
  return summary.trim();
}

function containsInvalidToken(value) {
  return /(^|[^a-z])(NaN|undefined|null)([^a-z]|$)/i.test(String(value ?? ""));
}

function assertArtifactText(name, raw, report) {
  if (!String(raw ?? "").trim()) {
    report.errors.push(`${name}: artefato vazio.`);
    return;
  }

  if (containsInvalidToken(raw)) {
    report.errors.push(`${name}: contem token invalido (NaN/undefined/null).`);
  }
}

function scanForInvalidValues(value, path, report) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    report.errors.push(`${path}: numero nao finito.`);
    return;
  }

  if (value === undefined) {
    report.errors.push(`${path}: valor undefined.`);
    return;
  }

  if (typeof value === "string" && containsInvalidToken(value)) {
    report.errors.push(`${path}: texto contem token invalido.`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForInvalidValues(entry, `${path}[${index}]`, report));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    scanForInvalidValues(entry, `${path}.${key}`, report);
  }
}

export function parseExecutorSections(raw) {
  const sections = String(raw ?? "").split(/\r?\n## /).slice(1);
  const result = {};

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const heading = lines[0]?.trim() ?? "";
    const sectionName = heading.split(" - ")[0]?.trim();
    const id = SECTION_TO_ID[sectionName];
    if (!id) {
      continue;
    }

    const branchLine = lines.find((line) => line.startsWith("- Branch:")) ?? "";
    const secondVillageLine = lines.find((line) => line.startsWith("- 2a aldeia:")) ?? "";
    const firstHundredLine = lines.find((line) => line.startsWith("- 1a aldeia 100:")) ?? "";
    const day90Line = lines.find((line) => line.startsWith("- D90:")) ?? "";
    const day120Line = lines.find((line) => line.startsWith("- D120:")) ?? "";

    const days = [];
    const tableStart = lines.findIndex((line) => line.startsWith("| Dia |"));
    if (tableStart >= 0) {
      for (let index = tableStart + 2; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith("|")) {
          break;
        }

        const cells = splitMarkdownRow(line);
        if (cells.length < 7) {
          continue;
        }

        days.push({
          day: Number(cells[0]),
          influence: parseNumber(cells[1]),
          margin: parseNumber(cells[2]),
          villages: parseNumber(cells[3]),
          troopsLabel: cells[4],
          actions: cells[5].split(" + ").map((entry) => entry.trim()).filter(Boolean),
          priorities: [],
          milestone: cells[6],
        });
      }
    }

    result[id] = {
      branch: extractSummary(branchLine),
      secondVillageDay: extractMetaNumber(secondVillageLine),
      firstHundredDay: extractMetaNumber(firstHundredLine),
      day90Summary: extractSummary(day90Line),
      day120Summary: extractSummary(day120Line),
      days,
    };
  }

  return result;
}

export function parsePlaybookPriorities(raw) {
  const sections = String(raw ?? "").split(/\r?\n## /).slice(1);
  const result = {};

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const heading = lines[0]?.trim() ?? "";
    const sectionName = heading.split(" - ")[0]?.trim();
    const id = SECTION_TO_ID[sectionName];
    if (!id) {
      continue;
    }

    const prioritiesByDay = {};
    const tableStart = lines.findIndex((line) => line.startsWith("| Dia |"));
    if (tableStart >= 0) {
      for (let index = tableStart + 2; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith("|")) {
          break;
        }

        const cells = splitMarkdownRow(line);
        if (cells.length < 9) {
          continue;
        }

        prioritiesByDay[Number(cells[0])] = [cells[5], cells[6], cells[7]]
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
    }

    result[id] = prioritiesByDay;
  }

  return result;
}

export function buildNormalizedPlaybooks(executorRaw, playbookRaw) {
  const executor = parseExecutorSections(executorRaw);
  const priorities = parsePlaybookPriorities(playbookRaw);
  const playbooks = {};

  for (const strategyId of STRATEGY_IDS) {
    const executorSection = executor[strategyId] ?? {
      branch: "",
      secondVillageDay: NaN,
      firstHundredDay: NaN,
      day90Summary: "",
      day120Summary: "",
      days: [],
    };

    playbooks[strategyId] = {
      branch: executorSection.branch,
      secondVillageDay: executorSection.secondVillageDay,
      firstHundredDay: executorSection.firstHundredDay,
      day90Summary: executorSection.day90Summary,
      day120Summary: executorSection.day120Summary,
      days: executorSection.days.map((day) => ({
        ...day,
        priorities: priorities[strategyId]?.[day.day] ?? [],
      })),
    };
  }

  return { playbooks };
}

export function validateNormalizedPlaybooks(bundle, report) {
  if (!isPlainObject(bundle?.playbooks)) {
    report.errors.push("playbooks: estrutura ausente.");
    return;
  }

  for (const strategyId of STRATEGY_IDS) {
    const playbook = bundle.playbooks[strategyId];
    if (!playbook) {
      report.errors.push(`playbooks.${strategyId}: ausente.`);
      continue;
    }

    if (!String(playbook.branch ?? "").trim()) {
      report.errors.push(`playbooks.${strategyId}.branch: vazio.`);
    }

    if (!Number.isFinite(playbook.secondVillageDay) || playbook.secondVillageDay < 1 || playbook.secondVillageDay > 120) {
      report.errors.push(`playbooks.${strategyId}.secondVillageDay: invalido.`);
    }

    if (!Number.isFinite(playbook.firstHundredDay) || playbook.firstHundredDay < 1 || playbook.firstHundredDay > 120) {
      report.errors.push(`playbooks.${strategyId}.firstHundredDay: invalido.`);
    }

    if (!Array.isArray(playbook.days) || playbook.days.length === 0) {
      report.errors.push(`playbooks.${strategyId}.days: vazio.`);
      continue;
    }

    if (playbook.days.length < 100) {
      report.warnings.push(`playbooks.${strategyId}.days: cobertura incompleta (${playbook.days.length} dias).`);
    }

    playbook.days.forEach((dayPlan, index) => {
      const prefix = `playbooks.${strategyId}.days[${index}]`;
      if (!Number.isFinite(dayPlan.day) || dayPlan.day < 1 || dayPlan.day > 120) {
        report.errors.push(`${prefix}.day: invalido.`);
      }
      if (index > 0 && dayPlan.day !== playbook.days[index - 1].day + 1) {
        report.warnings.push(`${prefix}.day: sequencia de dias nao continua sem salto.`);
      }
      if (!Number.isFinite(dayPlan.influence) || dayPlan.influence < 0) {
        report.errors.push(`${prefix}.influence: invalido.`);
      }
      if (!Number.isFinite(dayPlan.margin)) {
        report.errors.push(`${prefix}.margin: invalido.`);
      }
      if (!Number.isFinite(dayPlan.villages) || dayPlan.villages < 1 || dayPlan.villages > 10) {
        report.errors.push(`${prefix}.villages: invalido.`);
      }
      if (!String(dayPlan.troopsLabel ?? "").trim()) {
        report.errors.push(`${prefix}.troopsLabel: vazio.`);
      }
      if (containsInvalidToken(dayPlan.troopsLabel)) {
        report.errors.push(`${prefix}.troopsLabel: contem token invalido.`);
      }
      if (!Array.isArray(dayPlan.actions) || dayPlan.actions.length === 0) {
        report.errors.push(`${prefix}.actions: vazio.`);
      }
      if (!String(dayPlan.milestone ?? "").trim()) {
        report.errors.push(`${prefix}.milestone: vazio.`);
      }
      scanForInvalidValues(dayPlan, prefix, report);
    });
  }
}

export function validateSimulationArtifacts({
  outputBasename,
  results,
  reportMarkdown,
  dailyPlaybookMarkdown,
  dailyExecutorMarkdown,
  normalizedPlaybooks,
}) {
  const report = {
    status: "PASS",
    outputBasename,
    generatedAt: new Date().toISOString(),
    errors: [],
    warnings: [],
  };

  assertArtifactText("report", reportMarkdown, report);
  assertArtifactText("daily_playbooks", dailyPlaybookMarkdown, report);
  assertArtifactText("daily_executor", dailyExecutorMarkdown, report);
  scanForInvalidValues(results, "results", report);
  validateNormalizedPlaybooks(normalizedPlaybooks, report);

  if (!Array.isArray(results?.runTable) || results.runTable.length === 0) {
    report.errors.push("results.runTable: vazio.");
  }

  if (!Array.isArray(results?.runsDetailed) || results.runsDetailed.length === 0) {
    report.errors.push("results.runsDetailed: vazio.");
  }

  report.status = report.errors.length > 0 ? "FAIL" : "PASS";
  return report;
}
