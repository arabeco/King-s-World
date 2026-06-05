import { axialDistance, type AxialCoord } from "@/lib/hex-grid";
import {
  BUILDINGS_BY_ID,
  type BuildingDefinition,
  type BuildingId,
  type ResourceCost,
} from "@/lib/buildings";

export type BalancePhase = "phase_1" | "phase_2";
export type ProtocolType = "focus_supply" | "focus_influence" | "focus_defense";

export const GAME_BALANCE_CONSTANTS = Object.freeze({
  worldDays: 120,
  phase1EndDay: 90,
  hordeSpikeDay: 110,
  baseMoveTimeMinutes: 45,
  roadMoveTimeMinutes: 15,
  phase4LogisticsMultiplier: 5,
  etaSpecialistMinHours: 48,
  etaSpecialistMaxHours: 60,
  wonderCostMultiplier: 2.6,
  buildingTimeGrowth: 1.09,
});

// Regra oficial:
// - Influencia e score soberano vivo, nao moeda operacional.
// - O alvo real de sobrevivencia e 1500 para desafiar o Centro/Portal.
// - 2500 e o teto teorico do mundo; alcancavel, mas raro e dependente de posicao + sorte + execucao forte.
export const SOVEREIGNTY_SCORE_MAX = 2500;
export const SOVEREIGNTY_PORTAL_CUT = 1500;
export const SOVEREIGNTY_AREA_MAX = 500;
export const SOVEREIGNTY_MILITARY_SCORE_CAP = 400;
export const WONDER_REQUIRED_CITY_DEVELOPMENT = 100;
const SOVEREIGNTY_AREA_MAX_BY_ID = {
  production: 1000,
  government: 500,
  military: SOVEREIGNTY_MILITARY_SCORE_CAP,
  society: 300,
  legacy: 300,
} as const;
export const TRIBE_LOYALTY_STAGE_COUNT = 5;
export const TRIBE_LOYALTY_FULL_BONUS = 100;
export const TRIBE_LOYALTY_STAGE_BONUS = TRIBE_LOYALTY_FULL_BONUS / TRIBE_LOYALTY_STAGE_COUNT;
export const TRIBE_PACT_DAY = Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / 4);
export const TRIBE_CHAMBER_DAY = Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / 2);
export const FINAL_EXODUS_DAY = GAME_BALANCE_CONSTANTS.phase1EndDay + 1;
export const PORTAL_MANDATE_DAY = Math.ceil(GAME_BALANCE_CONSTANTS.worldDays * 0.54);
export const PORTAL_PRESSURE_DAY = Math.ceil(GAME_BALANCE_CONSTANTS.worldDays * 0.58);
export const CITY_DIPLOMAT_UNLOCK_DEVELOPMENT = 60;
export const MAX_CITY_DIPLOMATS = 9;
export const MAX_TRIBE_ENVOYS = 2;
export const MAX_TOTAL_DIPLOMATS = MAX_CITY_DIPLOMATS + MAX_TRIBE_ENVOYS;

// --- Calendário de ameaças (ataques NPC recorrentes) ---
// Em vez de só o pico do D110, ataques distribuídos com intensidade crescente,
// para forçar adaptação contínua ao longo dos 120 dias.
export type ThreatWave = {
  day: number;
  intensity: number; // 0..1
  label: string;
};

export type ThreatCalendarState = {
  waves: ThreatWave[];
  nextWave: ThreatWave | null;
  daysUntilNext: number | null;
  activeWave: ThreatWave | null; // ataque a acontecer agora (janela de ±1 dia)
  peakDay: number;
};

export function getThreatCalendar(currentDay: number, durationDays = GAME_BALANCE_CONSTANTS.worldDays): ThreatCalendarState {
  const peakDay = Math.round(durationDays * (GAME_BALANCE_CONSTANTS.hordeSpikeDay / GAME_BALANCE_CONSTANTS.worldDays));
  // Ondas a cada ~15% da campanha, começando em ~17%, intensidade crescente até o pico.
  const anchors = [0.17, 0.33, 0.5, 0.67, 0.82, 0.92];
  const waves: ThreatWave[] = anchors.map((frac, index) => {
    const day = Math.round(durationDays * frac);
    const intensity = clamp(0.25 + index * 0.14, 0.25, 0.95);
    const label =
      index === 0 ? "Primeira incursão"
      : index === anchors.length - 1 ? "Pico da horda"
      : intensity >= 0.6 ? "Ataque pesado"
      : "Investida de fronteira";
    return { day, intensity, label };
  });
  // Garante que o pico real (D110 equivalente) está na lista
  if (!waves.some((w) => Math.abs(w.day - peakDay) <= 2)) {
    waves.push({ day: peakDay, intensity: 0.95, label: "Pico da horda" });
  }
  waves.sort((a, b) => a.day - b.day);

  const activeWave = waves.find((w) => Math.abs(w.day - currentDay) <= 1) ?? null;
  const nextWave = waves.find((w) => w.day > currentDay) ?? null;
  const daysUntilNext = nextWave ? nextWave.day - currentDay : null;

  return { waves, nextWave, daysUntilNext, activeWave, peakDay };
}

const SOVEREIGNTY_BUILDING_IDS: BuildingId[] = ["palace", "mines", "housing", "barracks", "wall"];
export const CITY_POPULATION_MAX = 100;
export const POPULATION_PER_HOUSING_LEVEL = 10;
export const POPULATION_ALLOCATION_STEP = 5;
const SOVEREIGNTY_SECTOR_IDS = ["crown", "economy", "society", "recruitment", "defense"] as const;
type SovereigntySectorId = (typeof SOVEREIGNTY_SECTOR_IDS)[number];

export type SovereigntyAreaId = "production" | "government" | "military" | "society" | "legacy";

export type SovereigntyAreaScore = {
  id: SovereigntyAreaId;
  current: number;
  max: number;
};

export type SovereigntyVillageState = {
  type?: "Capital" | "Colonia" | string;
  underAttack?: boolean;
  cityClass?: string | null;
  buildingLevels: Partial<Record<BuildingId, number>>;
};

export type SovereigntyWorkforceState = Partial<
  Record<"treasury" | "supply" | "forge" | "watch" | "lore", number>
>;

export type TerrainModifiers = {
  terrainCostMultiplier?: number;
  terrainTimeMultiplier?: number;
  terrainProductionMultiplier?: number;
  terrainCombatMultiplier?: number;
  terrainMovementMultiplier?: number;
};

export type EvolutionMode =
  | "balanced"
  | "metropole"
  | "vanguard"
  | "bastion"
  | "flow";

export type SovereignArchetype =
  | "sovereign_industrial"
  | "sovereign_citadel"
  | "sovereign_logistic"
  | "sovereign_vanguard";  // Offensive frontier build with heavier supply burn

type BuildingCategory =
  | "governance"
  | "economy"
  | "research"
  | "logistics"
  | "military"
  | "defense"
  | "legacy";

export type EvolutionModeProfile = {
  id: EvolutionMode;
  label: string;
  summary: string;
  costByCategory: Partial<Record<BuildingCategory, number>>;
  timeByCategory: Partial<Record<BuildingCategory, number>>;
};

const DEFAULT_EVOLUTION_MODE: EvolutionMode = "balanced";

const EVOLUTION_MODE_PROFILES: Record<EvolutionMode, EvolutionModeProfile> = {
  balanced: {
    id: "balanced",
    label: "Balanceado",
    summary: "Progressao estavel para economia, defesa e militar.",
    costByCategory: {},
    timeByCategory: {},
  },
  metropole: {
    id: "metropole",
    label: "Metropole",
    summary: "Acelera economia e pesquisa, encarece militar no inicio.",
    costByCategory: {
      economy: 0.88,
      research: 0.9,
      governance: 0.94,
      military: 1.12,
      defense: 1.08,
    },
    timeByCategory: {
      economy: 0.88,
      research: 0.9,
      military: 1.08,
      defense: 1.05,
    },
  },
  vanguard: {
    id: "vanguard",
    label: "Posto Avancado",
    summary: "Forte em militar/ocupacao, economia menos eficiente.",
    costByCategory: {
      military: 0.86,
      defense: 0.92,
      logistics: 0.95,
      economy: 1.14,
      research: 1.08,
    },
    timeByCategory: {
      military: 0.84,
      defense: 0.9,
      logistics: 0.92,
      economy: 1.12,
    },
  },
  bastion: {
    id: "bastion",
    label: "Bastiao",
    summary: "Prioriza muralha e seguranca, ataque fica mais lento.",
    costByCategory: {
      defense: 0.84,
      governance: 0.95,
      economy: 0.97,
      military: 1.12,
      legacy: 1.06,
    },
    timeByCategory: {
      defense: 0.82,
      governance: 0.95,
      military: 1.1,
      legacy: 1.06,
    },
  },
  flow: {
    id: "flow",
    label: "Celeiro de Fluxo",
    summary: "Logistica e suprimentos com foco na marcha final.",
    costByCategory: {
      logistics: 0.8,
      economy: 0.9,
      research: 0.96,
      military: 1.08,
    },
    timeByCategory: {
      logistics: 0.8,
      economy: 0.9,
      research: 0.94,
      military: 1.08,
    },
  },
};

export type BuildingUpgradeOptions = TerrainModifiers & {
  scalarMultiplier?: number;
  evolutionMode?: EvolutionMode;
  archetype?: SovereignArchetype; // Added for strategy-dependent costs
};

export type EconomyStructures = {
  economy: number;
  infrastructure: number;
  governance: number;
  military: number;
};

export type EconomyResearch = {
  economy: number;
  logistics: number;
  governance: number;
};

export type EconomyTraits = {
  economyFocus: number;
  quality: number;
};

export type EconomyTroops = {
  offense: number;
  defense: number;
};

export type EconomyResources = {
  materials: number;
  supplies: number;
  influence: number;
};

export type CityProductionFocusId = "materials" | "supplies" | "commerce" | "logistics";
export type CitySocietyJobId = "medics" | "crafts" | "order" | "scholars";
export type CityHeroBuildId = "leadership" | "logistics" | "discipline" | "lore" | "none";
export type CitySkillDots = Partial<Record<"a" | "b" | "c" | "d", number>>;

