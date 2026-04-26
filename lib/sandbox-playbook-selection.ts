import { calculateVillageDevelopment } from "@/core/GameBalance";
import type { ImperialState } from "@/lib/imperial-state";
import type { VillageSummary, WorldState } from "@/lib/mock-data";
import type { SandboxStrategyId } from "@/lib/sandbox-playbooks";

type PlaybookSelectionInput = {
  currentDay: number;
  villages: VillageSummary[];
  activeVillageId?: string;
  world?: WorldState;
  imperialState?: ImperialState;
  questsCompleted?: number;
  wondersControlled?: number;
};

type StrategyScoreMap = Record<SandboxStrategyId, number>;

const STRATEGY_IDS: SandboxStrategyId[] = ["metropole", "posto_avancado", "bastiao", "celeiro"];

function emptyScores(): StrategyScoreMap {
  return {
    metropole: 0,
    posto_avancado: 0,
    bastiao: 0,
    celeiro: 0,
  };
}

function clampResources(value: number): number {
  return Math.max(0, Math.min(4, value));
}

export function inferSandboxStrategyId({
  currentDay,
  villages,
  activeVillageId,
  imperialState,
  questsCompleted,
  wondersControlled,
}: PlaybookSelectionInput): SandboxStrategyId {
  const explicitStrategy = imperialState?.sandboxStrategyId;
  if (explicitStrategy) {
    return explicitStrategy;
  }

  const scores = emptyScores();
  const activeVillage = villages.find((village) => village.id === activeVillageId) ?? villages[0];
  const capital = villages.find((village) => village.type === "Capital") ?? activeVillage;
  const totalVillages = villages.length;
  const totalMaterials = villages.reduce((sum, village) => sum + village.materials, 0);
  const totalSupplies = villages.reduce((sum, village) => sum + village.supplies, 0);
  const totalInfluence = villages.reduce((sum, village) => sum + village.influence, 0);
  const highestDevelopment = villages.reduce(
    (best, village) => Math.max(best, calculateVillageDevelopment(village.buildingLevels)),
    0,
  );
  const underAttackCount = villages.filter((village) => village.underAttack).length;
  const avg = (selector: (village: VillageSummary) => number) =>
    villages.length > 0 ? villages.reduce((sum, village) => sum + selector(village), 0) / villages.length : 0;

  for (const village of villages) {
    if (village.cityClass === "metropole") scores.metropole += 5;
    if (village.cityClass === "posto_avancado") scores.posto_avancado += 5;
    if (village.cityClass === "bastiao") scores.bastiao += 5;
    if (village.cityClass === "celeiro") scores.celeiro += 5;
  }

  if (capital?.cityClass === "metropole") scores.metropole += 8;
  if (capital?.cityClass === "posto_avancado") scores.posto_avancado += 8;
  if (capital?.cityClass === "bastiao") scores.bastiao += 8;
  if (capital?.cityClass === "celeiro") scores.celeiro += 8;

  if (activeVillage?.cityClass === "metropole") scores.metropole += 4;
  if (activeVillage?.cityClass === "posto_avancado") scores.posto_avancado += 4;
  if (activeVillage?.cityClass === "bastiao") scores.bastiao += 4;
  if (activeVillage?.cityClass === "celeiro") scores.celeiro += 4;

  scores.metropole += avg((village) => village.buildingLevels.palace ?? 0) * 1.2;
  scores.metropole += avg((village) => village.buildingLevels.senate ?? 0) * 1.1;
  scores.metropole += avg((village) => village.buildingLevels.research ?? 0) * 0.9;
  scores.metropole += highestDevelopment / 20;
  scores.metropole += (wondersControlled ?? 0) * 2.8;

  scores.posto_avancado += avg((village) => village.buildingLevels.barracks ?? 0) * 1.4;
  scores.posto_avancado += avg((village) => village.buildingLevels.arsenal ?? 0) * 1.4;
  scores.posto_avancado += totalVillages >= 4 ? 2 : 0;
  scores.posto_avancado += currentDay <= 60 ? 1.2 : 0.2;

  scores.bastiao += avg((village) => village.buildingLevels.wall ?? 0) * 1.6;
  scores.bastiao += avg((village) => village.buildingLevels.housing ?? 0) * 0.8;
  scores.bastiao += underAttackCount * 1.6;
  scores.bastiao += currentDay >= 60 ? 1.4 : 0.3;

  scores.celeiro += avg((village) => village.buildingLevels.farms ?? 0) * 1.4;
  scores.celeiro += avg((village) => village.buildingLevels.housing ?? 0) * 0.8;
  scores.celeiro += avg((village) => village.buildingLevels.research ?? 0) * 0.6;
  scores.celeiro += clampResources(totalSupplies / 6000);
  scores.celeiro += clampResources(totalMaterials / 9000) * 0.5;
  scores.celeiro += currentDay <= 45 ? 1.2 : 0.4;

  scores.metropole += clampResources(totalInfluence / 5000);
  scores.posto_avancado += questsCompleted ? questsCompleted * 0.5 : 0;
  scores.bastiao += totalVillages >= 6 ? 0.7 : 0;
  scores.celeiro += totalVillages >= 5 ? 0.6 : 0;

  return STRATEGY_IDS.sort((left, right) => scores[right] - scores[left])[0] ?? "metropole";
}
