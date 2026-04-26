﻿"use client";

import {
  calculateVillageDevelopment,
  getVillageDefenseLevel,
  getVillageGovernmentLevel,
  getVillageProductionLevel,
  getVillageRecruitmentLevel,
  getVillageSocietyLevel,
  type SovereigntyScoreBreakdown,
} from "@/core/GameBalance";
import type { BuildingId } from "@/lib/buildings";
import type { HeroSpecialistId } from "@/lib/council";
import type { CityClass } from "@/lib/cities";
import type { VillageSummary } from "@/lib/mock-data";

export type InfluenceAreaId = "production" | "government" | "military" | "society" | "legacy";
export type InfluenceAreaTone = "amber" | "cyan" | "rose" | "emerald" | "violet";

export type WorkforceFocusId = "treasury" | "supply" | "forge" | "watch" | "lore";
export type DragonChoice = "none" | "fire" | "ice";
export type MilitaryTechId =
  | "conscription"
  | "scouts"
  | "wall_doctrine"
  | "supply_lines"
  | "siegecraft"
  | "war_banners"
  | "shock_cavalry"
  | "field_medicine"
  | "dragon_fire"
  | "dragon_ice";

export type WorkforceAllocations = Record<WorkforceFocusId, number>;
export type MilitaryTechTree = Record<MilitaryTechId, number>;

export type InfluenceAreaSummary = {
  id: InfluenceAreaId;
  label: string;
  tone: InfluenceAreaTone;
  current: number;
  max: number;
  short: string;
  detail: string;
};

export type MilitaryTechMeta = {
  id: MilitaryTechId;
  label: string;
  branch: "base" | "advanced" | "capstone";
  summary: string;
  requires?: MilitaryTechId[];
  dragon?: DragonChoice;
};

export const WORKFORCE_META: Record<
  WorkforceFocusId,
  {
    label: string;
    area: InfluenceAreaId;
    summary: string;
  }
> = {
  treasury: {
    label: "Tesouro",
    area: "government",
    summary: "Segura caixa, tributos e as obras que precisam chegar ate o fim.",
  },
  supply: {
    label: "Abastecimento",
    area: "production",
    summary: "Empurra mantimentos, comboios e a respiracao longa da campanha.",
  },
  forge: {
    label: "Forja",
    area: "military",
    summary: "Converte estrutura em tropa, armas e tracao de guerra.",
  },
  watch: {
    label: "Vigilancia",
    area: "society",
    summary: "Segura ordem, muralha viva e resposta nas cidades pressionadas.",
  },
  lore: {
    label: "Memoria",
    area: "legacy",
    summary: "Segura memoria imperial, leitura de mundo e fechamentos de run.",
  },
};

export const HERO_META: Record<
  HeroSpecialistId,
  {
    label: string;
    summary: string;
  }
> = {
  engineer: {
    label: "Engenheiro",
    summary: "Acelera obras, aumenta margem de construcao e ajuda cidades 100/100.",
  },
  marshal: {
    label: "General",
    summary: "Melhora ataque, moral e desempenho em combate.",
  },
  navigator: {
    label: "Explorador",
    summary: "Revela mapa, abre rotas e reduz tempo de deslocamento.",
  },
  intendente: {
    label: "Administrador",
    summary: "Organiza suprimentos, comboios e fluxo interno do imperio.",
  },
  erudite: {
    label: "Sabio",
    summary: "Acelera pesquisa, doutrina, leitura do mundo e legado.",
  },
};