export type CityDailyProductionInput = {
  cityClass?: string | null;
  terrainKind?: string | null;
  heroBuild?: CityHeroBuildId | null;
  productionFocus?: CityProductionFocusId | null;
  societyFocus?: "medics" | "crafts" | "order" | "scholars" | null;
  levels: Partial<Record<BuildingId, number>>;
  productionWorkers?: Partial<Record<CityProductionFocusId, number>>;
  jobs?: Partial<Record<CitySocietyJobId, number>>;
  crownSkillDots?: CitySkillDots;
  economySkillDots?: CitySkillDots;
  societySkillDots?: CitySkillDots;
  populationCurrent?: number;
  underAttack?: boolean;
  kingResourceProductionMultiplier?: number;
  kingSatisfactionDelta?: number;
  kingCrisisRiskDelta?: number;
  worldSpeedMultiplier?: number;
};

export type CityDailyProductionResult = {
  materials: number;
  supplies: number;
  influence: number;
  logistics: number;
  stability: number;
  breakdown: {
    cityClass: string;
    terrain: string;
    sectors: {
      government: number;
      production: number;
      society: number;
      recruitment: number;
      defense: number;
    };
    workers: Record<CityProductionFocusId, number>;
    jobs: Record<CitySocietyJobId, number>;
    modifiers: {
      materials: number;
      supplies: number;
      influence: number;
      logistics: number;
      stability: number;
    };
  };
};

export type CitySocietyBand = "colapso" | "pressao" | "estavel" | "alta" | "radiante";

export type CitySocietyStateInput = {
  cityClass?: string | null;
  terrainKind?: string | null;
  heroBuild?: CityHeroBuildId | null;
  levels: Partial<Record<BuildingId, number>>;
  societySkillDots?: CitySkillDots;
  productionWorkers?: Partial<Record<CityProductionFocusId, number>>;
  jobs?: Partial<Record<CitySocietyJobId, number>>;
  recruitedPopulation?: number;
  defendedPopulation?: number;
  populationCurrent?: number;
  underAttack?: boolean;
  deficitsCount?: number;
  kingSatisfactionDelta?: number;
  kingCrisisRiskDelta?: number;
};

export type CitySocietyStateResult = {
  satisfaction: number;
  band: CitySocietyBand;
  productionMultiplier: number;
  defenseMultiplier: number;
  crisisRisk: number;
  breakdown: {
    housingPressure: number;
    employmentPressure: number;
    warPressure: number;
    attackPressure: number;
    deficitPressure: number;
  };
};

export type CatastropheMultipliers = {
  materialsMult?: number;
  suppliesMult?: number;
  influenceMult?: number;
  upkeepMult?: number;
};

export type DailyEconomyInput = TerrainModifiers & {
  villages: number;
  structures: EconomyStructures;
  research: EconomyResearch;
  traits: EconomyTraits;
  troops: EconomyTroops;
  resources: EconomyResources;
  upkeepMult?: number;
  activeProtocol?: ProtocolType | null;
  catastrophe?: CatastropheMultipliers | null;
};

export type DailyEconomyResult = {
  production: EconomyResources;
  upkeep: number;
  stocksAfterTick: EconomyResources;
  supplyPenaltyRatio: number;
  offenseMultiplierAfterPenalty: number;
  defenseMultiplierAfterPenalty: number;
};

export type ResearchCostOptions = TerrainModifiers & {
  materialsMultiplier?: number;
  influenceMultiplier?: number;
};

export type ResearchCost = {
  materials: number;
  influence: number;
};

export type AttackChanceInput = TerrainModifiers & {
  phase: BalancePhase;
  aggression: number;
  isHuman: boolean;
  aggressionMultiplier?: number;
};

export type AttackForceInput = TerrainModifiers & {
  offense: number;
  aggression: number;
  hasGeneral?: boolean;
  researchArmyLevel: number;
  hasWarLeader?: boolean;
  hasHero?: boolean;
};

export type DefenseForceInput = TerrainModifiers & {
  defense: number;
  targetSite: "capital" | "colony";
  structuresDefenseLevel: number;
  researchArmyLevel: number;
  hasHero?: boolean;
  wallDefenseMultiplier?: number;
  tribeDefenseMultiplier?: number;
  focusDefenseActive?: boolean;
};

export type CombatForces = {
  attackForce: number;
  defenseForce: number;
  attackerCommit: number;
  defenderCommit: number;
};

export type CombatResolution = {
  winner: "attacker" | "defender";
  attackerLossRatio: number;
  defenderLossRatio: number;
};

export type MarchOptions = TerrainModifiers & {
  hasRoad: boolean;
  baseMoveMinutes?: number;
  roadMoveMinutes?: number;
};

