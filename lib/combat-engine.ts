export type CombatUnitId =
  | "militia"
  | "shooters"
  | "scouts"
  | "machinery"
  | "guards"
  | "archers"
  | "ballistae";

export type CombatArmy = Partial<Record<CombatUnitId, number>>;
export type CombatResources = Record<string, number>;

export type CombatBuildContext = {
  wallLevel?: number;
  attackerHeroPower?: number;
  defenderHeroPower?: number;
  attackerMilitaryBuildBonus?: number;
  defenderMilitaryBuildBonus?: number;
  defenderSatisfaction?: number;
  defenderMilitaryScoreAtual?: number;
  militaryScoreAtual?: number;
  militaryScoreCap?: number;
  maxRounds?: number;
  lootableResourceKeys?: string[];
  defenderLocalForces?: CombatArmy;
  defenderImperialResponseForces?: CombatArmy;
  defenderResponseReadiness?: number;
  defenderResponseWindowLabel?: string;
};

export type CombatInput = {
  atacante: CombatArmy;
  defensor: CombatArmy;
  recursosDefensor: CombatResources;
  contexto?: CombatBuildContext;
};

export type CombatLossSummary = {
  atacante: {
    mortos: CombatArmy;
    fugiram: CombatArmy;
  };
  defensor: {
    mortos: CombatArmy;
    fugiram: CombatArmy;
  };
};

export type CombatRoundSummary = {
  round: number;
  poderAtaque: number;
  poderDefesa: number;
  perdasAtacante: CombatArmy;
  perdasDefensor: CombatArmy;
};

export type CombatResult = {
  vencedor: "atacante" | "defensor" | "retirada";
  decisivo: boolean;
  rounds: CombatRoundSummary[];
  resumoPerdas: CombatLossSummary;
  recursosSaqueados: CombatResources;
  impactoSatisfacao: number;
  scoreMilitarAtacanteFinal: number;
  scoreMilitarDefensorFinal: number;
  scoreMilitarFinal: number;
  scoreMilitarAtacanteBruto: number;
  scoreMilitarDefensorBruto: number;
  scoreMilitarBruto: number;
  scoreMilitarAtacanteCapRestante: number;
  scoreMilitarDefensorCapRestante: number;
  scoreMilitarCapRestante: number;
  leitura: {
    danoDefensorPct: number;
    danoAtacantePct: number;
    equilibrioBatalha: number;
    defesaQuebrada: boolean;
  };
  battleReport: {
    attackerTotal: number;
    defenderTotal: number;
    defenderLocalTotal: number;
    defenderImperialResponseTotal: number;
    defenderResponseReadiness: number;
    defenderResponseWindowLabel: string;
    outcomeLabel: string;
    headline: string;
    summary: string;
  };
};

type UnitStats = {
  attack: number;
  defense: number;
  weight: number;
  carry: number;
};

const UNIT_STATS: Record<CombatUnitId, UnitStats> = {
  militia: { attack: 10, defense: 12, weight: 1, carry: 5 },
  shooters: { attack: 16, defense: 9, weight: 1.35, carry: 4 },
  scouts: { attack: 8, defense: 7, weight: 1.2, carry: 8 },
  machinery: { attack: 38, defense: 22, weight: 3.4, carry: 2 },
  guards: { attack: 6, defense: 15, weight: 1.1, carry: 0 },
  archers: { attack: 13, defense: 18, weight: 1.45, carry: 0 },
  ballistae: { attack: 24, defense: 42, weight: 3.7, carry: 0 },
};

const UNIT_ORDER: CombatUnitId[] = ["militia", "shooters", "scouts", "machinery", "guards", "archers", "ballistae"];
const DEFAULT_LOOTABLE_RESOURCES = ["materials", "supplies", "wood", "iron", "stone", "food"];
const DEFAULT_MILITARY_SCORE_CAP = 300;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function normalizeCount(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function normalizeArmy(army: CombatArmy): Required<CombatArmy> {
  return {
    militia: normalizeCount(army.militia),
    shooters: normalizeCount(army.shooters),
    scouts: normalizeCount(army.scouts),
    machinery: normalizeCount(army.machinery),
    guards: normalizeCount(army.guards),
    archers: normalizeCount(army.archers),
    ballistae: normalizeCount(army.ballistae),
  };
}

function emptyArmy(): Required<CombatArmy> {
  return normalizeArmy({});
}

function compactArmy(army: CombatArmy): CombatArmy {
  const next: CombatArmy = {};
  for (const unit of UNIT_ORDER) {
    const value = normalizeCount(army[unit]);
    if (value > 0) {
      next[unit] = value;
    }
  }
  return next;
}

function sumArmy(army: CombatArmy): number {
  return UNIT_ORDER.reduce((sum, unit) => sum + normalizeCount(army[unit]), 0);
}

function formatResponseWindow(readiness: number, explicit?: string): string {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }
  if (readiness >= 0.62) return "resposta imediata";
  if (readiness >= 0.4) return "resposta limitada";
  return "resposta tardia";
}