export const MILITARY_TECHS: MilitaryTechMeta[] = [
  {
    id: "conscription",
    label: "Conscricao Imperial",
    branch: "base",
    summary: "Aumenta o folego da infantaria e estabiliza os primeiros lotes.",
  },
  {
    id: "scouts",
    label: "Batedores de Fronteira",
    branch: "base",
    summary: "Lanca visao, leitura de mapa e abertura de flancos.",
  },
  {
    id: "wall_doctrine",
    label: "Doutrina de Muralha",
    branch: "base",
    summary: "Transforma defesa local em tempo ganho para o reino.",
  },
  {
    id: "supply_lines",
    label: "Linhas de Suprimento",
    branch: "advanced",
    summary: "Segura campanha longa e reduz o colapso logÃ­stico no meio do mundo.",
    requires: ["conscription"],
  },
  {
    id: "siegecraft",
    label: "Engenhos de Cerco",
    branch: "advanced",
    summary: "Destrava peso real de ruptura contra muralhas e cidades fechadas.",
    requires: ["scouts"],
  },
  {
    id: "war_banners",
    label: "Estandartes de Guerra",
    branch: "advanced",
    summary: "Organiza a legiao e empurra comando em marcha grande.",
    requires: ["wall_doctrine"],
  },
  {
    id: "shock_cavalry",
    label: "Cavalaria de Choque",
    branch: "advanced",
    summary: "Cria aceleraÃ§Ã£o ofensiva para saques, corte e perseguiÃ§Ã£o.",
    requires: ["supply_lines"],
  },
  {
    id: "field_medicine",
    label: "Medicina de Campanha",
    branch: "advanced",
    summary: "Segura perdas, volta de destacamentos e respiro depois do impacto.",
    requires: ["war_banners"],
  },
  {
    id: "dragon_fire",
    label: "Dragao de Fogo",
    branch: "capstone",
    summary: "Capstone ofensivo. Rasga linha, pressiona cidade e fecha o lado mais brutal da arvore.",
    requires: ["shock_cavalry", "siegecraft", "field_medicine"],
    dragon: "fire",
  },
  {
    id: "dragon_ice",
    label: "Dragao de Gelo",
    branch: "capstone",
    summary: "Capstone defensivo. Congela avanÃ§o, segura impacto e fecha o lado mais frio da arvore.",
    requires: ["shock_cavalry", "siegecraft", "field_medicine"],
    dragon: "ice",
  },
];

export const DEFAULT_WORKFORCE_ALLOCATIONS: WorkforceAllocations = {
  treasury: 2,
  supply: 2,
  forge: 2,
  watch: 2,
  lore: 2,
};

export const EMPTY_MILITARY_TECH_TREE: MilitaryTechTree = {
  conscription: 0,
  scouts: 0,
  wall_doctrine: 0,
  supply_lines: 0,
  siegecraft: 0,
  war_banners: 0,
  shock_cavalry: 0,
  field_medicine: 0,
  dragon_fire: 0,
  dragon_ice: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getTotalWorkforce(allocations: WorkforceAllocations): number {
  return Object.values(allocations).reduce((sum, value) => sum + clamp(Math.floor(value), 0, 10), 0);
}

export function normalizeWorkforceAllocations(value: unknown): WorkforceAllocations {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_WORKFORCE_ALLOCATIONS };
  }

  const raw = value as Partial<Record<WorkforceFocusId, unknown>>;
  const next: WorkforceAllocations = {
    treasury: clamp(Math.floor(Number(raw.treasury) || 0), 0, 10),
    supply: clamp(Math.floor(Number(raw.supply) || 0), 0, 10),
    forge: clamp(Math.floor(Number(raw.forge) || 0), 0, 10),
    watch: clamp(Math.floor(Number(raw.watch) || 0), 0, 10),
    lore: clamp(Math.floor(Number(raw.lore) || 0), 0, 10),
  };

  const total = getTotalWorkforce(next);
  if (total === 10) {
    return next;
  }

  if (total <= 0) {
    return { ...DEFAULT_WORKFORCE_ALLOCATIONS };
  }

  const ratio = 10 / total;
  const scaled: WorkforceAllocations = {
    treasury: clamp(Math.round(next.treasury * ratio), 0, 10),
    supply: clamp(Math.round(next.supply * ratio), 0, 10),
    forge: clamp(Math.round(next.forge * ratio), 0, 10),
    watch: clamp(Math.round(next.watch * ratio), 0, 10),
    lore: clamp(Math.round(next.lore * ratio), 0, 10),
  };

  let remainder = 10 - getTotalWorkforce(scaled);
  const ids = Object.keys(WORKFORCE_META) as WorkforceFocusId[];
  let index = 0;
  while (remainder !== 0 && index < 100) {
    const id = ids[index % ids.length];
    if (remainder > 0 && scaled[id] < 10) {
      scaled[id] += 1;
      remainder -= 1;
    } else if (remainder < 0 && scaled[id] > 0) {
      scaled[id] -= 1;
      remainder += 1;
    }
    index += 1;
  }

  return scaled;
}