export type MarchTime = {
  hexDistance: number;
  minutesPerHex: number;
  totalMinutes: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function safeMultiplier(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

function sanitizeCitySkillDots(dots: CitySkillDots | undefined): Record<"a" | "b" | "c" | "d", number> {
  return {
    a: clamp(Math.floor(dots?.a ?? 0), 0, 3),
    b: clamp(Math.floor(dots?.b ?? 0), 0, 3),
    c: clamp(Math.floor(dots?.c ?? 0), 0, 3),
    d: clamp(Math.floor(dots?.d ?? 0), 0, 3),
  };
}

function resolveCityClassYieldModifiers(cityClass?: string | null): {
  label: string;
  materials: number;
  supplies: number;
  influence: number;
  logistics: number;
  stability: number;
} {
  switch (cityClass) {
    case "metropole":
      return { label: "Metropole", materials: 1.08, supplies: 0.98, influence: 1.16, logistics: 1.02, stability: 1.04 };
    case "celeiro":
      return { label: "Celeiro", materials: 0.94, supplies: 1.18, influence: 0.98, logistics: 1.12, stability: 1.06 };
    case "posto_avancado":
      return { label: "Posto Avancado", materials: 1.05, supplies: 0.95, influence: 1.08, logistics: 1.08, stability: 0.94 };
    case "bastiao":
      return { label: "Bastiao", materials: 1.02, supplies: 1.04, influence: 0.96, logistics: 0.98, stability: 1.18 };
    default:
      return { label: "Neutra", materials: 1, supplies: 1, influence: 1, logistics: 1, stability: 1 };
  }
}

function resolveTerrainYieldModifiers(terrainKind?: string | null): {
  label: string;
  materials: number;
  supplies: number;
  influence: number;
  logistics: number;
  stability: number;
} {
  switch (terrainKind) {
    case "crown_heartland":
      return { label: "Coracao da Coroa", materials: 1.08, supplies: 1.04, influence: 1.12, logistics: 1.04, stability: 1.08 };
    case "riverlands":
      return { label: "Varzea dos Rios", materials: 0.96, supplies: 1.16, influence: 1.02, logistics: 1.14, stability: 1.04 };
    case "frontier_pass":
      return { label: "Passagem de Fronteira", materials: 1.04, supplies: 0.95, influence: 1.06, logistics: 1.08, stability: 0.94 };
    case "ironridge":
      return { label: "Escarpa de Ferro", materials: 1.14, supplies: 0.96, influence: 0.98, logistics: 0.96, stability: 1.12 };
    default:
      return { label: "Campos de Cinza", materials: 0.94, supplies: 0.94, influence: 0.96, logistics: 0.92, stability: 0.92 };
  }
}

function resolveHeroYieldModifiers(heroBuild?: CityHeroBuildId | null): {
  materials: number;
  supplies: number;
  influence: number;
  logistics: number;
  stability: number;
} {
  switch (heroBuild) {
    case "leadership":
      return { materials: 1, supplies: 1, influence: 1.15, logistics: 1.02, stability: 1.08 };
    case "logistics":
      return { materials: 1.05, supplies: 1.05, influence: 1.02, logistics: 1.16, stability: 1 };
    case "discipline":
      return { materials: 0.98, supplies: 0.98, influence: 1.04, logistics: 1.02, stability: 1.12 };
    case "lore":
      return { materials: 1.02, supplies: 1, influence: 1.12, logistics: 1.04, stability: 1.04 };
    default:
      return { materials: 1, supplies: 1, influence: 1, logistics: 1, stability: 1 };
  }
}

export function calculateCitySocietyState(input: CitySocietyStateInput): CitySocietyStateResult {
  const government = getVillageGovernmentLevel(input.levels);
  const society = getVillageSocietyLevel(input.levels);
  const defense = getVillageDefenseLevel(input.levels);
  const societyDots = sanitizeCitySkillDots(input.societySkillDots);
  const cityClass = resolveCityClassYieldModifiers(input.cityClass);
  const terrain = resolveTerrainYieldModifiers(input.terrainKind);
  const hero = resolveHeroYieldModifiers(input.heroBuild);

  const productionWorkers = Object.values(input.productionWorkers ?? {}).reduce((sum, value) => sum + clamp(Math.floor(value ?? 0), 0, 100), 0);
  const jobs = {
    medics: clamp(Math.floor(input.jobs?.medics ?? 0), 0, 100),
    crafts: clamp(Math.floor(input.jobs?.crafts ?? 0), 0, 100),
    order: clamp(Math.floor(input.jobs?.order ?? 0), 0, 100),
    scholars: clamp(Math.floor(input.jobs?.scholars ?? 0), 0, 100),
  };
  const recruitedPopulation = clamp(Math.floor(input.recruitedPopulation ?? 0), 0, 100);
  const defendedPopulation = clamp(Math.floor(input.defendedPopulation ?? 0), 0, 100);
  const usedPopulation = productionWorkers + Object.values(jobs).reduce((sum, value) => sum + value, 0) + recruitedPopulation + defendedPopulation;
  const populationCap = Math.max(1, calculateVillagePopulationCap(input.levels));
  const populationCurrent = clamp(Math.floor(input.populationCurrent ?? populationCap), usedPopulation, populationCap);
  const idlePopulation = Math.max(0, populationCurrent - usedPopulation);

  const housingPressure = clamp((populationCurrent / populationCap) * 100, 0, 100);
  const employmentPressure = populationCurrent > 0 ? clamp((idlePopulation / populationCurrent) * 100, 0, 100) : 0;
  const warPressure = populationCurrent > 0 ? clamp(((recruitedPopulation + defendedPopulation) / populationCurrent) * 100, 0, 100) : 0;
  const attackPressure = input.underAttack ? 100 : 0;
  const deficitPressure = clamp((input.deficitsCount ?? 0) * 18, 0, 100);

  const baseSatisfaction =
    38 +
    society * 5 +
    government * 2 +
    defense * 2 +
    societyDots.a * 2 +
    societyDots.c * 4 +
    societyDots.d * 2 +
    jobs.medics * 1.4 +
    jobs.order * 1.7 +
    jobs.scholars * 0.6 +
    jobs.crafts * 0.5;

  const rawSatisfaction =
    baseSatisfaction -
    Math.max(0, housingPressure - 82) * 0.7 -
    employmentPressure * 0.18 -
    Math.max(0, warPressure - 30) * 0.35 -
    (input.underAttack ? 12 : 0) -
    (input.deficitsCount ?? 0) * 6 +
    (input.kingSatisfactionDelta ?? 0);

  const satisfaction = clamp(
    round(rawSatisfaction * cityClass.stability * terrain.stability * hero.stability),
    0,
    100,
  );

  const band: CitySocietyBand =
    satisfaction >= 85 ? "radiante" : satisfaction >= 68 ? "alta" : satisfaction >= 50 ? "estavel" : satisfaction >= 32 ? "pressao" : "colapso";
  const productionMultiplier =
    satisfaction >= 85 ? 1.12 : satisfaction >= 68 ? 1.06 : satisfaction >= 50 ? 1 : satisfaction >= 32 ? 0.92 : 0.82;
  const defenseMultiplier =
    satisfaction >= 85 ? 1.08 : satisfaction >= 68 ? 1.04 : satisfaction >= 50 ? 1 : satisfaction >= 32 ? 0.94 : 0.86;
  const crisisRisk = clamp(
    round(
      100 -
        satisfaction +
        Math.max(0, warPressure - 35) * 0.4 +
        (input.underAttack ? 10 : 0) +
        (input.deficitsCount ?? 0) * 5 +
        (input.kingCrisisRiskDelta ?? 0),
    ),
    0,
    100,
  );

  return {
    satisfaction,
    band,
    productionMultiplier,
    defenseMultiplier,
    crisisRisk,
    breakdown: {
      housingPressure: round(housingPressure),
      employmentPressure: round(employmentPressure),
      warPressure: round(warPressure),
      attackPressure,
      deficitPressure: round(deficitPressure),
    },
  };
}

function resolveBuilding(building: BuildingId | BuildingDefinition): BuildingDefinition {
  return typeof building === "string" ? BUILDINGS_BY_ID[building] : building;
}

function readVillageLevel(levels: Partial<Record<BuildingId, number>>, ...keys: string[]): number {
  const rawLevels = levels as Record<string, unknown>;
  return keys.reduce((best, key) => {
    const raw = rawLevels[key];
    const next = typeof raw === "number" && Number.isFinite(raw) ? clamp(Math.floor(raw), 0, 10) : 0;
    return Math.max(best, next);
  }, 0);
}

export function getVillageGovernmentLevel(levels: Partial<Record<BuildingId, number>>): number {
  return readVillageLevel(levels, "crown", "palace", "senate");
}

export function getVillageProductionLevel(levels: Partial<Record<BuildingId, number>>): number {
  return readVillageLevel(levels, "economy", "mines", "farms", "roads");
}

export function getVillageSocietyLevel(levels: Partial<Record<BuildingId, number>>): number {
  return readVillageLevel(levels, "society", "housing", "research");
}

export function getVillageRecruitmentLevel(levels: Partial<Record<BuildingId, number>>): number {
  return readVillageLevel(levels, "recruitment", "barracks", "arsenal");
}

export function getVillageDefenseLevel(levels: Partial<Record<BuildingId, number>>): number {
  return readVillageLevel(levels, "defense", "wall");
}

function getVillageSectorLevel(levels: Partial<Record<BuildingId, number>>, sectorId: SovereigntySectorId): number {
  switch (sectorId) {
    case "crown":
      return getVillageGovernmentLevel(levels);
    case "economy":
      return getVillageProductionLevel(levels);
    case "society":
      return getVillageSocietyLevel(levels);
    case "recruitment":
      return getVillageRecruitmentLevel(levels);
    case "defense":
      return getVillageDefenseLevel(levels);
  }
}

function getBuildingCategory(buildingId: BuildingId): BuildingCategory {
  switch (buildingId) {
    case "palace":
    case "senate":
      return "governance";
    case "mines":
    case "farms":
    case "housing":
      return "economy";
    case "research":
      return "research";
    case "roads":
      return "logistics";
    case "barracks":
    case "arsenal":
      return "military";
    case "wall":
      return "defense";
    case "wonder":
      return "legacy";
    default:
      return "economy";
  }
}

export function getEvolutionModeProfile(mode?: EvolutionMode): EvolutionModeProfile {
  return EVOLUTION_MODE_PROFILES[mode ?? DEFAULT_EVOLUTION_MODE] ?? EVOLUTION_MODE_PROFILES[DEFAULT_EVOLUTION_MODE];
}

export function listEvolutionModeProfiles(): EvolutionModeProfile[] {
  return Object.values(EVOLUTION_MODE_PROFILES);
}

function resolveEvolutionMultipliers(mode: EvolutionMode | undefined, buildingId: BuildingId): { cost: number; time: number } {
  const profile = getEvolutionModeProfile(mode);
  const category = getBuildingCategory(buildingId);
  return {
    cost: safeMultiplier(profile.costByCategory[category]),
    time: safeMultiplier(profile.timeByCategory[category]),
  };
}

export function getWorldPhase(day: number): BalancePhase {
  return day <= GAME_BALANCE_CONSTANTS.phase1EndDay ? "phase_1" : "phase_2";
}

export type SovereignUpgradeCost = ResourceCost & {
  requiredInfluence: number;
};

export function calculateBuildingUpgradeCost(
  building: BuildingId | BuildingDefinition,
  nextLevel: number,
  options: BuildingUpgradeOptions = {},
): SovereignUpgradeCost {
  const definition = resolveBuilding(building);
  const scalar = definition.growth ** Math.max(0, nextLevel - 1);
  const wonderScalar =
    definition.id === "wonder" ? GAME_BALANCE_CONSTANTS.wonderCostMultiplier : 1;
  const levelPressure = nextLevel >= 9 ? 1.25 : nextLevel >= 7 ? 1.15 : 1; // Slight increase in pressure for late game
  const earlyAcceleration = nextLevel <= 3 ? 0.9 : 1; // Better early game feel

  const evolution = resolveEvolutionMultipliers(options.evolutionMode, definition.id);

  let archetypeMaterialMult = 1.0;
  let archetypeSupplyMult = 1.0;

  if (options.archetype === "sovereign_industrial") {
    archetypeMaterialMult = 0.85;
  } else if (options.archetype === "sovereign_citadel") {
    archetypeMaterialMult = 1.4;
  } else if (options.archetype === "sovereign_logistic") {
    archetypeSupplyMult = 1.25;
  } else if (options.archetype === "sovereign_vanguard") {
    archetypeMaterialMult = 1.08;
    archetypeSupplyMult = 1.32;
  }

  const totalScalar =
    scalar *
    wonderScalar *
    levelPressure *
    earlyAcceleration *
    safeMultiplier(options.scalarMultiplier) *
    safeMultiplier(options.terrainCostMultiplier) *
    evolution.cost;

  return {
    materials: round(definition.baseCost.materials * totalScalar * archetypeMaterialMult),
    supplies: round(definition.baseCost.supplies * totalScalar * archetypeSupplyMult),
    // Influence is now a threshold (score required), not a consumable cost.
    influence: 0,
    requiredInfluence: round(definition.baseCost.influence * totalScalar),
  };
}

export function calculateBuildingUpgradeMinutes(
  building: BuildingId | BuildingDefinition,
  nextLevel: number,
  options: BuildingUpgradeOptions = {},
): number {
  const definition = resolveBuilding(building);
  const evolution = resolveEvolutionMultipliers(options.evolutionMode, definition.id);

  const minutes =
    definition.baseMinutes *
    GAME_BALANCE_CONSTANTS.buildingTimeGrowth ** Math.max(0, nextLevel - 1) *
    safeMultiplier(options.terrainTimeMultiplier) *
    evolution.time;

  return Math.max(1, round(minutes));
}

export function calculateBuildingBenefit(
  building: BuildingId | BuildingDefinition,
  level: number,
): number {
  const definition = resolveBuilding(building);
  const perLevel = definition.benefit.perLevel;

  // Breakthrough Logic (Níveis de Ruptura)
  // Spiky progression: benefits jump at key levels (3, 7, and 10)
  let multipliers = 0;
  for (let i = 2; i <= level; i++) {
    // Level 10 is the "Sovereign" level, but we reduced the spike for better balance
    if (i === 10) multipliers += 2.6;
    else if (i === 7) multipliers += 1.8;
    else if (i === 3) multipliers += 1.5;
    else multipliers += 1.0; // Standard linear growth
  }

  return definition.benefit.base + multipliers * perLevel;
}

export type BuildingActionDelta = {
  materials: number;
  supplies: number;
  influence: number;
  note: string;
};

export function calculateBuildingActionDelta(buildingId: BuildingId, level: number): BuildingActionDelta {
  const safeLevel = clamp(Math.floor(level), 1, 10);
  const benefit = calculateBuildingBenefit(buildingId, safeLevel);

  switch (buildingId) {
    case "mines":
      return {
        materials: round(Math.max(80, benefit * 0.92)),
        supplies: 0,
        influence: round(4 + safeLevel * 1.4),
        note: "Extracao acelerada de materiais",
      };
    case "farms":
      return {
        materials: 0,
        supplies: round(Math.max(80, benefit * 0.9)),
        influence: round(3 + safeLevel * 1.3),
        note: "Pulso de abastecimento",
      };
    case "housing":
      return {
        materials: -round(28 + safeLevel * 5),
        supplies: round(34 + safeLevel * 6),
        influence: round(6 + safeLevel * 1.8),
        note: "Mobilizacao civil",
      };
    case "research":
      return {
        materials: -round(26 + safeLevel * 6),
        supplies: 0,
        influence: round(20 + safeLevel * 3),
        note: "Aceleracao cientifica",
      };
    case "palace":
      return {
        materials: -round(34 + safeLevel * 7),
        supplies: -round(16 + safeLevel * 3),
        influence: round(28 + safeLevel * 4),
        note: "Decreto imperial",
      };
    case "senate":
      return {
        materials: -round(24 + safeLevel * 5),
        supplies: -round(22 + safeLevel * 4),
        influence: round(32 + safeLevel * 4.5),
        note: "Negociacao politica",
      };
    case "barracks":
      return {
        materials: -round(20 + safeLevel * 4),
        supplies: -round(58 + safeLevel * 10),
        influence: round(8 + safeLevel * 2),
        note: "Treino de tropa",
      };
    case "arsenal":
      return {
        materials: -round(62 + safeLevel * 12),
        supplies: -round(28 + safeLevel * 5),
        influence: round(10 + safeLevel * 2.2),
        note: "Forja militar",
      };
    case "wall":
      return {
        materials: -round(54 + safeLevel * 10),
        supplies: -round(22 + safeLevel * 4),
        influence: round(7 + safeLevel * 1.8),
        note: "Reforco de muralha",
      };
    case "wonder":
      return {
        materials: -round(120 + safeLevel * 20),
        supplies: -round(60 + safeLevel * 9),
        influence: round(36 + safeLevel * 5),
        note: "Impulso de legado",
      };
    case "roads":
      return {
        materials: -round(48 + safeLevel * 8),
        supplies: -round(20 + safeLevel * 3),
        influence: round(8 + safeLevel * 1.8),
        note: "Operacao logistica",
      };
    default:
      return {
        materials: 0,
        supplies: 0,
        influence: 0,
        note: "Sem efeito",
      };
  }
}

export function calculateInfluenceCap(palaceLevel: number, senateLevel: number): number {
  return palaceLevel * 100 + senateLevel * 500;
}

export type SovereigntyScoreInput = {
  villages?: SovereigntyVillageState[];
  villageDevelopments: number[];
  councilHeroes: number;
  militaryRankingPoints: number;
  eraQuestsCompleted?: number;
  wondersControlled?: number;
  currentDay: number;
  hasTribeDome?: boolean;
  tribeLoyaltyStage?: number;
  kingAlive?: boolean;
  workforce?: SovereigntyWorkforceState;
  unlockedMilitaryTechs?: number;
  dragonChoice?: "none" | "fire" | "ice";
  populationCurrent?: number;
  populationCapacity?: number;
  employedPopulation?: number;
  recruitedPopulation?: number;
  senateSatisfaction?: number;
  troopPower?: number;
  defensePower?: number;
};

export type SovereigntyScoreBreakdown = {
  buildingLevels: number;
  militaryRanking: number;
  heroesCouncil: number;
  eraQuests: number;
  wonders: number;
  tribeDome: number;
  areas: SovereigntyAreaScore[];
  tribeLoyaltyStage: number;
  tribeLoyaltyNextDay: number | null;
  total: number;
  max: number;
  portalCut: number;
  portalEligible: boolean;
};

export function calculateVillageDevelopment(levels: Partial<Record<BuildingId, number>>): number {
  return SOVEREIGNTY_SECTOR_IDS.reduce((acc, sectorId) => {
    const sanitizedLevel = getVillageSectorLevel(levels, sectorId);
    const villageDevelopmentPerLevel = 2;
    const villageDevelopmentCap = 20;
    return acc + clamp(sanitizedLevel * villageDevelopmentPerLevel, 0, villageDevelopmentCap);
  }, 0);
}

export function canStartWonder(levels: Partial<Record<BuildingId, number>>): boolean {
  return calculateVillageDevelopment(levels) >= WONDER_REQUIRED_CITY_DEVELOPMENT;
}

export function calculateVillageInfluencePoints(development: number): number {
  return clamp(Math.floor(development), 0, 100);
}

export function calculateVillagePopulationCap(levels: Partial<Record<BuildingId, number>>): number {
  const societyLevel = getVillageSocietyLevel(levels);
  return clamp(societyLevel * POPULATION_PER_HOUSING_LEVEL, 0, CITY_POPULATION_MAX);
}

export function calculateVillageRecruitCapacity(levels: Partial<Record<BuildingId, number>>): number {
  const recruitmentLevel = getVillageRecruitmentLevel(levels);
  return recruitmentLevel * POPULATION_ALLOCATION_STEP * 2;
}

export function calculateVillageDefenseCapacity(levels: Partial<Record<BuildingId, number>>): number {
  const defenseLevel = getVillageDefenseLevel(levels);
  return defenseLevel * POPULATION_ALLOCATION_STEP * 2;
}

export function calculateBarracksUnlocks(levels: Partial<Record<BuildingId, number>>): {
  militia: boolean;
  shooters: boolean;
  scouts: boolean;
  machinery: boolean;
} {
  const barracksLevel = getVillageRecruitmentLevel(levels);
  return {
    militia: barracksLevel >= 1,
    shooters: barracksLevel >= 3,
    scouts: barracksLevel >= 5,
    machinery: barracksLevel >= 7,
  };
}

export function calculateWallDefenseUnlocks(levels: Partial<Record<BuildingId, number>>): {
  guards: boolean;
  archers: boolean;
  ballistae: boolean;
} {
  const wallLevel = getVillageDefenseLevel(levels);
  return {
    guards: wallLevel >= 1,
    archers: wallLevel >= 4,
    ballistae: wallLevel >= 7,
  };
}

export function calculateTroopPower(troops: Partial<Record<"militia" | "shooters" | "scouts" | "machinery", number>>): number {
  return (
    Math.max(0, Math.floor(troops.militia ?? 0)) * 1 +
    Math.max(0, Math.floor(troops.shooters ?? 0)) * 2 +
    Math.max(0, Math.floor(troops.scouts ?? 0)) * 2 +
    Math.max(0, Math.floor(troops.machinery ?? 0)) * 4
  );
}

export function calculateDefensePower(defenders: Partial<Record<"guards" | "archers" | "ballistae", number>>): number {
  return (
    Math.max(0, Math.floor(defenders.guards ?? 0)) * 1 +
    Math.max(0, Math.floor(defenders.archers ?? 0)) * 2 +
    Math.max(0, Math.floor(defenders.ballistae ?? 0)) * 4
  );
}

function workforceRatio(workforce: SovereigntyWorkforceState | undefined, key: keyof NonNullable<SovereigntyWorkforceState>): number {
  return clamp(Math.floor(Number(workforce?.[key] ?? 0)), 0, 10) / 10;
}

function villageBuildingRatio(villages: SovereigntyVillageState[], buildingId: BuildingId | SovereigntySectorId): number {
  const totalLevels = villages.reduce((sum, village) => {
    const rawLevel =
      buildingId === "crown" || buildingId === "economy" || buildingId === "society" || buildingId === "recruitment" || buildingId === "defense"
        ? getVillageSectorLevel(village.buildingLevels, buildingId)
        : clamp(Math.floor(village.buildingLevels[buildingId] ?? 0), 0, 10);
    return sum + rawLevel;
  }, 0);
  return clamp(totalLevels / 100, 0, 1);
}

function villageBuildingTotal(villages: SovereigntyVillageState[], buildingId: BuildingId | SovereigntySectorId): number {
  return villages.reduce((sum, village) => {
    const rawLevel =
      buildingId === "crown" || buildingId === "economy" || buildingId === "society" || buildingId === "recruitment" || buildingId === "defense"
        ? getVillageSectorLevel(village.buildingLevels, buildingId)
        : clamp(Math.floor(village.buildingLevels[buildingId] ?? 0), 0, 10);
    return sum + rawLevel;
  }, 0);
}

export function calculateOfficialSovereigntyAreas(input: SovereigntyScoreInput): SovereigntyAreaScore[] | null {
  if (!input.villages || input.villages.length <= 0) {
    return null;
  }

  const villages = input.villages.slice(0, 10);
  const stableCities = villages.filter((village) => !village.underAttack).length;
  const totalInfrastructureLevels =
    villageBuildingTotal(villages, "crown") +
    villageBuildingTotal(villages, "economy") +
    villageBuildingTotal(villages, "society") +
    villageBuildingTotal(villages, "recruitment") +
    villageBuildingTotal(villages, "defense");
  const governmentTotal = villageBuildingTotal(villages, "crown");
  const recruitmentTotal = villageBuildingTotal(villages, "recruitment");
  const defenseTotal = villageBuildingTotal(villages, "defense");
  const heroCount = clamp(Math.max(0, Math.floor(input.councilHeroes ?? 0)), 0, 10);
  const techCount = clamp(Math.max(0, Math.floor(input.unlockedMilitaryTechs ?? 0)), 0, 10);
  const questCount = clamp(Math.max(0, Math.floor(input.eraQuestsCompleted ?? 0)), 0, 3);
  const wonderCount = clamp(Math.max(0, Math.floor(input.wondersControlled ?? 0)), 0, 5);
  const tribeStage = input.hasTribeDome === false ? 0 : clamp(Math.max(0, Math.floor(input.tribeLoyaltyStage ?? 0)), 0, TRIBE_LOYALTY_STAGE_COUNT);
  const stabilityRatio = villages.length > 0 ? clamp(stableCities / villages.length, 0, 1) : 0;
  const dragonRatio = input.dragonChoice && input.dragonChoice !== "none" ? 1 : 0;
  const populationFillRatio =
    input.populationCapacity && input.populationCapacity > 0
      ? clamp(input.populationCurrent ?? 0, 0, input.populationCapacity) / input.populationCapacity
      : 0;
  const employmentRatio =
    input.populationCurrent && input.populationCurrent > 0
      ? clamp(input.employedPopulation ?? 0, 0, input.populationCurrent) / input.populationCurrent
      : 0;
  const recruitmentRatio =
    input.populationCurrent && input.populationCurrent > 0
      ? clamp(input.recruitedPopulation ?? 0, 0, input.populationCurrent) / input.populationCurrent
      : 0;

  const infrastructureScore = clamp(totalInfrastructureLevels * 2, 0, SOVEREIGNTY_AREA_MAX_BY_ID.production);
  const satisfactionRatio = clamp(input.senateSatisfaction ?? 0, 0, 100) / 100;
  const governmentScore = clamp(heroCount * 50, 0, SOVEREIGNTY_AREA_MAX_BY_ID.government);
  const militaryScore = clamp(
    round(clamp(input.troopPower ?? 0, 0, 250) * 0.8) +
    round(clamp(input.defensePower ?? 0, 0, 250) * 0.8) +
      recruitmentTotal * 1.4 +
      defenseTotal * 1.2 +
      techCount * 12 +
      (dragonRatio > 0 ? 30 : 0),
    0,
    SOVEREIGNTY_AREA_MAX_BY_ID.military,
  );
  const societyScore = clamp(
    round(satisfactionRatio * 130 + populationFillRatio * 90 + employmentRatio * 80 + stabilityRatio * 50),
    0,
    SOVEREIGNTY_AREA_MAX_BY_ID.society,
  );
  const legacyScore = clamp(
    round((questCount / 3) * 100) + clamp(wonderCount, 0, 2) * 50 + tribeStage * TRIBE_LOYALTY_STAGE_BONUS,
    0,
    SOVEREIGNTY_AREA_MAX_BY_ID.legacy,
  );

  const areas: SovereigntyAreaScore[] = [
    {
      id: "production",
      current: infrastructureScore,
      max: SOVEREIGNTY_AREA_MAX_BY_ID.production,
    },
    {
      id: "government",
      current: governmentScore,
      max: SOVEREIGNTY_AREA_MAX_BY_ID.government,
    },
    {
      id: "military",
      current: militaryScore,
      max: SOVEREIGNTY_AREA_MAX_BY_ID.military,
    },
    {
      id: "society",
      current: societyScore,
      max: SOVEREIGNTY_AREA_MAX_BY_ID.society,
    },
    {
      id: "legacy",
      current: legacyScore,
      max: SOVEREIGNTY_AREA_MAX_BY_ID.legacy,
    },
  ];

  return areas;
}

export function calculateTribeProgressStage(input: {
  currentDay: number;
  tribeEnvoysCommitted: number;
  kingAlive?: boolean;
}): number {
  if (input.kingAlive === false) {
    return 0;
  }

  const envoys = clamp(Math.floor(input.tribeEnvoysCommitted ?? 0), 0, MAX_TRIBE_ENVOYS);
  if (envoys <= 0) {
    return 0;
  }

  let stage = 1;
  if (input.currentDay >= TRIBE_PACT_DAY) stage = 2;
  if (input.currentDay >= TRIBE_CHAMBER_DAY) stage = 3;
  if (input.currentDay >= FINAL_EXODUS_DAY) stage = 4;
  if (input.currentDay >= FINAL_EXODUS_DAY && envoys >= 2) stage = 5;
  return clamp(stage, 0, TRIBE_LOYALTY_STAGE_COUNT);
}

export function describeNextTribeStep(input: {
  currentDay: number;
  currentStage: number;
  tribeEnvoysCommitted: number;
  kingAlive?: boolean;
}): string {
  if (input.kingAlive === false) {
    return "Mantenha o Rei vivo. Sem Coroa ativa, a linha da Tribo cai para 0.";
  }

  const stage = clamp(Math.floor(input.currentStage ?? 0), 0, TRIBE_LOYALTY_STAGE_COUNT);
  const envoys = clamp(Math.floor(input.tribeEnvoysCommitted ?? 0), 0, MAX_TRIBE_ENVOYS);

  if (stage <= 0) {
    return "Recrute e envie o 1o enviado tribal para abrir Representacao e ganhar os primeiros 20.";
  }
  if (stage === 1) {
    return `Permaneça leal ate o Dia ${TRIBE_PACT_DAY} para fechar Pacto e ganhar +20.`;
  }
  if (stage === 2) {
    return `Segure a filiacao tribal ate o Dia ${TRIBE_CHAMBER_DAY} para abrir Camara e ganhar +20.`;
  }
  if (stage === 3) {
    return `Entre vivo na Fase IV (Dia ${FINAL_EXODUS_DAY}) para abrir o penultimo +20 da Tribo.`;
  }
  if (stage === 4 && envoys < 2) {
    return "Recrute e envie o 2o enviado tribal na fase final para fechar os ultimos +20.";
  }
  if (stage === 4) {
    return "Envie o 2o enviado tribal e mantenha a ligacao ate consolidar o ultimo selo de 20.";
  }
  return "Trilha tribal completa. Os 200 pontos da Tribo ja estao fechados.";
}

export function calculateBuildingUpgradeLoad(buildingId: BuildingId, nextLevel: number): number {
  const sanitizedLevel = clamp(Math.floor(nextLevel), 0, 10);
  if (buildingId === "roads" || sanitizedLevel <= 1) {
    return 0;
  }
  if (buildingId === "wonder") {
    return 8;
  }
  if (sanitizedLevel <= 3) {
    return 1;
  }
  if (sanitizedLevel <= 6) {
    return 2;
  }
  if (sanitizedLevel <= 8) {
    return 3;
  }
  return 4;
}

export function calculateVillageConstructionLoad(levels: Partial<Record<BuildingId, number>>): number {
  return SOVEREIGNTY_SECTOR_IDS.reduce((acc, sectorId) => {
    const canonicalBuildingId =
      sectorId === "crown"
        ? "palace"
        : sectorId === "economy"
          ? "mines"
          : sectorId === "society"
            ? "housing"
            : sectorId === "recruitment"
              ? "barracks"
              : "wall";
    const level = getVillageSectorLevel(levels, sectorId);
    if (level <= 1) {
      return acc;
    }

    let load = acc;
    for (let currentLevel = 2; currentLevel <= level; currentLevel += 1) {
      load += calculateBuildingUpgradeLoad(canonicalBuildingId, currentLevel);
    }
    return load;
  }, 0);
}

export function calculateVillageConstructionCapacity(
  levels: Partial<Record<BuildingId, number>>,
  hasEngineer = false,
): number {
  const government = getVillageGovernmentLevel(levels);
  const society = getVillageSocietyLevel(levels);
  const defense = getVillageDefenseLevel(levels);

  return (
    40 +
    government * 11 +
    society * 7 +
    defense * 2 +
    (hasEngineer ? 10 : 0)
  );
}

export function calculateVillageConstructionRemaining(
  levels: Partial<Record<BuildingId, number>>,
  hasEngineer = false,
): number {
  const capacity = calculateVillageConstructionCapacity(levels, hasEngineer);
  const load = calculateVillageConstructionLoad(levels);
  return Math.max(0, capacity - load);
}

export type TribeLoyaltyProgress = {
  stage: number;
  points: number;
  nextStageDay: number | null;
};

export function calculateTribeLoyaltyProgress(input: {
  currentDay: number;
  hasTribeDome?: boolean;
  kingAlive?: boolean;
  explicitStage?: number;
}): TribeLoyaltyProgress {
  const hasDome = Boolean(input.hasTribeDome);
  const kingAlive = input.kingAlive ?? true;
  if (!hasDome || !kingAlive) {
    return { stage: 0, points: 0, nextStageDay: Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / TRIBE_LOYALTY_STAGE_COUNT) };
  }

  const stageByDay = Math.floor(
    clamp(input.currentDay, 0, GAME_BALANCE_CONSTANTS.worldDays) /
    Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / TRIBE_LOYALTY_STAGE_COUNT),
  );
  const stage = clamp(
    typeof input.explicitStage === "number" ? Math.floor(input.explicitStage) : stageByDay,
    0,
    TRIBE_LOYALTY_STAGE_COUNT,
  );

  const points = stage * TRIBE_LOYALTY_STAGE_BONUS;
  const nextStageDay =
    stage >= TRIBE_LOYALTY_STAGE_COUNT
      ? null
      : Math.ceil(GAME_BALANCE_CONSTANTS.worldDays / TRIBE_LOYALTY_STAGE_COUNT) * (stage + 1);

  return {
    stage,
    points,
    nextStageDay,
  };
}

