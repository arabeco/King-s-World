import rawAudit from "@/simulations/output/timeline_full.json";

type CheckpointSummary = {
  economy: string;
  expansion: string;
  military: string;
  influence: string;
  finalRisk: string;
  collapseReasons: string[];
  oneLine: string;
};

type VisualMilestone = {
  key: string;
  title: string;
  detail: string;
  priority: number;
};

type MilestoneDay = {
  day: number;
  checkpointSummary: CheckpointSummary;
  visualMilestones?: VisualMilestone[];
};

type RunAudit = {
  scenarioId: string;
  focusProfile: string;
  representative: {
    result: "entered_portal" | "failed";
    outcomeReason: string;
  };
  milestoneDays: MilestoneDay[];
  dailyTimeline: Array<{
    day: number;
    visualMilestones?: VisualMilestone[];
  }>;
};

type TimelineFullAudit = {
  runs: RunAudit[];
};

export type ProfileHealthCard = {
  profile: string;
  healthy: string[];
  strange: string[];
  breakPoint: string;
  breakDay: number | null;
};

const audit = rawAudit as TimelineFullAudit;

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function formatProfileLabel(profile: string): string {
  if (profile === "metropole") return "Metropole";
  if (profile === "posto") return "Posto Avancado";
  if (profile === "bastiao") return "Bastiao";
  if (profile === "celeiro") return "Celeiro";
  return profile;
}

function findRun(profile: string, suffix: string): RunAudit | null {
  return audit.runs.find((run) => run.focusProfile === profile && run.scenarioId.endsWith(suffix)) ?? null;
}

function firstBreakingCheckpoint(run: RunAudit | null): MilestoneDay | null {
  if (!run) return null;
  return (
    run.milestoneDays.find((day) => {
      const summary = day.checkpointSummary;
      return summary.finalRisk === "alto" || summary.collapseReasons.length > 0 || summary.economy === "colapsando" || summary.military === "critico";
    }) ?? null
  );
}

function milestoneTitles(run: RunAudit | null): string[] {
  if (!run) return [];
  return dedupe(run.dailyTimeline.flatMap((day) => day.visualMilestones?.map((entry) => entry.title) ?? []));
}

function buildHealthySignals(perfectRun: RunAudit | null): string[] {
  if (!perfectRun) return ["Sem run representativa perfeita disponível."];

  const milestones = milestoneTitles(perfectRun);
  const d30 = perfectRun.milestoneDays.find((day) => day.day === 30);
  const d90 = perfectRun.milestoneDays.find((day) => day.day === 90);
  const d120 = perfectRun.milestoneDays.find((day) => day.day === 120);
  const healthy = [];

  if (milestones.includes("2a aldeia fundada")) healthy.push("Abertura fecha a 2a aldeia no ritmo esperado.");
  if (milestones.includes("1a aldeia 100/100")) healthy.push("A run alcança a 1a aldeia 100/100 dentro da trilha vencedora.");
  if (d30?.checkpointSummary.expansion !== "lenta") healthy.push(`Expansão até D30 está ${d30?.checkpointSummary.expansion}.`);
  if (d90?.checkpointSummary.influence !== "abaixo da curva esperada") healthy.push(`Influência no D90 está ${d90?.checkpointSummary.influence}.`);
  if (milestones.includes("Gate do Portal")) healthy.push("O gate do Portal aparece antes do fechamento final.");
  if (perfectRun.representative.result === "entered_portal" && d120?.checkpointSummary.finalRisk !== "alto") {
    healthy.push("A run vencedora fecha o endgame sem sinal estrutural de colapso.");
  }

  return dedupe(healthy).slice(0, 4);
}

function buildStrangeSignals(lazyRun: RunAudit | null): string[] {
  if (!lazyRun) return ["Sem run problemática representativa disponível."];

  const strange = [];
  for (const milestone of lazyRun.milestoneDays) {
    if (milestone.checkpointSummary.collapseReasons.length > 0) {
      strange.push(...milestone.checkpointSummary.collapseReasons);
    }
    if (milestone.checkpointSummary.economy === "colapsando") {
      strange.push(`Economia colapsando em D${milestone.day}.`);
    }
    if (milestone.checkpointSummary.military === "critico") {
      strange.push(`Militar crítico em D${milestone.day}.`);
    }
    if (milestone.checkpointSummary.influence === "abaixo da curva esperada") {
      strange.push(`Influência abaixo da curva esperada em D${milestone.day}.`);
    }
    if (milestone.checkpointSummary.finalRisk === "alto") {
      strange.push(`Risco final alto em D${milestone.day}.`);
    }
  }

  if (lazyRun.representative.result === "failed") {
    strange.push(lazyRun.representative.outcomeReason);
  }

  return dedupe(strange).slice(0, 5);
}

function buildBreakPoint(lazyRun: RunAudit | null): { breakPoint: string; breakDay: number | null } {
  const checkpoint = firstBreakingCheckpoint(lazyRun);
  if (!checkpoint) {
    return {
      breakPoint: lazyRun?.representative.outcomeReason ?? "Sem quebra explícita detectada.",
      breakDay: null,
    };
  }

  const collapse = checkpoint.checkpointSummary.collapseReasons[0];
  const summary = checkpoint.checkpointSummary.oneLine;
  return {
    breakPoint: collapse ? `${collapse} (${summary})` : summary,
    breakDay: checkpoint.day,
  };
}

const profiles = ["metropole", "posto", "bastiao", "celeiro"];

export const seasonAuditAnalytics = {
  profileHealth: profiles.map((profile): ProfileHealthCard => {
    const perfectRun = findRun(profile, "perfect");
    const lazyRun = findRun(profile, "lazy");
    const breakPoint = buildBreakPoint(lazyRun);

    return {
      profile: formatProfileLabel(profile),
      healthy: buildHealthySignals(perfectRun),
      strange: buildStrangeSignals(lazyRun),
      breakPoint: breakPoint.breakPoint,
      breakDay: breakPoint.breakDay,
    };
  }),
};