export function normalizeMilitaryTechTree(value: unknown): MilitaryTechTree {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_MILITARY_TECH_TREE };
  }

  const raw = value as Partial<Record<MilitaryTechId, unknown>>;
  return {
    conscription: raw.conscription ? 1 : 0,
    scouts: raw.scouts ? 1 : 0,
    wall_doctrine: raw.wall_doctrine ? 1 : 0,
    supply_lines: raw.supply_lines ? 1 : 0,
    siegecraft: raw.siegecraft ? 1 : 0,
    war_banners: raw.war_banners ? 1 : 0,
    shock_cavalry: raw.shock_cavalry ? 1 : 0,
    field_medicine: raw.field_medicine ? 1 : 0,
    dragon_fire: raw.dragon_fire ? 1 : 0,
    dragon_ice: raw.dragon_ice ? 1 : 0,
  };
}

export function countUnlockedMilitaryTechs(tree: MilitaryTechTree): number {
  return Object.values(tree).reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

export function findCapital(villages: VillageSummary[]): VillageSummary | null {
  return villages.find((village) => village.type === "Capital") ?? villages[0] ?? null;
}

export function getCapitalTechPoints(villages: VillageSummary[]): number {
  const capital = findCapital(villages);
  if (!capital) return 0;
  return getVillageRecruitmentLevel(capital.buildingLevels);
}

export function canUnlockMilitaryTech(input: {
  id: MilitaryTechId;
  tree: MilitaryTechTree;
  villages: VillageSummary[];
  dragonChoice: DragonChoice;
}): boolean {
  const meta = MILITARY_TECHS.find((entry) => entry.id === input.id);
  if (!meta) return false;
  if (input.tree[input.id]) return false;

  const availablePoints = getCapitalTechPoints(input.villages) - countUnlockedMilitaryTechs(input.tree);
  if (availablePoints <= 0) return false;

  if (meta.requires?.some((requiredId) => !input.tree[requiredId])) {
    return false;
  }

  if (meta.dragon === "fire" && (input.dragonChoice === "ice" || input.tree.dragon_ice)) {
    return false;
  }

  if (meta.dragon === "ice" && (input.dragonChoice === "fire" || input.tree.dragon_fire)) {
    return false;
  }

  return true;
}

function countAssignedHeroes(heroByVillage: Record<string, string | "none">): number {
  return Object.values(heroByVillage).filter((heroId) => heroId && heroId !== "none").length;
}

function countUnderAttack(villages: VillageSummary[]): number {
  return villages.filter((village) => village.underAttack).length;
}

function countClosedCities(villages: VillageSummary[]): number {
  return villages.filter((village) => calculateVillageDevelopment(village.buildingLevels) >= 100).length;
}

function averageSectorLevel(villages: VillageSummary[], resolver: (levels: VillageSummary["buildingLevels"]) => number): number {
  if (villages.length <= 0) return 0;
  const sum = villages.reduce((acc, village) => {
    return acc + resolver(village.buildingLevels);
  }, 0);
  return sum / villages.length;
}

function totalSectorLevel(villages: VillageSummary[], resolver: (levels: VillageSummary["buildingLevels"]) => number): number {
  return villages.reduce((sum, village) => {
    return sum + resolver(village.buildingLevels);
  }, 0);
}

function developmentAverage(villages: VillageSummary[]): number {
  if (villages.length <= 0) return 0;
  return (
    villages.reduce((sum, village) => sum + calculateVillageDevelopment(village.buildingLevels), 0) /
    villages.length
  );
}

export function buildInfluenceAreas(input: {
  villages: VillageSummary[];
  workforce: WorkforceAllocations;
  militaryTechTree: MilitaryTechTree;
  heroByVillage: Record<string, string | "none">;
  councilHeroes: number;
  questsCompleted: number;
  wondersControlled: number;
  tribeStage: number;
  score: SovereigntyScoreBreakdown;
  dragonChoice: DragonChoice;
}): InfluenceAreaSummary[] {
  const villages = input.villages;
  const capital = findCapital(villages);
  const closedCities = countClosedCities(villages);
  const pressuredCities = countUnderAttack(villages);
  const heroCount = Math.max(input.councilHeroes, countAssignedHeroes(input.heroByVillage));
  const techs = countUnlockedMilitaryTechs(input.militaryTechTree);
  const economyAvg = averageSectorLevel(villages, getVillageProductionLevel);
  const societyAvg = averageSectorLevel(villages, getVillageSocietyLevel);
  const warAvg = averageSectorLevel(villages, (levels) => (getVillageRecruitmentLevel(levels) + getVillageDefenseLevel(levels)) / 2);
  const governmentTotal = totalSectorLevel(villages, getVillageGovernmentLevel);
  const economyTotal = totalSectorLevel(villages, getVillageProductionLevel);
  const societyTotal = totalSectorLevel(villages, getVillageSocietyLevel);
  const warTotal = totalSectorLevel(villages, (levels) => getVillageRecruitmentLevel(levels) + getVillageDefenseLevel(levels));
  const area = (id: InfluenceAreaId) => input.score.areas.find((entry) => entry.id === id);
  const areaScore = (id: InfluenceAreaId) => area(id)?.current ?? 0;
  const areaMax = (id: InfluenceAreaId) => area(id)?.max ?? 500;

  return [
    {
      id: "production",
      label: "Infraestrutura",
      tone: "amber",
      current: areaScore("production"),
      max: areaMax("production"),
      short: `Setores ${(governmentTotal + economyTotal + societyTotal + warTotal) * 2}/1000 pts`,
      detail: "Todos os niveis base do reino sobem esta area.",
    },
    {
      id: "government",
      label: "Governo",
      tone: "cyan",
      current: areaScore("government"),
      max: areaMax("government"),
      short: `${heroCount}/10 herois`,
      detail: "Herois vivos e contratados. Cada heroi vale 50 pontos fixos.",
    },
    {
      id: "military",
      label: "Rating militar",
      tone: "rose",
      current: areaScore("military"),
      max: areaMax("military"),
      short: `${techs} doutrinas Â· tropas e defesa`,
      detail: "Forca real de guerra, com ataque e defesa local.",
    },
    {
      id: "society",
      label: "Sociedade",
      tone: "emerald",
      current: areaScore("society"),
      max: areaMax("society"),
      short: `${Math.max(0, villages.length - pressuredCities)}/${villages.length} cidades estaveis`,
      detail: "Satisfacao social, empregos, populacao e estabilidade.",
    },
    {
      id: "legacy",
      label: "Legado",
      tone: "violet",
      current: areaScore("legacy"),
      max: areaMax("legacy"),
      short: `${input.questsCompleted}/3 quests · ${Math.min(input.wondersControlled, 2)}/2 maravilhas`,
      detail: "Quests, ate duas maravilhas e pacto tribal.",
    },
  ];
}

export function getCityClassMix(villages: VillageSummary[]): Array<{ cityClass: CityClass | "neutral"; count: number }> {
  const counters = new Map<CityClass | "neutral", number>();
  for (const village of villages) {
    const key = village.cityClass ?? "neutral";
    counters.set(key, (counters.get(key) ?? 0) + 1);
  }
  return Array.from(counters.entries())
    .map(([cityClass, count]) => ({ cityClass, count }))
    .sort((left, right) => right.count - left.count);
}