export type ResonanceState = {
  currentTicks: number; // 0 to 4
  resonancePct: number; // 0 to 100
};

/**
 * Calculates the next state of Social Resonance.
 * Every 100% resonancePct triggers 1 tick.
 * When reaching 4 ticks, the player harvests +50 Influence.
 * This creates the "4-tick heartbeat" dynamic for social progress.
 */
export function processSocialResonance(state: ResonanceState, deltaResonance: number): ResonanceState & { influenceHarvest: number } {
  let nextPct = state.resonancePct + deltaResonance;
  let nextTicks = state.currentTicks;
  let influenceHarvest = 0;

  while (nextPct >= 100) {
    nextPct -= 100;
    nextTicks += 1;
  }

  if (nextTicks >= 4) {
    nextTicks = 0;
    influenceHarvest = 50;
  }

  return {
    currentTicks: nextTicks,
    resonancePct: nextPct,
    influenceHarvest,
  };
}

export function calculateSovereigntyScore(input: SovereigntyScoreInput): SovereigntyScoreBreakdown {
  if (input.kingAlive === false) {
    const loyalty = calculateTribeLoyaltyProgress({
      currentDay: input.currentDay,
      hasTribeDome: input.hasTribeDome,
      kingAlive: input.kingAlive,
      explicitStage: input.tribeLoyaltyStage,
    });

    return {
      buildingLevels: 0,
      militaryRanking: 0,
      heroesCouncil: 0,
      eraQuests: 0,
      wonders: 0,
      tribeDome: 0,
      areas: [
        { id: "production", current: 0, max: SOVEREIGNTY_AREA_MAX_BY_ID.production },
        { id: "government", current: 0, max: SOVEREIGNTY_AREA_MAX_BY_ID.government },
        { id: "military", current: 0, max: SOVEREIGNTY_AREA_MAX_BY_ID.military },
        { id: "society", current: 0, max: SOVEREIGNTY_AREA_MAX_BY_ID.society },
        { id: "legacy", current: 0, max: SOVEREIGNTY_AREA_MAX_BY_ID.legacy },
      ],
      tribeLoyaltyStage: loyalty.stage,
      tribeLoyaltyNextDay: loyalty.nextStageDay,
      total: 0,
      max: SOVEREIGNTY_SCORE_MAX,
      portalCut: SOVEREIGNTY_PORTAL_CUT,
      portalEligible: false,
    };
  }

  const officialAreas = calculateOfficialSovereigntyAreas(input);
  if (officialAreas) {
    const areaById = Object.fromEntries(officialAreas.map((area) => [area.id, area.current])) as Record<SovereigntyAreaId, number>;
    const loyalty = calculateTribeLoyaltyProgress({
      currentDay: input.currentDay,
      hasTribeDome: input.hasTribeDome,
      kingAlive: input.kingAlive,
      explicitStage: input.tribeLoyaltyStage,
    });
    const total = clamp(
      officialAreas.reduce((sum, area) => sum + area.current, 0),
      0,
      SOVEREIGNTY_SCORE_MAX,
    );

    return {
      buildingLevels: areaById.production,
      militaryRanking: areaById.military,
      heroesCouncil: areaById.government,
      eraQuests: areaById.legacy,
      wonders: areaById.society,
      tribeDome: 0,
      areas: officialAreas,
      tribeLoyaltyStage: loyalty.stage,
      tribeLoyaltyNextDay: loyalty.nextStageDay,
      total,
      max: SOVEREIGNTY_SCORE_MAX,
      portalCut: SOVEREIGNTY_PORTAL_CUT,
      portalEligible: total >= SOVEREIGNTY_PORTAL_CUT,
    };
  }

  const cappedDevelopments = input.villageDevelopments.slice(0, 10);
  const buildingLevels = clamp(
    round(cappedDevelopments.reduce((acc, value) => acc + calculateVillageInfluencePoints(value), 0)),
    0,
    1000,
  );

  const militaryRanking = clamp(round(input.militaryRankingPoints), 0, SOVEREIGNTY_MILITARY_SCORE_CAP);
  const heroesCouncil = clamp(Math.floor(input.councilHeroes), 0, 10) * 50;
  const questCount = clamp(Math.floor(input.eraQuestsCompleted ?? 0), 0, 3);
  const wonderCount = clamp(Math.floor(input.wondersControlled ?? 0), 0, 5);
  const satisfactionRatio = clamp(input.senateSatisfaction ?? 0, 0, 100) / 100;
  const populationFillRatio =
    input.populationCapacity && input.populationCapacity > 0
      ? clamp(input.populationCurrent ?? 0, 0, input.populationCapacity) / input.populationCapacity
      : 0;
  const employmentRatio =
    input.populationCurrent && input.populationCurrent > 0
      ? clamp(input.employedPopulation ?? 0, 0, input.populationCurrent) / input.populationCurrent
      : 0;
  const averageDevelopment =
    cappedDevelopments.length > 0 ? cappedDevelopments.reduce((sum, value) => sum + value, 0) / cappedDevelopments.length : 0;
  const stabilityRatio = clamp(averageDevelopment / 100, 0, 1);
  const loyalty = calculateTribeLoyaltyProgress({
    currentDay: input.currentDay,
    hasTribeDome: input.hasTribeDome,
    kingAlive: input.kingAlive,
    explicitStage: input.tribeLoyaltyStage,
  });
  const society = clamp(
    round(satisfactionRatio * 130 + populationFillRatio * 90 + employmentRatio * 80 + stabilityRatio * 50),
    0,
    SOVEREIGNTY_AREA_MAX_BY_ID.society,
  );
  const eraQuests = clamp(
    round((questCount / 3) * 100) + clamp(wonderCount, 0, 2) * 50 + loyalty.stage * TRIBE_LOYALTY_STAGE_BONUS,
    0,
    SOVEREIGNTY_AREA_MAX_BY_ID.legacy,
  );
  const wonders = society;
  const tribeDome = 0;

  const total = clamp(
    buildingLevels + militaryRanking + heroesCouncil + society + eraQuests,
    0,
    SOVEREIGNTY_SCORE_MAX,
  );

  return {
    buildingLevels,
    militaryRanking,
    heroesCouncil,
    eraQuests,
    wonders,
    tribeDome,
    areas: [
      { id: "production", current: buildingLevels, max: 1000 },
      { id: "government", current: heroesCouncil, max: 500 },
      { id: "military", current: militaryRanking, max: SOVEREIGNTY_MILITARY_SCORE_CAP },
      { id: "society", current: society, max: SOVEREIGNTY_AREA_MAX_BY_ID.society },
      { id: "legacy", current: eraQuests, max: SOVEREIGNTY_AREA_MAX_BY_ID.legacy },
    ],
    tribeLoyaltyStage: loyalty.stage,
    tribeLoyaltyNextDay: loyalty.nextStageDay,
    total,
    max: SOVEREIGNTY_SCORE_MAX,
    portalCut: SOVEREIGNTY_PORTAL_CUT,
    portalEligible: total >= SOVEREIGNTY_PORTAL_CUT,
  };
}

