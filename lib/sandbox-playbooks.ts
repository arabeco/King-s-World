import "server-only";

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

export type SandboxStrategyId = "metropole" | "posto_avancado" | "bastiao" | "celeiro";

export type SandboxArtifactStatus = "PASS" | "FAIL";

export type SandboxStrategyMeta = {
  id: SandboxStrategyId;
  label: string;
  tagline: string;
  benefit: string;
  risk: string;
  bestFor: string;
  openingGoal: string;
};

export type SandboxDayPlan = {
  day: number;
  influence: number;
  margin: number;
  villages: number;
  troopsLabel: string;
  actions: string[];
  priorities: string[];
  milestone: string;
};

export type SandboxStrategyPlaybook = {
  meta: SandboxStrategyMeta;
  branch: string;
  secondVillageDay: number;
  firstHundredDay: number;
  day90Summary: string;
  day120Summary: string;
  days: SandboxDayPlan[];
};

export type SandboxArtifactValidationReport = {
  status: SandboxArtifactStatus;
  outputBasename: string;
  generatedAt: string;
  errors: string[];
  warnings: string[];
};

export type SandboxPlaybookLoadResult =
  | {
      status: "ready";
      report: SandboxArtifactValidationReport;
      playbooks: Record<SandboxStrategyId, SandboxStrategyPlaybook>;
    }
  | {
      status: "unavailable";
      report: SandboxArtifactValidationReport | null;
      errors: string[];
      warnings: string[];
    };

type SerializedSandboxPlaybook = Omit<SandboxStrategyPlaybook, "meta">;

type SerializedSandboxPlaybookBundle = {
  generatedAt: string;
  outputBasename: string;
  status: SandboxArtifactStatus;
  playbooks: Partial<Record<SandboxStrategyId, SerializedSandboxPlaybook>>;
};

const PLAYBOOKS_JSON_PATH = path.join(process.cwd(), "simulations", "output", "season_v2_paired8_playbooks.json");
const VALIDATION_PATH = path.join(process.cwd(), "simulations", "output", "season_v2_paired8_validation.json");
const STRATEGY_IDS: SandboxStrategyId[] = ["metropole", "posto_avancado", "bastiao", "celeiro"];

const STRATEGY_META: Record<SandboxStrategyId, SandboxStrategyMeta> = {
  metropole: {
    id: "metropole",
    label: "Metropole",
    tagline: "Capital monstruosa, conselho forte e corrida cedo para Maravilhas.",
    benefit: "Escala muito bem em influencia e fecha score alto no late game.",
    risk: "Se atrasar a 2a aldeia ou o 100/100, a build fica linda, mas lenta demais.",
    bestFor: "Quem quer jogar de forma economica, organizada e com teto alto de score.",
    openingGoal: "Fechar Minas, Fazendas, Palacio e Senado sem desperdiçar recurso e abrir a 2a aldeia cedo.",
  },
  posto_avancado: {
    id: "posto_avancado",
    label: "Posto Avancado",
    tagline: "Pressao de mapa, militar forte e expansao puxada por agressao.",
    benefit: "Ganha ritmo cedo no mapa e converte combate em territorio e tempo.",
    risk: "Se gastar demais em tropa e esquecer economia, o impeto morre no mid game.",
    bestFor: "Quem gosta de atacar, patrulhar, pressionar e crescer no mapa.",
    openingGoal: "Abrir Quartel e Arsenal cedo sem matar a economia basica da Capital.",
  },
  bastiao: {
    id: "bastiao",
    label: "Bastiao",
    tagline: "Defesa robusta, seguranca de aldeia e reta final mais estavel.",
    benefit: "Sofre menos na pressao de hordas e costuma manter mais aldeias vivas.",
    risk: "Pode atrasar expansao e score se voce se apaixonar demais pela muralha.",
    bestFor: "Quem prefere margem de erro maior, defesa e campanha mais segura.",
    openingGoal: "Subir base economica e muralha sem travar a 2a aldeia.",
  },
  celeiro: {
    id: "celeiro",
    label: "Celeiro",
    tagline: "Fluxo interno, doacao entre aldeias e corrida de ETA no endgame.",
    benefit: "Acelera o impeto do imperio e corrige distancia com boa logistica.",
    risk: "Se voce nao doar recurso direito, fica rico no papel e lento na pratica.",
    bestFor: "Quem gosta de microgerenciar recursos e brincar de rede logistica.",
    openingGoal: "Abrir Fazendas e Habitacoes cedo, acelerar a 2a aldeia e preparar cadeia de doacao.",
  },
};

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function containsInvalidToken(value: string): boolean {
  return /(^|[^a-z])(NaN|undefined|null)([^a-z]|$)/i.test(value);
}