function weightedArmyValue(army: CombatArmy, key: keyof UnitStats): number {
  return UNIT_ORDER.reduce((sum, unit) => sum + normalizeCount(army[unit]) * UNIT_STATS[unit][key], 0);
}

function casualtyWeight(unit: CombatUnitId, defenderSide: boolean): number {
  const base = UNIT_STATS[unit].weight;
  if (!defenderSide) return base;
  if (unit === "guards" || unit === "archers" || unit === "ballistae") return base * 1.1;
  return base;
}

function applyLossesByWeight(army: Required<CombatArmy>, totalLosses: number, defenderSide: boolean): CombatArmy {
  const deaths = emptyArmy();
  let remaining = clamp(round(totalLosses), 0, sumArmy(army));

  while (remaining > 0) {
    const candidates = UNIT_ORDER
      .filter((unit) => army[unit] - deaths[unit] > 0)
      .map((unit) => ({
        unit,
        pressure: (army[unit] - deaths[unit]) * casualtyWeight(unit, defenderSide),
      }))
      .sort((left, right) => right.pressure - left.pressure);

    const target = candidates[0]?.unit;
    if (!target) break;

    deaths[target] += 1;
    remaining -= 1;
  }

  for (const unit of UNIT_ORDER) {
    army[unit] = Math.max(0, army[unit] - deaths[unit]);
  }

  return compactArmy(deaths);
}

function addArmy(into: Required<CombatArmy>, delta: CombatArmy): void {
  for (const unit of UNIT_ORDER) {
    into[unit] += normalizeCount(delta[unit]);
  }
}

function mergeDeadWeight(army: CombatArmy): number {
  return UNIT_ORDER.reduce((sum, unit) => sum + normalizeCount(army[unit]) * casualtyWeight(unit, unit === "guards" || unit === "archers" || unit === "ballistae"), 0);
}

function calculatePower(army: CombatArmy, mode: "attack" | "defense"): number {
  return weightedArmyValue(army, mode);
}

function calculateLootCapacity(army: CombatArmy): number {
  return UNIT_ORDER.reduce((sum, unit) => sum + normalizeCount(army[unit]) * UNIT_STATS[unit].carry, 0);
}

function calculateWallPower(wallLevel: number): number {
  const level = clamp(Math.floor(wallLevel), 0, 10);
  return level * 42 + (level >= 7 ? 90 : 0) + (level >= 10 ? 140 : 0);
}

function buildMultiplier(raw: number | undefined): number {
  return clamp(1 + (Number(raw) || 0), 0.65, 1.75);
}

function heroMultiplier(raw: number | undefined): number {
  return clamp(1 + clamp(Number(raw) || 0, 0, 100) / 250, 1, 1.4);
}

function satisfactionDefenseMultiplier(raw: number | undefined): number {
  const satisfaction = clamp(Number(raw) || 0, 0, 100);
  return clamp(0.82 + satisfaction / 500, 0.82, 1.02);
}

function resourceKeys(resources: CombatResources, explicit?: string[]): string[] {
  const allowed = new Set((explicit && explicit.length > 0 ? explicit : DEFAULT_LOOTABLE_RESOURCES).map((key) => key.toLowerCase()));
  return Object.keys(resources).filter((key) => allowed.has(key.toLowerCase()));
}

function calculateLoot(input: {
  resources: CombatResources;
  survivorAttackers: CombatArmy;
  defenderDamageRatio: number;
  wallLevel: number;
  success: boolean;
  lootableResourceKeys?: string[];
}): CombatResources {
  if (!input.success) return {};

  const totalResources = resourceKeys(input.resources, input.lootableResourceKeys).reduce(
    (sum, key) => sum + Math.max(0, Number(input.resources[key]) || 0),
    0,
  );
  if (totalResources <= 0) return {};

  const capacity = calculateLootCapacity(input.survivorAttackers);
  const wallProtection = clamp(1 - input.wallLevel * 0.035, 0.52, 1);
  const lootRatio = clamp(0.08 + input.defenderDamageRatio * 0.18, 0.06, 0.26) * wallProtection;
  const lootBudget = Math.min(capacity, totalResources * lootRatio);

  const saque: CombatResources = {};
  for (const key of resourceKeys(input.resources, input.lootableResourceKeys)) {
    const available = Math.max(0, Number(input.resources[key]) || 0);
    saque[key] = round(Math.min(available, lootBudget * (available / totalResources)));
  }

  return saque;
}