export function canEnterPortal(score: number | SovereigntyScoreBreakdown): boolean {
  const resolved = typeof score === "number" ? score : score.total;
  return resolved >= SOVEREIGNTY_PORTAL_CUT;
}

export type OutcomeDecisionKey =
  | "capitalArchetype"
  | "buildArchitecture"
  | "expansionTiming"
  | "occupationChallenge"
  | "officerGarrison"
  | "militaryEfficiency"
  | "tribeSovereignty"
  | "questManagement"
  | "finalExodus"
  | "hordeResilience";

export type OutcomeDecisionInput = Partial<Record<OutcomeDecisionKey, number>>;

export type OutcomeDecisionWeight = {
  key: OutcomeDecisionKey;
  label: string;
  weight: number;
};

export const OUTCOME_DECISION_WEIGHTS: ReadonlyArray<OutcomeDecisionWeight> = [
  { key: "capitalArchetype", label: "Arquetipo de Capital", weight: 180 },
  { key: "buildArchitecture", label: "Arquitetura de Construcao", weight: 320 },
  { key: "expansionTiming", label: "Timing de Expansao", weight: 260 },
  { key: "occupationChallenge", label: "Desafio de Ocupacao", weight: 260 },
  { key: "officerGarrison", label: "Guarnicao de Oficiais", weight: 180 },
  { key: "militaryEfficiency", label: "Eficacia Militar", weight: 420 },
  { key: "tribeSovereignty", label: "Soberania de Tribo", weight: 180 },
  { key: "questManagement", label: "Gestao de Quests", weight: 220 },
  { key: "finalExodus", label: "Exodo Final", weight: 280 },
  { key: "hordeResilience", label: "Resiliencia de Horda", weight: 200 },
] as const;