function normalizeDayPlan(raw: unknown): SandboxDayPlan | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const entry = raw as Partial<SandboxDayPlan>;
  const day = Number(entry.day);
  const influence = Number(entry.influence);
  const margin = Number(entry.margin);
  const villages = Number(entry.villages);
  const troopsLabel = String(entry.troopsLabel ?? "").trim();
  const milestone = String(entry.milestone ?? "").trim();
  const actions = normalizeStringArray(entry.actions);
  const priorities = normalizeStringArray(entry.priorities);

  if (!isFiniteNumber(day) || day < 1 || day > 120) return null;
  if (!isFiniteNumber(influence) || influence < 0) return null;
  if (!isFiniteNumber(margin)) return null;
  if (!isFiniteNumber(villages) || villages < 1 || villages > 10) return null;
  if (!troopsLabel || containsInvalidToken(troopsLabel)) return null;
  if (!milestone || containsInvalidToken(milestone)) return null;
  if (actions.length === 0 || actions.some(containsInvalidToken)) return null;
  if (priorities.some(containsInvalidToken)) return null;

  return {
    day,
    influence,
    margin,
    villages,
    troopsLabel,
    actions,
    priorities,
    milestone,
  };
}

function normalizeSerializedPlaybook(raw: unknown, strategyId: SandboxStrategyId): SandboxStrategyPlaybook | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const playbook = raw as Partial<SerializedSandboxPlaybook>;
  const branch = String(playbook.branch ?? "").trim();
  const secondVillageDay = Number(playbook.secondVillageDay);
  const firstHundredDay = Number(playbook.firstHundredDay);
  const day90Summary = String(playbook.day90Summary ?? "").trim();
  const day120Summary = String(playbook.day120Summary ?? "").trim();
  const days = Array.isArray(playbook.days) ? playbook.days.map((entry) => normalizeDayPlan(entry)).filter(Boolean) as SandboxDayPlan[] : [];

  if (!branch || containsInvalidToken(branch)) return null;
  if (!isFiniteNumber(secondVillageDay) || secondVillageDay < 1 || secondVillageDay > 120) return null;
  if (!isFiniteNumber(firstHundredDay) || firstHundredDay < 1 || firstHundredDay > 120) return null;
  if (!day90Summary || containsInvalidToken(day90Summary)) return null;
  if (!day120Summary || containsInvalidToken(day120Summary)) return null;
  if (days.length === 0) return null;

  return {
    meta: STRATEGY_META[strategyId],
    branch,
    secondVillageDay,
    firstHundredDay,
    day90Summary,
    day120Summary,
    days,
  };
}

function normalizeValidationReport(raw: unknown): SandboxArtifactValidationReport | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const report = raw as Partial<SandboxArtifactValidationReport>;
  const status = report.status === "PASS" || report.status === "FAIL" ? report.status : null;
  if (!status) {
    return null;
  }

  return {
    status,
    outputBasename: String(report.outputBasename ?? ""),
    generatedAt: String(report.generatedAt ?? ""),
    errors: normalizeStringArray(report.errors),
    warnings: normalizeStringArray(report.warnings),
  };
}

export const getSandboxPlaybookBundle = cache((): SandboxPlaybookLoadResult => {
  const report = normalizeValidationReport(readJsonIfExists<SandboxArtifactValidationReport>(VALIDATION_PATH));
  if (!report) {
    return {
      status: "unavailable",
      report: null,
      errors: ["Relatorio de validacao dos playbooks nao foi encontrado ou esta invalido."],
      warnings: [],
    };
  }

  if (report.status !== "PASS") {
    return {
      status: "unavailable",
      report,
      errors: report.errors.length > 0 ? report.errors : ["Os artefatos da temporada falharam na validacao automatica."],
      warnings: report.warnings,
    };
  }

  const bundle = readJsonIfExists<SerializedSandboxPlaybookBundle>(PLAYBOOKS_JSON_PATH);
  if (!bundle || bundle.status !== "PASS") {
    return {
      status: "unavailable",
      report,
      errors: ["Bundle normalizado de playbooks nao foi encontrado ou nao esta aprovado."],
      warnings: report.warnings,
    };
  }

  const playbooks = Object.fromEntries(
    STRATEGY_IDS.map((strategyId) => [strategyId, normalizeSerializedPlaybook(bundle.playbooks?.[strategyId], strategyId)]),
  ) as Record<SandboxStrategyId, SandboxStrategyPlaybook | null>;

  const missing = STRATEGY_IDS.filter((strategyId) => !playbooks[strategyId]);
  if (missing.length > 0) {
    return {
      status: "unavailable",
      report,
      errors: [`Playbooks normalizados invalidos para: ${missing.join(", ")}.`],
      warnings: report.warnings,
    };
  }

  return {
    status: "ready",
    report,
    playbooks: playbooks as Record<SandboxStrategyId, SandboxStrategyPlaybook>,
  };
});

export const getSandboxPlaybooks = cache((): Record<SandboxStrategyId, SandboxStrategyPlaybook> | null => {
  const result = getSandboxPlaybookBundle();
  return result.status === "ready" ? result.playbooks : null;
});