function calculateSatisfactionImpact(input: {
  defenderDamageRatio: number;
  attackerSuccess: boolean;
  wallLevel: number;
  defenderDeadWeight: number;
}): number {
  const breachShock = input.attackerSuccess ? 4 : 0;
  const wallShock = input.wallLevel >= 7 && input.defenderDamageRatio >= 0.35 ? 2 : 0;
  const bodyShock = clamp(input.defenderDeadWeight / 55, 0, 8);
  return round(clamp(input.defenderDamageRatio * 14 + bodyShock + breachShock + wallShock, 0, 22));
}

function calculateMilitaryScore(input: {
  attackerDeadWeight: number;
  defenderDeadWeight: number;
  initialAttackPower: number;
  initialDefensePower: number;
  wallLevel: number;
  attackerHeroPower: number;
  defenderHeroPower: number;
  decisive: boolean;
  perspective: "attacker" | "defender";
  currentScore: number;
  cap: number;
}): { final: number; raw: number; capRestante: number; balance: number } {
  const totalPower = Math.max(1, input.initialAttackPower + input.initialDefensePower);
  const closeness = 1 - Math.abs(input.initialAttackPower - input.initialDefensePower) / totalPower;
  const underdog = input.initialAttackPower < input.initialDefensePower ? 1.12 : 1;
  const wallDifficulty = 1 + clamp(input.wallLevel, 0, 10) * 0.025;
  const heroDifficulty = 1 + clamp(input.defenderHeroPower - input.attackerHeroPower, -60, 80) / 420;
  const battleBalance = clamp(0.78 + closeness * 0.42, 0.78, 1.2);
  const attackerQuality = clamp(battleBalance * underdog * wallDifficulty * heroDifficulty, 0.55, 1.55);
  const defenderUnderdog = input.initialDefensePower < input.initialAttackPower ? 1.1 : 1;
  const defenderHoldBonus = input.decisive ? 0 : 7;
  const defenderQuality = clamp(
    battleBalance *
      defenderUnderdog *
      (1 + clamp(input.wallLevel, 0, 10) * 0.018) *
      (1 + clamp(input.attackerHeroPower - input.defenderHeroPower, -60, 80) / 460),
    0.55,
    1.5,
  );

  const raw =
    input.perspective === "attacker"
      ? (input.defenderDeadWeight * 0.42 + input.attackerDeadWeight * 0.16 + (input.decisive ? 8 : 0)) * attackerQuality
      : (input.attackerDeadWeight * 0.38 + input.defenderDeadWeight * 0.12 + defenderHoldBonus) * defenderQuality;
  const capRestante = Math.max(0, input.cap - input.currentScore);
  const final = clamp(round(raw * (input.perspective === "attacker" ? 0.22 : 0.2)), 0, capRestante);

  return {
    final,
    raw: round(raw * 100) / 100,
    capRestante,
    balance: round(battleBalance * 100) / 100,
  };
}