export type OutcomeDecisionBreakdown = {
  key: OutcomeDecisionKey;
  label: string;
  weight: number;
  value01: number;
  points: number;
  efficiencyPercent: number;
};

export type OutcomePathBreakdown = {
  infraPath: number;
  militaryPath: number;
  leadershipPath: number;
};

export type OutcomeScoreBreakdown = {
  total: number;
  max: number;
  portalCut: number;
  portalEligible: boolean;
  byDecision: OutcomeDecisionBreakdown[];
  byPath: OutcomePathBreakdown;
};

function normalizeDecisionValue(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return clamp(raw, 0, 1);
}

export function calculateOutcomeScore(input: OutcomeDecisionInput): OutcomeScoreBreakdown {
  const byDecision = OUTCOME_DECISION_WEIGHTS.map((entry) => {
    const value01 = normalizeDecisionValue(input[entry.key]);
    const points = Math.round(entry.weight * value01);
    return {
      key: entry.key,
      label: entry.label,
      weight: entry.weight,
      value01,
      points,
      efficiencyPercent: Math.round(value01 * 100),
    };
  });

  const totalRaw = byDecision.reduce((acc, row) => acc + row.points, 0);
  const total = clamp(totalRaw, 0, SOVEREIGNTY_SCORE_MAX);

  const pick = (key: OutcomeDecisionKey) => byDecision.find((row) => row.key === key)?.points ?? 0;
  const byPath = {
    infraPath:
      pick("capitalArchetype") +
      pick("buildArchitecture") +
      pick("expansionTiming") +
      pick("hordeResilience"),
    militaryPath:
      pick("occupationChallenge") +
      pick("militaryEfficiency") +
      pick("finalExodus"),
    leadershipPath:
      pick("officerGarrison") + pick("tribeSovereignty") + pick("questManagement"),
  };

  return {
    total,
    max: SOVEREIGNTY_SCORE_MAX,
    portalCut: SOVEREIGNTY_PORTAL_CUT,
    portalEligible: total >= SOVEREIGNTY_PORTAL_CUT,
    byDecision,
    byPath,
  };
}

export type OutcomeScenario = {
  villageDevelopments: number[];
  militaryRankingPoints: number;
  councilHeroes: number;
  eraQuestsCompleted: number;
  wondersControlled: number;
  currentDay: number;
  hasTribeDome: boolean;
  activeVillageCount: number;
  underAttackVillageCount: number;
  totalVillageCap?: number;
};

export function deriveOutcomeDecisionInput(scenario: OutcomeScenario): OutcomeDecisionInput {
  const totalVillageCap = Math.max(1, scenario.totalVillageCap ?? 10);
  const averageDevelopment =
    scenario.villageDevelopments.length > 0
      ? scenario.villageDevelopments.reduce((acc, value) => acc + clamp(value, 0, 100), 0) / scenario.villageDevelopments.length
      : 0;
  const developedVillages = scenario.villageDevelopments.filter((value) => value >= 70).length;

  const expansionRatio = clamp(scenario.activeVillageCount / totalVillageCap, 0, 1);
  const attackPressure = scenario.activeVillageCount > 0 ? scenario.underAttackVillageCount / scenario.activeVillageCount : 0;
  const developmentRatio = clamp(averageDevelopment / 100, 0, 1);
  const militaryRatio = clamp(scenario.militaryRankingPoints / SOVEREIGNTY_MILITARY_SCORE_CAP, 0, 1);
  const wonderRatio = clamp(scenario.wondersControlled / 5, 0, 1);
  const questRatio = clamp(scenario.eraQuestsCompleted / 3, 0, 1);
  const resilienceRatio = clamp(1 - attackPressure, 0, 1);
  const expansionMaturity = clamp(developedVillages / totalVillageCap, 0, 1);

  return {
    capitalArchetype: clamp(developmentRatio * 0.58 + wonderRatio * 0.42, 0, 1),
    buildArchitecture: clamp(developmentRatio * 0.9 + expansionMaturity * 0.1, 0, 1),
    expansionTiming: clamp(expansionRatio * 0.78 + expansionMaturity * 0.22, 0, 1),
    occupationChallenge: clamp(militaryRatio * 0.78 + wonderRatio * 0.22, 0, 1),
    officerGarrison: clamp(scenario.councilHeroes / 5, 0, 1),
    militaryEfficiency: clamp(militaryRatio * 0.62 + questRatio * 0.23 + wonderRatio * 0.15, 0, 1),
    tribeSovereignty: scenario.hasTribeDome ? 1 : 0,
    questManagement: clamp(questRatio * 0.85 + wonderRatio * 0.15, 0, 1),
    finalExodus:
      scenario.currentDay < 91
        ? clamp(expansionRatio * 0.48 + militaryRatio * 0.22 + resilienceRatio * 0.3, 0, 1)
        : clamp(resilienceRatio * 0.72 + militaryRatio * 0.18 + questRatio * 0.1, 0, 1),
    hordeResilience: clamp(resilienceRatio * 0.82 + developmentRatio * 0.18, 0, 1),
  };
}
export function calculateResearchCadenceDays(adaptability: number): number {
  return clamp(6 - Math.floor(adaptability * 4), 2, 6);
}

export function calculateResearchCost(
  currentLevel: number,
  options: ResearchCostOptions = {},
): ResearchCost {
  const materials =
    (380 + currentLevel * 120) *
    safeMultiplier(options.materialsMultiplier) *
    safeMultiplier(options.terrainCostMultiplier);
  const influence =
    (70 + currentLevel * 25) *
    safeMultiplier(options.influenceMultiplier) *
    safeMultiplier(options.terrainCostMultiplier);
  return {
    materials: round(materials),
    influence: round(influence),
  };
}

export function calculateExpansionCap(
  governanceStructureLevel: number,
  governanceResearchLevel: number,
  adaptability: number,
): number {
  const rawCap = 1 + Math.floor((governanceStructureLevel + governanceResearchLevel + adaptability * 6) / 2.4);
  return clamp(rawCap, 1, 10);
}