export function processKingsWorldCombat(input: CombatInput): CombatResult {
  const contexto = input.contexto ?? {};
  const maxRounds = clamp(Math.floor(contexto.maxRounds ?? 5), 1, 12);
  const wallLevel = clamp(Math.floor(contexto.wallLevel ?? 0), 0, 10);
  const militaryScoreCap = Math.max(1, Math.floor(contexto.militaryScoreCap ?? DEFAULT_MILITARY_SCORE_CAP));
  const militaryScoreAtual = clamp(Math.floor(contexto.militaryScoreAtual ?? 0), 0, militaryScoreCap);
  const defenderMilitaryScoreAtual = clamp(Math.floor(contexto.defenderMilitaryScoreAtual ?? 0), 0, militaryScoreCap);

  const attackers = normalizeArmy(input.atacante);
  const defenders = normalizeArmy(input.defensor);
  const defenderLocalForces = normalizeArmy(contexto.defenderLocalForces ?? input.defensor);
  const defenderImperialResponseForces = normalizeArmy(contexto.defenderImperialResponseForces ?? {});
  const defenderLocalTotal = sumArmy(defenderLocalForces);
  const defenderImperialResponseTotal = sumArmy(defenderImperialResponseForces);
  const defenderResponseReadiness = clamp(Number(contexto.defenderResponseReadiness) || 0, 0, 1);
  const defenderResponseWindowLabel = formatResponseWindow(defenderResponseReadiness, contexto.defenderResponseWindowLabel);
  const attackerDeaths = emptyArmy();
  const defenderDeaths = emptyArmy();
  const rounds: CombatRoundSummary[] = [];

  const initialAttackPower =
    calculatePower(attackers, "attack") *
    buildMultiplier(contexto.attackerMilitaryBuildBonus) *
    heroMultiplier(contexto.attackerHeroPower);
  const initialDefensePower =
    (calculatePower(defenders, "defense") + calculateWallPower(wallLevel)) *
    buildMultiplier(contexto.defenderMilitaryBuildBonus) *
    heroMultiplier(contexto.defenderHeroPower) *
    satisfactionDefenseMultiplier(contexto.defenderSatisfaction);

  let defenseBroken = false;

  for (let roundIndex = 1; roundIndex <= maxRounds; roundIndex += 1) {
    const attackerCount = sumArmy(attackers);
    const defenderCount = sumArmy(defenders);
    if (attackerCount <= 0 || defenderCount <= 0) {
      defenseBroken = defenderCount <= 0;
      break;
    }

    const fatigue = 1 - (roundIndex - 1) * 0.045;
    const currentAttackPower =
      calculatePower(attackers, "attack") *
      buildMultiplier(contexto.attackerMilitaryBuildBonus) *
      heroMultiplier(contexto.attackerHeroPower) *
      fatigue;
    const currentDefensePower =
      (calculatePower(defenders, "defense") + calculateWallPower(wallLevel) * clamp(1 - (roundIndex - 1) * 0.12, 0.35, 1)) *
      buildMultiplier(contexto.defenderMilitaryBuildBonus) *
      heroMultiplier(contexto.defenderHeroPower) *
      satisfactionDefenseMultiplier(contexto.defenderSatisfaction);

    const attackShare = currentAttackPower / Math.max(1, currentAttackPower + currentDefensePower);
    const defenseShare = 1 - attackShare;
    const defenderLossRatio = clamp(0.04 + attackShare * 0.28, 0.05, 0.34);
    const attackerLossRatio = clamp(0.035 + defenseShare * 0.24, 0.04, 0.29);

    const defenderLosses = Math.max(0, Math.min(defenderCount, round(defenderCount * defenderLossRatio)));
    const attackerLosses = Math.max(0, Math.min(attackerCount, round(attackerCount * attackerLossRatio)));
    const roundDefenderDeaths = applyLossesByWeight(defenders, defenderLosses, true);
    const roundAttackerDeaths = applyLossesByWeight(attackers, attackerLosses, false);

    addArmy(defenderDeaths, roundDefenderDeaths);
    addArmy(attackerDeaths, roundAttackerDeaths);

    rounds.push({
      round: roundIndex,
      poderAtaque: round(currentAttackPower),
      poderDefesa: round(currentDefensePower),
      perdasAtacante: roundAttackerDeaths,
      perdasDefensor: roundDefenderDeaths,
    });

    const remainingDefensePower = calculatePower(defenders, "defense");
    if (sumArmy(defenders) <= 0 || remainingDefensePower <= Math.max(12, initialDefensePower * 0.08)) {
      defenseBroken = true;
      break;
    }
  }

  const attackerInitialCount = sumArmy(input.atacante);
  const defenderInitialCount = sumArmy(input.defensor);
  const attackerDeadCount = sumArmy(attackerDeaths);
  const defenderDeadCount = sumArmy(defenderDeaths);
  const danoAtacantePct = clamp(attackerDeadCount / Math.max(1, attackerInitialCount), 0, 1);
  const danoDefensorPct = clamp(defenderDeadCount / Math.max(1, defenderInitialCount), 0, 1);
  const decisivo = defenseBroken && sumArmy(attackers) > 0;
  const vencedor = decisivo ? "atacante" : sumArmy(attackers) <= 0 ? "defensor" : "retirada";
  const outcomeLabel =
    vencedor === "atacante"
      ? "brecha aberta"
      : vencedor === "defensor"
        ? "ataque contido"
        : "retirada organizada";
  const headline =
    vencedor === "atacante"
      ? defenderImperialResponseTotal > 0
        ? "A guarnicao local cedeu antes que o Imperio segurasse a linha."
        : "A guarnicao local foi rompida sem tempo para resposta externa."
      : vencedor === "defensor"
        ? defenderImperialResponseTotal > 0
          ? "A defesa local segurou com apoio imperial limitado."
          : "A guarnicao local travou o ataque sem depender de reforcos."
        : defenderImperialResponseTotal > 0
          ? "A cidade resistiu o bastante para forcar a retirada sob resposta parcial."
          : "A pressao local bastou para forcar a retirada atacante.";
  const summary =
    `Defesa inicial: ${defenderLocalTotal} locais` +
    (defenderImperialResponseTotal > 0 ? ` + ${defenderImperialResponseTotal} em ${defenderResponseWindowLabel}` : " sem reforco imperial") +
    `. Resultado: ${outcomeLabel}.`;

  const attackerDeadWeight = mergeDeadWeight(attackerDeaths);
  const defenderDeadWeight = mergeDeadWeight(defenderDeaths);
  const attackerScore = calculateMilitaryScore({
    attackerDeadWeight,
    defenderDeadWeight,
    initialAttackPower,
    initialDefensePower,
    wallLevel,
    attackerHeroPower: contexto.attackerHeroPower ?? 0,
    defenderHeroPower: contexto.defenderHeroPower ?? 0,
    decisive: decisivo,
    perspective: "attacker",
    currentScore: militaryScoreAtual,
    cap: militaryScoreCap,
  });
  const defenderScore = calculateMilitaryScore({
    attackerDeadWeight,
    defenderDeadWeight,
    initialAttackPower,
    initialDefensePower,
    wallLevel,
    attackerHeroPower: contexto.attackerHeroPower ?? 0,
    defenderHeroPower: contexto.defenderHeroPower ?? 0,
    decisive: decisivo,
    perspective: "defender",
    currentScore: defenderMilitaryScoreAtual,
    cap: militaryScoreCap,
  });

  return {
    vencedor,
    decisivo,
    rounds,
    resumoPerdas: {
      atacante: {
        mortos: compactArmy(attackerDeaths),
        fugiram: compactArmy(attackers),
      },
      defensor: {
        mortos: compactArmy(defenderDeaths),
        fugiram: compactArmy(defenders),
      },
    },
    recursosSaqueados: calculateLoot({
      resources: input.recursosDefensor,
      survivorAttackers: attackers,
      defenderDamageRatio: danoDefensorPct,
      wallLevel,
      success: decisivo,
      lootableResourceKeys: contexto.lootableResourceKeys,
    }),
    impactoSatisfacao: calculateSatisfactionImpact({
      defenderDamageRatio: danoDefensorPct,
      attackerSuccess: decisivo,
      wallLevel,
      defenderDeadWeight,
    }),
    scoreMilitarAtacanteFinal: attackerScore.final,
    scoreMilitarDefensorFinal: defenderScore.final,
    scoreMilitarFinal: attackerScore.final,
    scoreMilitarAtacanteBruto: attackerScore.raw,
    scoreMilitarDefensorBruto: defenderScore.raw,
    scoreMilitarBruto: attackerScore.raw,
    scoreMilitarAtacanteCapRestante: attackerScore.capRestante,
    scoreMilitarDefensorCapRestante: defenderScore.capRestante,
    scoreMilitarCapRestante: attackerScore.capRestante,
    leitura: {
      danoDefensorPct: round(danoDefensorPct * 1000) / 10,
      danoAtacantePct: round(danoAtacantePct * 1000) / 10,
      equilibrioBatalha: attackerScore.balance,
      defesaQuebrada: defenseBroken,
    },
    battleReport: {
      attackerTotal: attackerInitialCount,
      defenderTotal: defenderInitialCount,
      defenderLocalTotal,
      defenderImperialResponseTotal,
      defenderResponseReadiness: round(defenderResponseReadiness * 1000) / 10,
      defenderResponseWindowLabel,
      outcomeLabel,
      headline,
      summary,
    },
  };
}

export async function handleKingsWorldCombatRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "Metodo nao permitido" }, { status: 405 });
  }

  try {
    const body = (await request.json()) as CombatInput;
    return Response.json(processKingsWorldCombat(body));
  } catch (error) {
    return Response.json(
      {
        error: "Falha ao processar combate",
        detail: error instanceof Error ? error.message : "erro desconhecido",
      },
      { status: 400 },
    );
  }
}