export function calculateExpansionInfluenceCost(
  villages: number,
  expansionInfluenceMultiplier = 1,
  terrainCostMultiplier = 1,
): number {
  const safeVillages = Math.max(1, Math.floor(villages));
  const linearCost = 150 + safeVillages * 30;
  const latePressure = safeVillages > 6 ? (safeVillages - 6) ** 2 * 22 : 0;

  return round(
    (linearCost + latePressure) *
    safeMultiplier(expansionInfluenceMultiplier) *
    safeMultiplier(terrainCostMultiplier),
  );
}

export function calculateDailyEconomy(input: DailyEconomyInput): DailyEconomyResult {
  const terrainProductionMultiplier = safeMultiplier(input.terrainProductionMultiplier);
  const upkeepMult = safeMultiplier(input.upkeepMult);
  const catastrophe = input.catastrophe ?? {};

  const productionBase = {
    materials:
      input.villages *
      (180 + input.structures.economy * 26 + input.research.economy * 15) *
      (0.86 + input.traits.economyFocus * 0.52),
    supplies:
      input.villages *
      (160 + input.structures.economy * 21 + input.research.economy * 12) *
      (0.88 + input.traits.economyFocus * 0.47),
    influence:
      input.villages *
      (22 + input.structures.governance * 4 + input.research.governance * 3) *
      (0.76 + input.traits.quality * 0.34),
  };

  let materials = productionBase.materials * terrainProductionMultiplier;
  let supplies = productionBase.supplies * terrainProductionMultiplier;
  let upkeep =
    (input.villages * 42 + input.troops.offense * 0.052 + input.troops.defense * 0.047) *
    upkeepMult;

  materials *= safeMultiplier(catastrophe.materialsMult);
  supplies *= safeMultiplier(catastrophe.suppliesMult);
  upkeep *= safeMultiplier(catastrophe.upkeepMult);

  if (input.activeProtocol === "focus_supply") {
    supplies *= 1.22;
    materials *= 0.92;
  }

  let materialsStock = input.resources.materials + round(materials);
  let suppliesStock = input.resources.supplies + round(supplies - upkeep);

  let supplyPenaltyRatio = 0;
  let offenseMultiplierAfterPenalty = 1;
  let defenseMultiplierAfterPenalty = 1;

  if (suppliesStock < 0) {
    supplyPenaltyRatio = clamp(Math.abs(suppliesStock) / 2200, 0.05, 0.28);
    offenseMultiplierAfterPenalty *= 1 - supplyPenaltyRatio;
    defenseMultiplierAfterPenalty *= 1 - supplyPenaltyRatio * 0.85;
    suppliesStock = 0;
  }

  return {
    production: {
      materials: round(materials),
      supplies: round(supplies),
      influence: 0,
    },
    upkeep: round(upkeep),
    stocksAfterTick: {
      materials: Math.max(0, materialsStock),
      supplies: Math.max(0, suppliesStock),
      influence: 0,
    },
    supplyPenaltyRatio,
    offenseMultiplierAfterPenalty,
    defenseMultiplierAfterPenalty,
  };
}

export function calculateCityDailyProduction(input: CityDailyProductionInput): CityDailyProductionResult {
  const government = getVillageGovernmentLevel(input.levels);
  const production = getVillageProductionLevel(input.levels);
  const society = getVillageSocietyLevel(input.levels);
  const recruitment = getVillageRecruitmentLevel(input.levels);
  const defense = getVillageDefenseLevel(input.levels);

  const economyDots = sanitizeCitySkillDots(input.economySkillDots);
  const societyDots = sanitizeCitySkillDots(input.societySkillDots);
  const crownDots = sanitizeCitySkillDots(input.crownSkillDots);

  const workers: Record<CityProductionFocusId, number> = {
    materials: clamp(Math.floor(input.productionWorkers?.materials ?? 0), 0, 100),
    supplies: clamp(Math.floor(input.productionWorkers?.supplies ?? 0), 0, 100),
    commerce: clamp(Math.floor(input.productionWorkers?.commerce ?? 0), 0, 100),
    logistics: clamp(Math.floor(input.productionWorkers?.logistics ?? 0), 0, 100),
  };
  const jobs: Record<CitySocietyJobId, number> = {
    medics: clamp(Math.floor(input.jobs?.medics ?? 0), 0, 100),
    crafts: clamp(Math.floor(input.jobs?.crafts ?? 0), 0, 100),
    order: clamp(Math.floor(input.jobs?.order ?? 0), 0, 100),
    scholars: clamp(Math.floor(input.jobs?.scholars ?? 0), 0, 100),
  };

  const cityClass = resolveCityClassYieldModifiers(input.cityClass);
  const terrain = resolveTerrainYieldModifiers(input.terrainKind);
  const hero = resolveHeroYieldModifiers(input.heroBuild);
  const societyState = calculateCitySocietyState({
    cityClass: input.cityClass,
    terrainKind: input.terrainKind,
    heroBuild: input.heroBuild,
    levels: input.levels,
    societySkillDots: input.societySkillDots,
    productionWorkers: workers,
    jobs,
    populationCurrent: input.populationCurrent,
    underAttack: input.underAttack,
    kingSatisfactionDelta: input.kingSatisfactionDelta,
    kingCrisisRiskDelta: input.kingCrisisRiskDelta,
  });

  const focusMaterials = input.productionFocus === "materials" ? 1.12 : 1;
  const focusSupplies = input.productionFocus === "supplies" ? 1.12 : 1;
  const focusInfluence = input.productionFocus === "commerce" ? 1.12 : 1;
  const focusLogistics = input.productionFocus === "logistics" ? 1.14 : 1;
  const societyFocusStability = input.societyFocus === "medics" || input.societyFocus === "order" ? 1.08 : 1;
  const societyFocusInfluence = input.societyFocus === "scholars" ? 1.08 : 1;

  const populationPressure =
    typeof input.populationCurrent === "number" && input.populationCurrent > 0
      ? clamp(input.populationCurrent / Math.max(10, calculateVillagePopulationCap(input.levels)), 0.55, 1)
      : 1;
  const attackPressure = input.underAttack ? 0.92 : 1;
  const kingResourceProduction = safeMultiplier(input.kingResourceProductionMultiplier);
  const worldResourceSpeed = safeMultiplier(input.worldSpeedMultiplier);

  const baseMaterials = 30 + production * 8 + economyDots.a * 6 + jobs.crafts * 0.8;
  const baseSupplies = 28 + production * 7 + economyDots.b * 6 + jobs.medics * 0.3;
  const baseInfluence = 10 + government * 4 + crownDots.a * 2 + crownDots.b * 3 + jobs.scholars * 0.7 + jobs.order * 0.5;
  const baseLogistics = 6 + production * 2 + economyDots.d * 2 + workers.logistics * 0.8;
  const baseStability =
    42 +
    society * 5 +
    defense * 2 +
    societyDots.c * 4 +
    jobs.medics * 1.2 +
    jobs.order * 1.5 -
    workers.commerce * 0.35 -
    workers.logistics * 0.15;

  const materials =
    (baseMaterials + workers.materials * (6 + production * 0.4) + workers.logistics * 0.8) *
    (1 + economyDots.a * 0.03) *
    cityClass.materials *
    terrain.materials *
    hero.materials *
    focusMaterials *
    kingResourceProduction *
    worldResourceSpeed *
    populationPressure *
    attackPressure *
    societyState.productionMultiplier;
  const supplies =
    (baseSupplies + workers.supplies * (6 + production * 0.35) + workers.logistics * 0.5) *
    (1 + economyDots.b * 0.03) *
    cityClass.supplies *
    terrain.supplies *
    hero.supplies *
    focusSupplies *
    kingResourceProduction *
    worldResourceSpeed *
    populationPressure *
    attackPressure *
    societyState.productionMultiplier;
  const influence =
    (baseInfluence + workers.commerce * (1.8 + production * 0.12) + jobs.scholars * 0.8 + jobs.order * 0.35) *
    (1 + economyDots.c * 0.04 + crownDots.a * 0.02 + crownDots.b * 0.015) *
    cityClass.influence *
    terrain.influence *
    hero.influence *
    focusInfluence *
    societyFocusInfluence *
    attackPressure *
    (0.92 + societyState.satisfaction / 125);
  const logistics =
    (baseLogistics + workers.logistics * (1.1 + production * 0.1) + jobs.crafts * 0.25) *
    cityClass.logistics *
    terrain.logistics *
    hero.logistics *
    focusLogistics *
    kingResourceProduction *
    worldResourceSpeed *
    societyState.productionMultiplier;
  const stability = societyState.satisfaction;

  return {
    materials: round(materials),
    supplies: round(supplies),
    influence: round(influence),
    logistics: round(logistics),
    stability: clamp(round(stability), 0, 100),
    breakdown: {
      cityClass: cityClass.label,
      terrain: terrain.label,
      sectors: {
        government,
        production,
        society,
        recruitment,
        defense,
      },
      workers,
      jobs,
      modifiers: {
        materials: round(cityClass.materials * terrain.materials * hero.materials * focusMaterials * kingResourceProduction * worldResourceSpeed * 100) / 100,
        supplies: round(cityClass.supplies * terrain.supplies * hero.supplies * focusSupplies * kingResourceProduction * worldResourceSpeed * 100) / 100,
        influence: round(cityClass.influence * terrain.influence * hero.influence * focusInfluence * societyFocusInfluence * 100) / 100,
        logistics: round(cityClass.logistics * terrain.logistics * hero.logistics * focusLogistics * kingResourceProduction * worldResourceSpeed * 100) / 100,
        stability: round(cityClass.stability * terrain.stability * hero.stability * societyFocusStability * 100) / 100,
      },
    },
  };
}

export function calculateAttackChance(input: AttackChanceInput): number {
  const phaseBase = input.phase === "phase_1" ? 0.05 : 0.028;
  const aggressionScale = input.phase === "phase_1" ? 0.12 : 0.08;
  const humanBonus = input.isHuman ? 0.01 : 0;
  const terrainCombat = safeMultiplier(input.terrainCombatMultiplier);
  const aggressionMult = safeMultiplier(input.aggressionMultiplier);

  const chanceRaw =
    (phaseBase + input.aggression * aggressionScale * aggressionMult + humanBonus) * terrainCombat;
  return clamp(chanceRaw, 0, 0.22);
}

export function calculateAttackForce(input: AttackForceInput): { commit: number; force: number } {
  const commit = clamp(
    0.35 + input.aggression * 0.28 + (input.hasGeneral ? 0.04 : 0),
    0.35,
    0.78,
  );

  const forceMultiplier =
    1 +
    input.researchArmyLevel * 0.018 +
    (input.hasWarLeader ? 0.14 : 0) +
    (input.hasHero ? 0.05 : 0);

  const terrainCombat = safeMultiplier(input.terrainCombatMultiplier);
  const force = input.offense * commit * forceMultiplier * terrainCombat;
  return { commit, force };
}

export function calculateDefenseForce(input: DefenseForceInput): { commit: number; force: number } {
  const commit = input.targetSite === "capital" ? 0.58 : 0.38;
  const siteFactor = input.targetSite === "capital" ? 1.16 : 0.94;
  const baseMultiplier =
    1 +
    input.structuresDefenseLevel * 0.02 +
    input.researchArmyLevel * 0.015 +
    (input.hasHero ? 0.12 : 0);

  const wall = safeMultiplier(input.wallDefenseMultiplier);
  const tribe = safeMultiplier(input.tribeDefenseMultiplier);
  const terrainCombat = safeMultiplier(input.terrainCombatMultiplier);
  const focusDefense = input.focusDefenseActive ? 1.22 : 1;

  const force =
    input.defense *
    commit *
    baseMultiplier *
    siteFactor *
    wall *
    tribe *
    terrainCombat *
    focusDefense;

  return { commit, force };
}

export function resolveCombat(forces: CombatForces): CombatResolution {
  if (forces.attackForce > forces.defenseForce) {
    const casualtyRatio = clamp(forces.defenseForce / Math.max(1, forces.attackForce), 0.08, 0.92);
    return {
      winner: "attacker",
      attackerLossRatio: clamp(forces.attackerCommit * casualtyRatio * 0.55, 0, 0.98),
      defenderLossRatio: clamp(forces.defenderCommit * 0.72, 0, 0.98),
    };
  }

  const casualtyRatio = clamp(forces.attackForce / Math.max(1, forces.defenseForce), 0.08, 0.85);
  return {
    winner: "defender",
    attackerLossRatio: clamp(forces.attackerCommit * 0.75, 0, 0.98),
    defenderLossRatio: clamp(forces.defenderCommit * casualtyRatio * 0.28, 0, 0.98),
  };
}

export function calculateMarchTimeMinutes(
  from: AxialCoord,
  to: AxialCoord,
  options: MarchOptions,
): MarchTime {
  const hexDistance = axialDistance(from, to);
  const baseMove = options.baseMoveMinutes ?? GAME_BALANCE_CONSTANTS.baseMoveTimeMinutes;
  const roadMove = options.roadMoveMinutes ?? GAME_BALANCE_CONSTANTS.roadMoveTimeMinutes;
  const minutesPerHex =
    (options.hasRoad ? roadMove : baseMove) * safeMultiplier(options.terrainMovementMultiplier);
  const totalMinutes = round(hexDistance * minutesPerHex);

  return {
    hexDistance,
    minutesPerHex,
    totalMinutes: Math.max(0, totalMinutes),
  };
}

export type Phase4EtaInput = {
  hexDistance: number;
  roadCoverage: number;
  hasNavigator: boolean;
  hasFlowBranch: boolean;
  hasIntendente?: boolean;
};

export function calculatePhase4MarchEtaHours(input: Phase4EtaInput): number {
  const distance = Math.max(1, Math.floor(input.hexDistance));
  const coverage = clamp(input.roadCoverage, 0, 1);

  const minutesPerHex =
    GAME_BALANCE_CONSTANTS.baseMoveTimeMinutes * (1 - coverage) +
    GAME_BALANCE_CONSTANTS.roadMoveTimeMinutes * coverage;

  let totalHours =
    (distance * minutesPerHex * GAME_BALANCE_CONSTANTS.phase4LogisticsMultiplier) / 60;

  if (input.hasNavigator && input.hasFlowBranch) {
    const specialistBase = 54 - (input.hasIntendente ? 2 : 0);
    return clamp(
      Math.round(specialistBase * 100) / 100,
      GAME_BALANCE_CONSTANTS.etaSpecialistMinHours,
      GAME_BALANCE_CONSTANTS.etaSpecialistMaxHours,
    );
  }

  if (input.hasNavigator) totalHours *= 0.76;
  if (input.hasFlowBranch) totalHours *= 0.81;
  if (input.hasIntendente) totalHours *= 0.9;

  return Math.max(1, Math.round(totalHours * 100) / 100);
}

export type MapConstructionType = "outpost" | "road";

export type MapConstructionOptions = TerrainModifiers & {
  distanceFromNetwork: number;
  logisticsLevel?: number;
  ownedVillages?: number;
  targetKind?: "empty" | "hotspot" | "abandoned_city" | "frontier_ruins";
};

export type MapConstructionCost = {
  materials: number;
  influence: number;
  buildMinutes: number;
};

export function calculateMapConstructionCost(
  construction: MapConstructionType,
  options: MapConstructionOptions,
): MapConstructionCost {
  const distance = Math.max(0, Math.floor(options.distanceFromNetwork));
  const logisticsLevel = Math.max(0, options.logisticsLevel ?? 0);
  const ownedVillages = Math.max(1, Math.floor(options.ownedVillages ?? 1));
  const terrainCost = safeMultiplier(options.terrainCostMultiplier);
  const terrainTime = safeMultiplier(options.terrainTimeMultiplier);
  const logisticsDiscount = clamp(1 - logisticsLevel * 0.015, 0.72, 1);
  const targetKind = options.targetKind ?? "empty";
  // Fundar do ZERO (terra vazia) = caminho BUDGET sem exército (custa 0 tropa).
  // Conquistar dá infra pronta mas custa um exército; por isso fundar leva
  // desconto p/ ser a entrada barata (calibragem #3: fundar ~ fração do esforço
  // de conquistar uma cidade equivalente). frontier_ruins segue mais barato.
  const targetDiscount =
    targetKind === "frontier_ruins"
      ? 0.78
      : targetKind === "empty"
        ? 0.85
        : targetKind === "hotspot"
          ? 0.9
          : targetKind === "abandoned_city"
            ? 1.06
            : 1;

  const base =
    construction === "road"
      ? { materials: 170, influence: 0, minutes: 11, distanceGrowth: 1.05 }
      : { materials: 1820, influence: 0, minutes: 38, distanceGrowth: 1.12 };

  const distanceScalar = base.distanceGrowth ** distance;

  if (construction === "outpost") {
    const expansionPressure = 1 + Math.max(0, ownedVillages - 1) * 0.16;
    const influencePressure = calculateExpansionInfluenceCost(ownedVillages, 1.08, terrainCost);

    return {
      materials: round(base.materials * distanceScalar * terrainCost * logisticsDiscount * expansionPressure * targetDiscount),
      influence: round((influencePressure + distance * 18) * targetDiscount),
      buildMinutes: Math.max(1, round(base.minutes * distanceScalar * terrainTime * logisticsDiscount * (0.92 + ownedVillages * 0.05))),
    };
  }

  return {
    materials: round(base.materials * distanceScalar * terrainCost * logisticsDiscount),
    influence: round(base.influence * distanceScalar * terrainCost),
    buildMinutes: Math.max(1, round(base.minutes * distanceScalar * terrainTime * logisticsDiscount)),
  };
}

export type SpyOperationOptions = TerrainModifiers & {
  hexDistance: number;
  spyMasteryLevel?: number;
};

export type SpyOperationCost = {
  influence: number;
  prepMinutes: number;
};

export function calculateSpyOperationCost(options: SpyOperationOptions): SpyOperationCost {
  const hexDistance = Math.max(1, Math.floor(options.hexDistance));
  const mastery = Math.max(0, options.spyMasteryLevel ?? 0);
  const terrainCost = safeMultiplier(options.terrainCostMultiplier);
  const terrainTime = safeMultiplier(options.terrainTimeMultiplier);
  const masteryDiscount = clamp(1 - mastery * 0.02, 0.6, 1);

  return {
    influence: round((52 + hexDistance * 9) * terrainCost * masteryDiscount),
    prepMinutes: Math.max(1, round((8 + hexDistance * 1.8) * terrainTime * masteryDiscount)),
  };
}

export type BarracksRosterPreview = {
  militia: number;
  shooters: number;
  scouts: number;
  machinery: number;
};

export function calculateBarracksRosterPreview(barracksLevel: number): BarracksRosterPreview {
  return {
    militia: 120 + barracksLevel * 10,
    shooters: 70 + barracksLevel * 7,
    scouts: 40 + barracksLevel * 5,
    machinery: 10 + Math.floor(barracksLevel * 1.8),
  };
}

export type LegacySliceBuildingCurve = {
  level: number;
  baseCost: {
    materials: number;
    influence: number;
  };
  baseTimeMin: number;
  curve: number;
};

export type LegacySliceUpgradeCost = {
  materials: number;
  influence: number;
  timeMin: number;
};

export function calculateLegacySliceUpgradeCost(
  building: LegacySliceBuildingCurve,
  options: TerrainModifiers = {},
): LegacySliceUpgradeCost {
  const factor = building.curve ** Math.max(0, building.level - 1);
  const costMult = safeMultiplier(options.terrainCostMultiplier);
  const timeMult = safeMultiplier(options.terrainTimeMultiplier);

  return {
    materials: round(building.baseCost.materials * factor * costMult),
    influence: round(building.baseCost.influence * factor * costMult),
    timeMin: Math.max(6, round(building.baseTimeMin * factor * timeMult)),
  };
}

export function calculateLegacySliceInfluenceCap(palaceLevel: number): number {
  return palaceLevel * 100 + 400;
}

export type LegacySliceEconomyInput = {
  resources: EconomyResources;
  palaceLevel: number;
  bastionLevel: number;
  arsenalLevel: number;
  roadsLevel: number;
};

export type LegacySliceEconomyResult = {
  nextResources: EconomyResources;
  income: EconomyResources;
  upkeep: number;
  influenceCap: number;
};

export function calculateLegacySliceEconomyTick(input: LegacySliceEconomyInput): LegacySliceEconomyResult {
  const income = {
    materials: 210 + input.palaceLevel * 9 + input.roadsLevel * 4,
    supplies: 185 + input.palaceLevel * 5 + input.roadsLevel * 3,
    influence: 0,
  };

  const upkeep = 92 + input.arsenalLevel * 7 + input.bastionLevel * 4;
  const influenceCap = calculateLegacySliceInfluenceCap(input.palaceLevel);

  return {
    nextResources: {
      materials: Math.max(0, input.resources.materials + income.materials),
      supplies: Math.max(0, input.resources.supplies + income.supplies - upkeep),
      influence: 0,
    },
    income,
    upkeep,
    influenceCap,
  };
}
