﻿"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Minus, Plus, Swords, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  POPULATION_ALLOCATION_STEP,
  calculateBarracksUnlocks,
  calculateBarracksRosterPreview,
  calculateBuildingUpgradeCost,
  calculateCityDailyProduction,
  calculateCitySocietyState,
  calculateDefensePower,
  calculateVillagePopulationCap,
  calculateVillageDefenseCapacity,
  calculateVillageRecruitCapacity,
  calculateWallDefenseUnlocks,
  calculateVillageConstructionCapacity,
  calculateVillageConstructionLoad,
  calculateVillageConstructionRemaining,
  calculateVillageDevelopment,
  type EvolutionMode,
} from "@/core/GameBalance";
import { BUILDINGS_BY_ID, formatCompact, type BuildingId } from "@/lib/buildings";
import { CITY_CLASS_META, cityClassToArchetype, type CityClass } from "@/lib/cities";
import { HERO_META } from "@/lib/empire-systems";
import {
  projectStructureLevelsToBuildingLevels,
  useImperialStateContext,
  type BuildingSkillSlotId,
  type CityProductionAllocations,
  type CityDefenseRecruitId,
  type CityJobId,
  type CityProductionFocus,
  type CitySocietyFocus,
  type CityStructureId,
  type HeroBuildId,
  type TroopRecruitId,
  type VillageBuildingSkills,
} from "@/lib/imperial-state";
import type { HeroSpecialistId } from "@/lib/council";
import { resolveKingGameplayModifiers } from "@/lib/king-profiles";
import type { ResearchEntry, TimelineEntry, VillageSummary } from "@/lib/mock-data";
import { emitUiFeedback } from "@/lib/ui-feedback";
import {
  BUILDING_SKILL_META,
  BUILDING_SKILL_SLOT_IDS,
  CITY_CLASS_IDS,
  CITY_CLASS_IMAGE_BY_ID,
  CITY_JOB_IDS,
  CITY_SECTORS,
  DEFENSE_RECRUIT_IDS,
  HERO_BUILD_IDS,
  HERO_BUILD_META,
  HERO_HIRE_COST,
  HERO_PROMOTION_IDS,
  HERO_PROMOTION_LIMIT,
  HERO_PROMOTION_META,
  LOCAL_COMMAND_META,
  PRODUCTION_FOCUS_META,
  PRODUCTION_WORKER_IDS,
  SECTOR_IMAGE_BY_ID,
  SOCIETY_FOCUS_META,
  TROOP_RECRUIT_IDS,
  CostChip,
  canAfford,
  canAffordSkillUpgrade,
  cityCardTone,
  cityClassTone,
  clamp,
  defaultSkillDots,
  defenseDelta,
  describeLevelGain,
  emptyCityDefenseRecruits,
  emptyCityJobs,
  emptyCityRecruits,
  emptyProductionWorkers,
  getSectorById,
  jobDelta,
  productionWorkerDelta,
  recruitDelta,
  resolveSectorFromBuilding,
  resolveSectorSkillDots,
  SECTOR_ICON_BY_ID,
  sectorCircleTone,
  sectorLuxuryTone,
  sectorPanelImage,
  skillNodePalette,
  skillNodeTone,
  sumValues,
  totalSkillDots,
  traitNodeTone,
  type BuildingSkillMeta,
  type CitySector,
  type PendingSkillUpgrade,
  type PopulationAction,
  type ResourceView,
  type SectorId,
  type TraitOption,
} from "./village-scene-config";
import type { LocalCommand } from "./village-scene-types";

type VillageSceneProps = {
  worldId: string;
  villages: Pick<VillageSummary, "id" | "materials" | "supplies" | "influence" | "buildingLevels">[];
  village: Pick<
    VillageSummary,
    | "id"
    | "name"
    | "type"
    | "cityClass"
    | "cityClassLocked"
    | "terrainKind"
    | "terrainLabel"
    | "materials"
    | "supplies"
    | "influence"
    | "underAttack"
    | "deficits"
    | "palaceLevel"
    | "buildingLevels"
  >;
  readOnly?: boolean;
  researchEntries: ResearchEntry[];
  timelineEntries: TimelineEntry[];
  evolutionMode: EvolutionMode;
  localCommand: LocalCommand;
  worldSpeedMultiplier?: number;
  initialSelectedSectorId?: SectorId | null;
  initialSelectedBuildingId?: BuildingId | null;
};

function levelIconSrc(level: number) {
  const normalized = clamp(Math.floor(level), 0, 10).toString().padStart(2, "0");
  return `/icons/${normalized}.png`;
}

function LevelMedallion({
  level,
  className = "",
  iconClassName = "h-full w-full",
}: {
  level: number;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <img
      src={levelIconSrc(level)}
      alt={`Nível ${level}`}
      className={`${iconClassName} max-w-none object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.72)]`}
    />
  );
}

function TraitTree({
  rootLabel,
  rootNote,
  options,
}: {
  rootLabel: string;
  rootNote?: string;
  options: TraitOption[];
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="mx-auto flex w-fit flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/12" />
        <p className="mt-2 text-sm font-black text-slate-100">{rootLabel}</p>
        {rootNote ? <p className="mt-1 text-[11px] text-slate-300">{rootNote}</p> : null}
      </div>
      <div className="relative mt-3">
        <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-white/12" />
        <div className="absolute left-[25%] right-[25%] top-4 h-px bg-white/12" />
        <div className="grid grid-cols-2 gap-2 pt-5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={option.onClick}
              disabled={option.disabled}
              className={`rounded-2xl border p-3 text-left transition disabled:opacity-50 ${traitNodeTone(option.active)}`}
            >
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 h-8 w-8 rounded-full border ${option.active ? "border-cyan-300/40 bg-cyan-500/18" : "border-white/12 bg-white/6"}`} />
                <div>
                  <p className="text-[11px] font-black">{option.label}</p>
                  {option.note ? <p className="mt-1 text-[10px] leading-4 opacity-90">{option.note}</p> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function AllocationCard({
  label,
  value,
  note,
  delta,
  tone,
  disabled = false,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  note?: string;
  delta?: string;
  tone: "amber" | "emerald" | "rose" | "cyan";
  disabled?: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const plusTone =
    tone === "amber"
      ? "border-amber-300/30 bg-amber-500/12 text-amber-100"
      : tone === "emerald"
        ? "border-emerald-300/30 bg-emerald-500/12 text-emerald-100"
        : tone === "rose"
          ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
          : "border-cyan-300/30 bg-cyan-500/12 text-cyan-100";

  return (
    <div className={`rounded-2xl border p-2.5 ${disabled ? "border-white/8 bg-white/[0.03] opacity-60" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-black text-slate-100">{label}</p>
          {note ? <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{note}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-xl border border-white/12 bg-white/8 px-2.5 py-1 text-sm font-black text-slate-100">{value}</span>
          {delta ? <p className="mt-1 text-[10px] font-black text-cyan-100">{delta}</p> : null}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-[44px_1fr_44px] items-center gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={disabled || !canDecrease}
          className="flex h-11 items-center justify-center rounded-xl border border-white/12 bg-white/7 text-slate-100 transition disabled:opacity-35"
          aria-label={`Reduzir ${label}`}
        >
          <Minus className="h-5 w-5" />
        </button>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${Math.min(100, value)}%` }} />
        </div>
        <button
          type="button"
          onClick={onIncrease}
          disabled={disabled || !canIncrease}
          className={`flex h-11 items-center justify-center rounded-xl border transition disabled:opacity-35 ${plusTone}`}
          aria-label={`Aumentar ${label}`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function VillageScene({
  worldId,
  villages,
  village,
  readOnly = false,
  researchEntries,
  timelineEntries,
  evolutionMode,
  localCommand,
  worldSpeedMultiplier = 1,
  initialSelectedSectorId = null,
  initialSelectedBuildingId = null,
}: VillageSceneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [opsLog, setOpsLog] = useState<string[]>([]);
  const [showHeroPromotionOptions, setShowHeroPromotionOptions] = useState(false);
  const [selectedHeroBuild, setSelectedHeroBuild] = useState<HeroBuildId>("leadership");
  const [pendingSkillUpgrade, setPendingSkillUpgrade] = useState<PendingSkillUpgrade | null>(null);
  const { imperialState, setImperialState } = useImperialStateContext();
  const resources = imperialState.resources;
  const villageLevelOverrides = imperialState.buildingLevelsByVillage[village.id] ?? {};
  const projectedVillageLevelOverrides = useMemo(
    () => projectStructureLevelsToBuildingLevels(villageLevelOverrides),
    [villageLevelOverrides],
  );
  const villageBuildingSkills = imperialState.buildingSkillsByVillage[village.id] ?? {};
  const assignedHero = imperialState.heroByVillage[village.id] ?? "none";
  const heroBuild = imperialState.heroBuildByVillage[village.id] ?? selectedHeroBuild;
  const hiredHeroCount = Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length;
  const hasEngineer = assignedHero === "engineer";
  const isCapitalVillage = village.type === "Capital";
  const rawCityClass = imperialState.cityClassByVillage[village.id] ?? village.cityClass ?? "neutral";
  const cityClass = isCapitalVillage ? "neutral" : rawCityClass;
  const cityClassLocked = isCapitalVillage ? true : (imperialState.cityClassLockedByVillage[village.id] ?? village.cityClassLocked ?? cityClass !== "neutral");
  const canChooseCityClass = !isCapitalVillage && !cityClassLocked;
  const productionFocus = imperialState.productionFocusByVillage[village.id] ?? "materials";
  const societyFocus = imperialState.societyFocusByVillage[village.id] ?? "order";

  const levels = useMemo(() => {
    const next = { ...village.buildingLevels } as Record<BuildingId, number>;
    for (const id of Object.keys(BUILDINGS_BY_ID) as BuildingId[]) {
      const hardCap = BUILDINGS_BY_ID[id].maxLevel;
      next[id] = clamp(Math.floor(village.buildingLevels[id] ?? 0), 0, hardCap);
    }
    for (const [id, level] of Object.entries(projectedVillageLevelOverrides)) {
      const key = id as BuildingId;
      const definition = BUILDINGS_BY_ID[key];
      if (!definition || typeof level !== "number") continue;
      next[key] = clamp(Math.floor(level), 0, definition.maxLevel);
    }
    for (const sector of CITY_SECTORS) {
      const dots = villageBuildingSkills[sector.id];
      if (!dots) continue;
      const skillLevel = totalSkillDots(dots);
      if (skillLevel <= 0) continue;
      for (const formulaBuildingId of sector.formulaBuildingIds) {
        next[formulaBuildingId] = clamp(skillLevel, 0, BUILDINGS_BY_ID[formulaBuildingId].maxLevel);
      }
    }
    return next;
  }, [projectedVillageLevelOverrides, village.buildingLevels, villageBuildingSkills]);

  const currentVillageDevelopment = useMemo(() => calculateVillageDevelopment(levels), [levels]);
  const populationCap = useMemo(() => calculateVillagePopulationCap(levels), [levels]);
  const recruitCapacity = useMemo(() => calculateVillageRecruitCapacity(levels), [levels]);
  const defenseCapacity = useMemo(() => calculateVillageDefenseCapacity(levels), [levels]);
  const barracksUnlocks = useMemo(() => calculateBarracksUnlocks(levels), [levels]);
  const wallDefenseUnlocks = useMemo(() => calculateWallDefenseUnlocks(levels), [levels]);
  const baseVillageDevelopment = useMemo(
    () => calculateVillageDevelopment(levels),
    [levels],
  );
  const constructionCapacity = useMemo(() => calculateVillageConstructionCapacity(levels, hasEngineer), [hasEngineer, levels]);
  const constructionLoad = useMemo(() => calculateVillageConstructionLoad(levels), [levels]);
  const constructionRemaining = useMemo(() => calculateVillageConstructionRemaining(levels, hasEngineer), [hasEngineer, levels]);
  const localResources = useMemo<ResourceView>(
    () => ({
      materials: village.materials,
      supplies: village.supplies,
      influence: village.influence,
    }),
    [village.influence, village.materials, village.supplies],
  );
  const rosterPreview = useMemo(() => calculateBarracksRosterPreview(levels.barracks ?? 0), [levels.barracks]);
  const productionWorkers = imperialState.productionWorkersByVillage[village.id] ?? emptyProductionWorkers();
  const jobs = imperialState.jobsByVillage[village.id] ?? emptyCityJobs();
  const recruits = imperialState.recruitsByVillage[village.id] ?? emptyCityRecruits();
  const defenseRecruits = imperialState.defenseRecruitsByVillage[village.id] ?? emptyCityDefenseRecruits();
  const usedProductionWorkers = sumValues(productionWorkers);
  const usedJobs = sumValues(jobs);
  const usedRecruits = sumValues(recruits);
  const usedDefenders = sumValues(defenseRecruits);
  const usedPopulation = usedProductionWorkers + usedJobs + usedRecruits + usedDefenders;
  const populationCurrent = clamp(
    imperialState.populationByVillage[village.id] ?? Math.min(populationCap, Math.max(0, populationCap)),
    usedPopulation,
    populationCap,
  );
  const freePopulation = Math.max(0, populationCurrent - usedPopulation);
  const empirePopulationCapacity = useMemo(
    () =>
      villages.reduce((sum, entry) => {
        const mergedLevels = {
          ...entry.buildingLevels,
          ...projectStructureLevelsToBuildingLevels(imperialState.buildingLevelsByVillage[entry.id] ?? {}),
        };
        return sum + calculateVillagePopulationCap(mergedLevels);
      }, 0),
    [imperialState.buildingLevelsByVillage, villages],
  );
  const empirePopulationCurrent = useMemo(
    () =>
      villages.reduce((sum, entry) => {
        const mergedLevels = {
          ...entry.buildingLevels,
          ...projectStructureLevelsToBuildingLevels(imperialState.buildingLevelsByVillage[entry.id] ?? {}),
        };
        const villageCap = calculateVillagePopulationCap(mergedLevels);
        const entryProductionWorkers = imperialState.productionWorkersByVillage[entry.id] ?? emptyProductionWorkers();
        const entryJobs = imperialState.jobsByVillage[entry.id] ?? emptyCityJobs();
        const entryRecruits = imperialState.recruitsByVillage[entry.id] ?? emptyCityRecruits();
        const entryDefenders = imperialState.defenseRecruitsByVillage[entry.id] ?? emptyCityDefenseRecruits();
        const minimumUsed = sumValues(entryProductionWorkers) + sumValues(entryJobs) + sumValues(entryRecruits) + sumValues(entryDefenders);
        const current = clamp(imperialState.populationByVillage[entry.id] ?? villageCap, minimumUsed, villageCap);
        return sum + current;
      }, 0),
    [
      imperialState.buildingLevelsByVillage,
      imperialState.defenseRecruitsByVillage,
      imperialState.jobsByVillage,
      imperialState.populationByVillage,
      imperialState.productionWorkersByVillage,
      imperialState.recruitsByVillage,
      villages,
    ],
  );
  const empirePopulationUsed = useMemo(
    () =>
      villages.reduce((sum, entry) => {
        const entryJobs = imperialState.jobsByVillage[entry.id] ?? emptyCityJobs();
        const entryProductionWorkers = imperialState.productionWorkersByVillage[entry.id] ?? emptyProductionWorkers();
        const entryRecruits = imperialState.recruitsByVillage[entry.id] ?? emptyCityRecruits();
        const entryDefenders = imperialState.defenseRecruitsByVillage[entry.id] ?? emptyCityDefenseRecruits();
        return sum + sumValues(entryProductionWorkers) + sumValues(entryJobs) + sumValues(entryRecruits) + sumValues(entryDefenders);
      }, 0),
    [imperialState.defenseRecruitsByVillage, imperialState.jobsByVillage, imperialState.productionWorkersByVillage, imperialState.recruitsByVillage, villages],
  );
  const selectedSectorId = initialSelectedSectorId ?? resolveSectorFromBuilding(initialSelectedBuildingId);

  const sectorCards = useMemo(
    () =>
      CITY_SECTORS.map((sector) => {
        const skillDots = resolveSectorSkillDots(sector, levels, villageBuildingSkills);
        const level = totalSkillDots(skillDots);
        return {
          ...sector,
          level,
          contribution: level * 2,
          skillDots,
        };
      }),
    [levels, villageBuildingSkills],
  );

  const selectedSector = sectorCards.find((sector) => sector.id === selectedSectorId) ?? null;
  const cityBackdropImage = isCapitalVillage ? "/images/capital.jpg" : CITY_CLASS_IMAGE_BY_ID[cityClass] ?? CITY_CLASS_IMAGE_BY_ID.neutral;
  const governmentLevel = sectorCards.find((sector) => sector.id === "crown")?.level ?? 0;
  const productionLevel = sectorCards.find((sector) => sector.id === "economy")?.level ?? 0;
  const societyLevel = sectorCards.find((sector) => sector.id === "society")?.level ?? 0;
  const recruitmentLevel = sectorCards.find((sector) => sector.id === "recruitment")?.level ?? 0;
  const defenseLevel = sectorCards.find((sector) => sector.id === "defense")?.level ?? 0;
  const productionSkillDots = resolveSectorSkillDots(CITY_SECTORS[1], levels, villageBuildingSkills);
  const societySkillDots = resolveSectorSkillDots(CITY_SECTORS[2], levels, villageBuildingSkills);
  const recruitmentSkillDots = resolveSectorSkillDots(CITY_SECTORS[3], levels, villageBuildingSkills);
  const defenseSkillDots = resolveSectorSkillDots(CITY_SECTORS[4], levels, villageBuildingSkills);
  const kingModifiers = useMemo(() => resolveKingGameplayModifiers(imperialState.kingProfileId), [imperialState.kingProfileId]);
  const productionCapacity = Math.max(0, productionLevel * 10);
  const societyState = useMemo(
    () =>
      calculateCitySocietyState({
        cityClass,
        terrainKind: village.terrainKind,
        heroBuild: assignedHero === "none" ? "none" : heroBuild,
        levels,
        societySkillDots,
        productionWorkers,
        jobs,
        recruitedPopulation: usedRecruits,
        defendedPopulation: usedDefenders,
        populationCurrent,
        underAttack: village.underAttack,
        deficitsCount: village.deficits.length,
        kingSatisfactionDelta: kingModifiers.satisfactionDelta,
        kingCrisisRiskDelta: kingModifiers.crisisRiskDelta,
      }),
    [
      assignedHero,
      cityClass,
      heroBuild,
      jobs,
      kingModifiers,
      levels,
      populationCurrent,
      productionWorkers,
      societySkillDots,
      usedDefenders,
      usedRecruits,
      village.deficits.length,
      village.terrainKind,
      village.underAttack,
    ],
  );

  useEffect(() => {
    setOpsLog([]);
    setShowHeroPromotionOptions(false);
    setSelectedHeroBuild("leadership");
    setPendingSkillUpgrade(null);
  }, [village.id]);

  useEffect(() => {
    if (!selectedSectorId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedSectorId]);

  const pushLog = (line: string) => {
    setOpsLog((current) => [line, ...current].slice(0, 6));
  };

  const blockReadOnly = () => {
    if (!readOnly) {
      return false;
    }
    emitUiFeedback("tap", "light");
    return true;
  };

  const syncSectorQuery = (nextSectorId: SectorId | null) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextSector = getSectorById(nextSectorId);
    if (nextSector) {
      params.set("s", nextSector.id);
      params.delete("b");
    } else {
      setPendingSkillUpgrade(null);
      params.delete("s");
      params.delete("b");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setProductionFocus = (focus: CityProductionFocus) => {
    if (blockReadOnly()) return;
    setImperialState((current) => ({
      ...current,
      productionFocusByVillage: {
        ...current.productionFocusByVillage,
        [village.id]: focus,
      },
      logs: [`${village.name}: Produção focada em ${PRODUCTION_FOCUS_META[focus].label}`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Produção -> ${PRODUCTION_FOCUS_META[focus].label}`);
    emitUiFeedback("tap", "light");
  };

  const adjustProductionWorkers = (focus: CityProductionFocus, delta: number) => {
    if (blockReadOnly()) return;
    const currentValue = productionWorkers[focus] ?? 0;
    const nextValue = Math.max(0, currentValue + delta);
    const nextWorkers = {
      ...productionWorkers,
      [focus]: nextValue,
    };
    const nextProductionUsed = sumValues(nextWorkers);
    if (nextProductionUsed > productionCapacity || nextProductionUsed + usedJobs + usedRecruits + usedDefenders > populationCurrent) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      productionWorkersByVillage: {
        ...current.productionWorkersByVillage,
        [village.id]: nextWorkers,
      },
      productionFocusByVillage: {
        ...current.productionFocusByVillage,
        [village.id]: focus,
      },
      logs: [`${village.name}: ${PRODUCTION_FOCUS_META[focus].label} ${nextValue}`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("tap", "light");
  };

  const setSocietyFocus = (focus: CitySocietyFocus) => {
    if (blockReadOnly()) return;
    setImperialState((current) => ({
      ...current,
      societyFocusByVillage: {
        ...current.societyFocusByVillage,
        [village.id]: focus,
      },
      logs: [`${village.name}: Sociedade focada em ${SOCIETY_FOCUS_META[focus].label}`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Sociedade -> ${SOCIETY_FOCUS_META[focus].label}`);
    emitUiFeedback("tap", "light");
  };

  const chooseCityClass = (nextClass: CityClass) => {
    if (blockReadOnly()) return;
    if (isCapitalVillage) {
      return;
    }
    if (cityClassLocked && nextClass !== cityClass) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      cityClassByVillage: {
        ...current.cityClassByVillage,
        [village.id]: nextClass,
      },
      cityClassLockedByVillage: {
        ...current.cityClassLockedByVillage,
        [village.id]: nextClass !== "neutral",
      },
      logs: [`${village.name}: vocação definida como ${CITY_CLASS_META[nextClass].label}`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Vocação -> ${CITY_CLASS_META[nextClass].label}`);
    emitUiFeedback("open", "medium");
  };

  const adjustPopulation = (action: PopulationAction) => {
    if (blockReadOnly()) return;
    const nextValue =
      action === "grow"
        ? Math.min(populationCap, populationCurrent + POPULATION_ALLOCATION_STEP)
        : Math.max(usedPopulation, populationCurrent - POPULATION_ALLOCATION_STEP);

    if (nextValue === populationCurrent) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      populationByVillage: {
        ...current.populationByVillage,
        [village.id]: nextValue,
      },
      logs: [`${village.name}: populacao ${nextValue}/${populationCap}`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Populacao ${nextValue}/${populationCap}`);
    emitUiFeedback("tap", "light");
  };

  const adjustCityJob = (jobId: CityJobId, delta: number) => {
    if (blockReadOnly()) return;
    const currentValue = jobs[jobId] ?? 0;
    const nextValue = Math.max(0, currentValue + delta);
    const nextJobs = {
      ...jobs,
      [jobId]: nextValue,
    };
    const nextJobsUsed = sumValues(nextJobs);
    if (usedProductionWorkers + nextJobsUsed + usedRecruits + usedDefenders > populationCurrent) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      jobsByVillage: {
        ...current.jobsByVillage,
        [village.id]: nextJobs,
      },
      logs: [`${village.name}: ${SOCIETY_FOCUS_META[jobId].label} ${nextValue}`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("tap", "light");
  };

  const adjustRecruitment = (unitId: TroopRecruitId, delta: number) => {
    if (blockReadOnly()) return;
    const unlocked =
      (unitId === "militia" && barracksUnlocks.militia) ||
      (unitId === "shooters" && barracksUnlocks.shooters) ||
      (unitId === "scouts" && barracksUnlocks.scouts) ||
      (unitId === "machinery" && barracksUnlocks.machinery);
    if (!unlocked) {
      return;
    }

    const currentValue = recruits[unitId] ?? 0;
    const nextValue = Math.max(0, currentValue + delta);
    const nextRecruits = {
      ...recruits,
      [unitId]: nextValue,
    };
    const nextRecruitUsed = sumValues(nextRecruits);
    if (nextRecruitUsed > recruitCapacity || usedProductionWorkers + usedJobs + nextRecruitUsed + usedDefenders > populationCurrent) {
      return;
    }

    const troopKey = unitId;
    const troopDelta = nextValue - currentValue;
    setImperialState((current) => ({
      ...current,
      recruitsByVillage: {
        ...current.recruitsByVillage,
        [village.id]: nextRecruits,
      },
      troops: {
        ...current.troops,
        [troopKey]: Math.max(0, (current.troops[troopKey] ?? 0) + troopDelta),
      },
      logs: [`${village.name}: ${unitId} ${nextValue} enviados para a Capital`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("open", "light");
  };

  const adjustDefenseRecruitment = (unitId: CityDefenseRecruitId, delta: number) => {
    if (blockReadOnly()) return;
    const unlocked =
      (unitId === "guards" && wallDefenseUnlocks.guards) ||
      (unitId === "archers" && wallDefenseUnlocks.archers) ||
      (unitId === "ballistae" && wallDefenseUnlocks.ballistae);
    if (!unlocked) {
      return;
    }

    const currentValue = defenseRecruits[unitId] ?? 0;
    const nextValue = Math.max(0, currentValue + delta);
    const nextDefense = {
      ...defenseRecruits,
      [unitId]: nextValue,
    };
    const nextDefenseUsed = sumValues(nextDefense);
    if (nextDefenseUsed > defenseCapacity || usedProductionWorkers + usedJobs + usedRecruits + nextDefenseUsed > populationCurrent) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      defenseRecruitsByVillage: {
        ...current.defenseRecruitsByVillage,
        [village.id]: nextDefense,
      },
      logs: [`${village.name}: defesa ${unitId} ${nextValue}`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("open", "light");
  };

  const hireHero = (heroId: HeroSpecialistId) => {
    if (blockReadOnly()) return;
    const governmentLevel = levels.palace ?? 0;
    const canHireMore = assignedHero === "none" && hiredHeroCount < HERO_PROMOTION_LIMIT;
    const canAffordHire =
      resources.materials >= HERO_HIRE_COST.materials &&
      resources.supplies >= HERO_HIRE_COST.supplies;

    if (governmentLevel < 4 || !canHireMore || !canAffordHire) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      resources: {
        ...current.resources,
        materials: current.resources.materials - HERO_HIRE_COST.materials,
        supplies: current.resources.supplies - HERO_HIRE_COST.supplies,
      },
      heroByVillage: {
        ...current.heroByVillage,
        [village.id]: heroId,
      },
      heroBuildByVillage: {
        ...current.heroBuildByVillage,
        [village.id]: selectedHeroBuild,
      },
      logs: [`${village.name}: ${HERO_PROMOTION_META[heroId].label} contratado no Governo`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Herói -> ${HERO_PROMOTION_META[heroId].label} / ${HERO_BUILD_META[selectedHeroBuild].label}`);
    emitUiFeedback("open", "medium");
  };

  const changeHeroBuild = (buildId: HeroBuildId) => {
    if (blockReadOnly()) return;
    if (assignedHero === "none") {
      setSelectedHeroBuild(buildId);
      emitUiFeedback("tap", "light");
      return;
    }

    setImperialState((current) => ({
      ...current,
      heroBuildByVillage: {
        ...current.heroBuildByVillage,
        [village.id]: buildId,
      },
      logs: [`${village.name}: build do herói -> ${HERO_BUILD_META[buildId].label}`, ...current.logs].slice(0, 12),
    }));
    pushLog(`Build do herói -> ${HERO_BUILD_META[buildId].label}`);
    emitUiFeedback("tap", "light");
  };

  const getBuildingSkillDots = (sectorId: CityStructureId, currentLevel: number) => {
    return villageBuildingSkills[sectorId] ?? defaultSkillDots(currentLevel);
  };

  const openSkillUpgrade = (buildingId: BuildingId, sectorId: SectorId, option: BuildingSkillMeta) => {
    if (blockReadOnly()) return;
    const sector = getSectorById(sectorId);
    const definition = BUILDINGS_BY_ID[buildingId];
    const current = sector ? totalSkillDots(resolveSectorSkillDots(sector, levels, villageBuildingSkills)) : (levels[buildingId] ?? 0);
    const nextLevel = Math.min(definition.maxLevel, current + 1);
    const atMax = current >= definition.maxLevel;
    const currentDots = getBuildingSkillDots(sectorId, current);
    const currentDotValue = currentDots[option.id] ?? 0;
    const branchMaxed = currentDotValue >= 3;
    const cost = calculateBuildingUpgradeCost(definition, nextLevel, {
      evolutionMode,
      archetype: cityClassToArchetype(cityClass),
      scalarMultiplier: kingModifiers.buildingCostMultiplier,
    });
    if (
      atMax ||
      branchMaxed ||
      !canAffordSkillUpgrade(cost, resources)
    ) {
      return;
    }

    setPendingSkillUpgrade({
      buildingId,
      sectorId,
      sectorLabel: sector?.label ?? definition.name,
      option,
      currentLevel: current,
      currentPoints: currentDotValue,
      nextLevel,
      cost: { materials: cost.materials, supplies: cost.supplies, influence: cost.requiredInfluence },
    });
    emitUiFeedback("tap", "light");
  };

  const confirmSkillUpgrade = () => {
    if (blockReadOnly()) return;
    if (!pendingSkillUpgrade) return;
    const { buildingId, option, currentLevel, currentPoints, sectorId, sectorLabel } = pendingSkillUpgrade;
    const definition = BUILDINGS_BY_ID[buildingId];
    const currentDots = getBuildingSkillDots(sectorId, currentLevel);
    const cost = calculateBuildingUpgradeCost(definition, Math.min(definition.maxLevel, currentLevel + 1), {
      evolutionMode,
      archetype: cityClassToArchetype(cityClass),
      scalarMultiplier: kingModifiers.buildingCostMultiplier,
    });

    if (
      currentLevel >= definition.maxLevel ||
      currentPoints >= 3 ||
      !canAffordSkillUpgrade(cost, resources)
    ) {
      setPendingSkillUpgrade(null);
      return;
    }

    const nextDots = {
      ...currentDots,
      [option.id]: clamp(currentPoints + 1, 0, 3),
    };
    const skillLevel = totalSkillDots(nextDots);
    const sector = getSectorById(sectorId);

    setImperialState((currentState) => ({
      ...currentState,
      buildingSkillsByVillage: {
        ...currentState.buildingSkillsByVillage,
        [village.id]: {
          ...(currentState.buildingSkillsByVillage[village.id] ?? {}),
          [sectorId]: nextDots,
        },
      },
      buildingLevelsByVillage: {
        ...currentState.buildingLevelsByVillage,
        [village.id]: {
          ...(currentState.buildingLevelsByVillage[village.id] ?? {}),
          [sectorId]: skillLevel,
        },
      },
      resources: {
        ...currentState.resources,
        materials: currentState.resources.materials - cost.materials,
        supplies: currentState.resources.supplies - cost.supplies,
      },
      logs: [`${village.name}: ${sectorLabel} -> ${option.label} Nv ${skillLevel}`, ...currentState.logs].slice(0, 12),
    }));
    pushLog(`${sectorLabel}: ${option.label} -> Nv ${skillLevel}`);
    setPendingSkillUpgrade(null);
    emitUiFeedback("open", "medium");
  };
  const canAffordHeroHire =
    resources.materials >= HERO_HIRE_COST.materials &&
    resources.supplies >= HERO_HIRE_COST.supplies;
  const canHireHero = assignedHero === "none" && governmentLevel >= 4 && hiredHeroCount < HERO_PROMOTION_LIMIT && canAffordHeroHire;
  const capitalTroopTotal =
    imperialState.troops.militia + imperialState.troops.shooters + imperialState.troops.scouts + imperialState.troops.machinery;
  const capitalTroopAveragePower =
    capitalTroopTotal > 0
      ? (
          (imperialState.troops.militia * 1 +
            imperialState.troops.shooters * 2 +
            imperialState.troops.scouts * 2 +
            imperialState.troops.machinery * 4) /
          capitalTroopTotal
        ).toFixed(1)
      : "0.0";
  const localDefensePower = calculateDefensePower(defenseRecruits);
  const currentCityYield = useMemo(
    () =>
      calculateCityDailyProduction({
        cityClass,
        terrainKind: village.terrainKind,
        heroBuild: assignedHero === "none" ? "none" : heroBuild,
        productionFocus,
        societyFocus,
        levels,
        productionWorkers,
        jobs,
        crownSkillDots: sectorCards.find((sector) => sector.id === "crown")?.skillDots,
        economySkillDots: productionSkillDots,
        societySkillDots: societySkillDots,
        populationCurrent,
        underAttack: village.underAttack,
        kingResourceProductionMultiplier: kingModifiers.resourceProductionMultiplier,
        kingSatisfactionDelta: kingModifiers.satisfactionDelta,
        kingCrisisRiskDelta: kingModifiers.crisisRiskDelta,
        worldSpeedMultiplier,
      }),
    [
      assignedHero,
      cityClass,
      heroBuild,
      jobs,
      kingModifiers,
      levels,
      populationCurrent,
      productionFocus,
      productionSkillDots,
      productionWorkers,
      sectorCards,
      societyFocus,
      societySkillDots,
      village.terrainKind,
      village.underAttack,
      worldSpeedMultiplier,
    ],
  );

  const formatYieldDelta = (next: ReturnType<typeof calculateCityDailyProduction>) => {
    const materialsDelta = next.materials - currentCityYield.materials;
    const suppliesDelta = next.supplies - currentCityYield.supplies;
    const logisticsDelta = next.logistics - currentCityYield.logistics;
    const stabilityDelta = next.stability - currentCityYield.stability;

    if (materialsDelta > 0) return `+${materialsDelta} M/d`;
    if (suppliesDelta > 0) return `+${suppliesDelta} S/d`;
    if (logisticsDelta > 0) return `+${logisticsDelta} log`;
    if (stabilityDelta > 0) return `+${stabilityDelta} est`;
    if (materialsDelta < 0) return `${materialsDelta} M/d`;
    if (suppliesDelta < 0) return `${suppliesDelta} S/d`;
    if (logisticsDelta < 0) return `${logisticsDelta} log`;
    if (stabilityDelta < 0) return `${stabilityDelta} est`;
    return "sem delta";
  };

  const getProductionWorkerDelta = (focusId: CityProductionFocus) => {
    const nextWorkers = {
      ...productionWorkers,
      [focusId]: productionWorkers[focusId] + POPULATION_ALLOCATION_STEP,
    };
    return formatYieldDelta(
      calculateCityDailyProduction({
        cityClass,
        terrainKind: village.terrainKind,
        heroBuild: assignedHero === "none" ? "none" : heroBuild,
        productionFocus,
        societyFocus,
        levels,
        productionWorkers: nextWorkers,
        jobs,
        crownSkillDots: sectorCards.find((sector) => sector.id === "crown")?.skillDots,
        economySkillDots: productionSkillDots,
        societySkillDots,
        populationCurrent,
        underAttack: village.underAttack,
        kingResourceProductionMultiplier: kingModifiers.resourceProductionMultiplier,
        kingSatisfactionDelta: kingModifiers.satisfactionDelta,
        kingCrisisRiskDelta: kingModifiers.crisisRiskDelta,
        worldSpeedMultiplier,
      }),
    );
  };

  const getJobDelta = (jobId: CityJobId) => {
    const nextJobs = {
      ...jobs,
      [jobId]: jobs[jobId] + POPULATION_ALLOCATION_STEP,
    };
    return formatYieldDelta(
      calculateCityDailyProduction({
        cityClass,
        terrainKind: village.terrainKind,
        heroBuild: assignedHero === "none" ? "none" : heroBuild,
        productionFocus,
        societyFocus,
        levels,
        productionWorkers,
        jobs: nextJobs,
        crownSkillDots: sectorCards.find((sector) => sector.id === "crown")?.skillDots,
        economySkillDots: productionSkillDots,
        societySkillDots,
        populationCurrent,
        underAttack: village.underAttack,
        kingResourceProductionMultiplier: kingModifiers.resourceProductionMultiplier,
        kingSatisfactionDelta: kingModifiers.satisfactionDelta,
        kingCrisisRiskDelta: kingModifiers.crisisRiskDelta,
        worldSpeedMultiplier,
      }),
    );
  };

  const settlementLabel = village.type === "Capital" ? "Capital" : "Cidade";

  return (
    <>
      <section className="space-y-3 md:mx-auto md:max-w-3xl" data-smoke="village-scene">
        <article
          className="relative overflow-hidden rounded-[28px] border border-white/14 px-3 py-2.5 text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.3)]"
          style={{
            backgroundImage: `linear-gradient(110deg, rgba(2,6,23,0.72), rgba(15,23,42,0.4) 56%, rgba(2,6,23,0.74)), url('${cityBackdropImage}')`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/78 via-slate-950/38 to-slate-950/24" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">{settlementLabel}</p>
            <p className="mt-1 text-[clamp(1.1rem,3.9vw,1.5rem)] font-black leading-tight text-slate-50">{village.name}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-300">
              {isCapitalVillage ? "A Capital é uma categoria própria do reino." : canChooseCityClass ? "Escolha a vocação da cidade uma vez." : "Vocação fixa desta cidade."}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isCapitalVillage ? (
                <span className="rounded-full border border-cyan-300/35 bg-cyan-500/14 px-3 py-1.5 text-[10px] font-black text-cyan-100">
                  Capital
                </span>
              ) : (
                CITY_CLASS_IDS.map((classId) => {
                  const active = classId === cityClass;
                  const disabled = !canChooseCityClass && !active;
                  return (
                    <button
                      key={classId}
                      type="button"
                      onClick={() => chooseCityClass(classId)}
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-black transition disabled:opacity-45 ${
                        active
                          ? `${cityClassTone(classId)} shadow-[0_0_18px_rgba(255,255,255,0.08)]`
                          : "border-white/14 bg-white/8 text-slate-200 hover:bg-white/12"
                      }`}
                    >
                      {CITY_CLASS_META[classId].label}
                    </button>
                  );
                })
              )}
            </div>
            <p className="mt-1.5 max-w-[85%] text-[10px] font-semibold text-slate-400">
              {isCapitalVillage ? "Centro político do reino. Governo, heróis e pressão imperial nascem daqui." : CITY_CLASS_META[cityClass].summary}
            </p>
          </div>
        </article>

        {readOnly ? (
          <article className="rounded-[24px] border border-amber-300/30 bg-amber-500/12 px-3 py-2 text-[11px] font-semibold text-amber-100 shadow-[0_12px_32px_rgba(120,53,15,0.18)]">
            Temporada encerrada. Esta cidade segue em modo leitura.
          </article>
        ) : null}

        <article className="kw-glass rounded-[28px] p-3">
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
            {sectorCards.map((sector) => (
              <button
                key={sector.id}
                type="button"
                data-smoke={`city-sector-${sector.id}`}
                onClick={() => {
                  emitUiFeedback("open", "light");
                  syncSectorQuery(sector.id);
                }}
                className={`relative w-full overflow-hidden rounded-[24px] border p-3 text-left transition ${cityCardTone(sector.tone)} ${
                  selectedSector?.id === sector.id ? "shadow-[0_0_28px_rgba(103,232,249,0.14)]" : "hover:bg-white/8"
                }`}
                style={{
                  backgroundImage: `linear-gradient(100deg, rgba(2,6,23,0.74), rgba(15,23,42,0.46) 54%, rgba(2,6,23,0.76)), url('${sectorPanelImage(sector.id, cityClass, isCapitalVillage)}')`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/78 via-slate-950/36 to-slate-950/22" />
                <div
                  className="absolute inset-y-0 right-0 w-[42%] opacity-60"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(2,6,23,0) 0%, rgba(2,6,23,0.06) 24%, rgba(2,6,23,0.42) 100%), url('${sectorPanelImage(sector.id, cityClass, isCapitalVillage)}')`,
                    backgroundPosition: "center right",
                    backgroundSize: "cover",
                  }}
                />
                <div className="relative flex items-center gap-3">
                  <div className={`kw-hud-medallion flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${sectorCircleTone(sector.id)}`}>
                    <img src={SECTOR_ICON_BY_ID[sector.id]} alt="" className="h-14 w-14 max-w-none object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-slate-100">{sector.label}</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-300">{totalSkillDots(sector.skillDots)}/10 pontos na build</p>
                  </div>
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border border-white/18 bg-slate-950/36 text-center backdrop-blur-md">
                    <LevelMedallion level={sector.level} className="text-2xl font-black leading-none text-slate-50" iconClassName="h-12 w-12" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>

      {selectedSector ? (
        <div className="fixed inset-0 z-[74]" data-smoke="city-sector-modal">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm"
            onClick={() => {
              emitUiFeedback("close", "light");
              syncSectorQuery(null);
            }}
          />
          <div className="kw-scroll-hidden absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+8px)] top-[calc(env(safe-area-inset-top)+72px)] mx-auto flex w-auto max-w-md overflow-y-auto">
            <div
              className="relative w-full overflow-hidden rounded-[30px] border border-white/14 bg-transparent px-1.5 py-1.5 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.45)]"
              style={{
                backgroundImage: `url('${sectorPanelImage(selectedSector.id, cityClass, isCapitalVillage)}')`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundColor: "#020617",
              }}
            >
              <div className="relative space-y-2">
                {[selectedSector.buildingId].map((buildingId) => {
                  const definition = BUILDINGS_BY_ID[buildingId];
                  const current = selectedSector.level;
                  const nextLevel = Math.min(definition.maxLevel, current + 1);
                  const cost = calculateBuildingUpgradeCost(definition, nextLevel, {
                    evolutionMode,
                    archetype: cityClassToArchetype(cityClass),
                    scalarMultiplier: kingModifiers.buildingCostMultiplier,
                  });
                  const affordable = canAfford(cost, resources, currentVillageDevelopment);
                  const atMax = current >= definition.maxLevel;
                  const skillDots = selectedSector.skillDots;
                  const skillOptions = BUILDING_SKILL_META[selectedSector.id];
                  return (
                    <section key={buildingId} className="relative px-1 py-1">
                      <div className="relative pb-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            emitUiFeedback("close", "light");
                            syncSectorQuery(null);
                          }}
                          className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/14 bg-white/8 text-slate-200 backdrop-blur-md"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <p className="mx-auto max-w-[70%] text-[30px] font-black leading-none tracking-tight text-slate-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">{selectedSector.label}</p>
                        <div
                          className="mx-auto mt-1.5 w-[84px] rounded-[16px] border border-white/18 px-2.5 py-1.5 text-center text-slate-50 shadow-[0_14px_28px_rgba(2,6,23,0.22)]"
                          style={{
                            backgroundImage: `linear-gradient(160deg, rgba(8,12,22,0.78), rgba(12,18,30,0.7) 48%, rgba(6,10,18,0.82)), url('${sectorPanelImage(selectedSector.id, cityClass, isCapitalVillage)}')`,
                            backgroundPosition: "center",
                            backgroundSize: "cover",
                          }}
                        >
                          <LevelMedallion level={current} className="block text-[30px] font-black leading-none" iconClassName="mx-auto h-12 w-12" />
                        </div>
                      </div>

                      <div className="relative mt-2 grid grid-cols-2 gap-1.5">
                        {skillOptions.map((option) => {
                          const points = skillDots[option.id] ?? 0;
                          const disabled = atMax || points >= 3 || !canAffordSkillUpgrade(cost, resources);
                          const palette = skillNodePalette(selectedSector.id);
                          return (
                            <article
                              key={option.id}
                              className={`group relative overflow-hidden rounded-[22px] border px-2 py-2 text-center transition ${skillNodeTone(points > 0, disabled)} ${palette.border} ${points > 0 && !disabled ? palette.glow : ""}`}
                              style={{
                                backgroundImage: `linear-gradient(160deg, rgba(6,10,18,0.82), rgba(12,18,30,0.72) 46%, rgba(6,10,18,0.86)), url('${sectorPanelImage(selectedSector.id, cityClass, isCapitalVillage)}')`,
                                backgroundPosition: "center",
                                backgroundSize: "cover",
                              }}
                            >
                              <div className={`absolute inset-0 bg-gradient-to-br ${palette.shell} opacity-34`} />
                              <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: `url('${sectorPanelImage(selectedSector.id, cityClass, isCapitalVillage)}')`, backgroundPosition: "center", backgroundSize: "cover" }} />
                              <svg
                                aria-hidden="true"
                                className="absolute inset-0 h-full w-full opacity-50"
                                viewBox="0 0 200 160"
                                preserveAspectRatio="none"
                              >
                                <circle cx="26" cy="28" r="36" fill="rgba(255,255,255,0.06)" />
                                <circle cx="174" cy="134" r="52" fill="rgba(255,255,255,0.04)" />
                                <path d="M0 132 C48 98, 92 104, 200 42" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none" />
                                <path d="M0 148 C64 132, 116 126, 200 116" stroke="rgba(255,255,255,0.05)" strokeWidth="2" fill="none" />
                              </svg>
                              <div className="relative">
                                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-base font-black backdrop-blur-md ${palette.core}`}>
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/14 bg-slate-950/26">
                                    <LevelMedallion level={points} className="text-base font-black text-slate-50" iconClassName="h-10 w-10" />
                                  </div>
                                </div>
                                <p className="mt-1 truncate text-[13px] font-black tracking-tight text-slate-50">{option.label}</p>
                                <p className="mt-0.5 text-[10px] font-semibold text-slate-200/85">{option.impact}</p>
                                <p className="mt-0.5 text-[10px] font-black text-white/90">{option.bonus}</p>
                              </div>
                              <div className="relative mt-1.5 grid grid-cols-2 gap-1 text-[9px] font-black">
                                <CostChip kind="materials" value={formatCompact(cost.materials)} affordable={resources.materials >= cost.materials} />
                                <CostChip kind="supplies" value={formatCompact(cost.supplies)} affordable={resources.supplies >= cost.supplies} />
                              </div>
                              <div className="relative mt-1.5 flex gap-1">
                                {[0, 1, 2].map((index) => (
                                  <span
                                    key={index}
                                    className={`h-2 flex-1 rounded-full ${index < points ? palette.accent : "bg-white/12"}`}
                                  />
                                ))}
                              </div>
                              <div className="relative mt-1.5 grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  disabled
                                  data-smoke={`skill-down-${selectedSector.id}-${option.id}`}
                                  className="rounded-xl border border-white/10 bg-slate-950/16 px-2 py-1 text-[10px] font-black text-slate-500"
                                >
                                  -Nv
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openSkillUpgrade(buildingId, selectedSector.id, option)}
                                  disabled={disabled}
                                  data-smoke={`skill-up-${selectedSector.id}-${option.id}`}
                                  className={`rounded-xl border px-2 py-1 text-[10px] font-black transition ${
                                    disabled
                                      ? "border-white/10 bg-slate-950/16 text-slate-500"
                                      : "border-cyan-300/30 bg-cyan-500/10 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.1)]"
                                  }`}
                                >
                                  +Nv
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}

                {selectedSector.id === "crown" ? (
                  <>
                    <article className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] text-slate-200">
                      <p className="font-semibold text-slate-100">
                        {assignedHero !== "none" ? HERO_PROMOTION_META[assignedHero as HeroSpecialistId].label : "Sem herói contratado"}
                      </p>
                      <p className="mt-1">Custo {formatCompact(HERO_HIRE_COST.materials)} M · {formatCompact(HERO_HIRE_COST.supplies)} S</p>
                      <p className="mt-1">Nv 4+ · {hiredHeroCount}/{HERO_PROMOTION_LIMIT} · +50 influência</p>
                      <button
                        type="button"
                        onClick={() => setShowHeroPromotionOptions((current) => !current)}
                        className={`mt-3 rounded-xl border px-3 py-2 text-[11px] font-bold ${
                          canHireHero && !showHeroPromotionOptions
                            ? "animate-pulse border-amber-300/70 bg-amber-400/25 text-amber-50 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                            : "border-white/15 bg-white/8 text-slate-100"
                        }`}
                      >
                        {showHeroPromotionOptions
                          ? "Fechar"
                          : assignedHero === "none"
                            ? canHireHero ? "Contratar herói ✦" : "Contratar herói"
                            : "Ver build"}
                      </button>
                    </article>
                    {showHeroPromotionOptions ? (
                      <>
                        <TraitTree
                          rootLabel={assignedHero === "none" ? "Build inicial" : HERO_BUILD_META[heroBuild].label}
                          rootNote={assignedHero === "none" ? "Escolha antes de contratar." : HERO_BUILD_META[heroBuild].note}
                          options={HERO_BUILD_IDS.map((buildId) => ({
                            id: buildId,
                            label: HERO_BUILD_META[buildId].label,
                            note: HERO_BUILD_META[buildId].note,
                            active: (assignedHero === "none" ? selectedHeroBuild : heroBuild) === buildId,
                            onClick: () => changeHeroBuild(buildId),
                          }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {HERO_PROMOTION_IDS.map((heroId) => (
                            <button
                              key={heroId}
                              type="button"
                              onClick={() => {
                                hireHero(heroId);
                                setShowHeroPromotionOptions(false);
                              }}
                              disabled={
                                assignedHero !== "none" ||
                                !canHireHero
                              }
                              className={`rounded-2xl border px-3 py-3 text-left text-[11px] font-semibold transition disabled:opacity-50 ${
                                assignedHero === heroId ? "border-cyan-300/35 bg-cyan-500/14 text-cyan-50" : "border-white/12 bg-white/6 text-slate-200"
                              }`}
                            >
                              {HERO_PROMOTION_META[heroId].label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}

                {selectedSector.id === "economy" ? (
                  <>
                    <TraitTree
                          rootLabel="Foco de produção"
                      options={(Object.entries(PRODUCTION_FOCUS_META) as Array<[CityProductionFocus, (typeof PRODUCTION_FOCUS_META)[CityProductionFocus]]>).map(
                        ([focusId, meta]) => ({
                          id: focusId,
                          label: meta.label,
                          active: productionFocus === focusId,
                          onClick: () => setProductionFocus(focusId),
                        }),
                      )}
                    />
                    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-amber-300" />
                        <p className="text-sm font-black text-slate-100">Habitantes na produção</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          livres {freePopulation}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          produção {usedProductionWorkers}/{productionCapacity}
                        </span>
                        <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-amber-100">
                          {currentCityYield.materials} M/d
                        </span>
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                          {currentCityYield.supplies} S/d
                        </span>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                          {currentCityYield.logistics} log
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-300">
                        Fórmula oficial: {currentCityYield.breakdown.cityClass} + {currentCityYield.breakdown.terrain} + build de Produção + herói + empregos.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {PRODUCTION_WORKER_IDS.map((focusId) => (
                          <AllocationCard
                            key={focusId}
                            label={PRODUCTION_FOCUS_META[focusId].label}
                            value={productionWorkers[focusId]}
                            delta={getProductionWorkerDelta(focusId)}
                            tone="amber"
                            canDecrease={productionWorkers[focusId] > 0}
                            canIncrease={freePopulation >= POPULATION_ALLOCATION_STEP && usedProductionWorkers < productionCapacity}
                            onDecrease={() => adjustProductionWorkers(focusId, -POPULATION_ALLOCATION_STEP)}
                            onIncrease={() => adjustProductionWorkers(focusId, POPULATION_ALLOCATION_STEP)}
                          />
                        ))}
                      </div>
                    </article>
                  </>
                ) : null}

                {selectedSector.id === "recruitment" ? (
                  <>
                    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <Swords className="h-4 w-4 text-rose-300" />
                        <p className="text-sm font-black text-slate-100">Recrutamento local</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          livres {freePopulation}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          quartel {usedRecruits}/{recruitCapacity}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          capital {capitalTroopTotal} · poder {capitalTroopAveragePower}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {TROOP_RECRUIT_IDS.map((unitId) => {
                          const unlocked =
                            (unitId === "militia" && barracksUnlocks.militia) ||
                            (unitId === "shooters" && barracksUnlocks.shooters) ||
                            (unitId === "scouts" && barracksUnlocks.scouts) ||
                            (unitId === "machinery" && barracksUnlocks.machinery);
                          const label =
                            unitId === "militia"
                              ? "Milicia"
                              : unitId === "shooters"
                                ? "Atiradores"
                                : unitId === "scouts"
                                  ? "Batedores"
                                  : "Maquinaria";
                          const unlockLabel =
                            unitId === "militia" ? "Nv 1" : unitId === "shooters" ? "Nv 3" : unitId === "scouts" ? "Nv 5" : "Nv 7";
                          return (
                            <AllocationCard
                              key={unitId}
                            label={label}
                            value={recruits[unitId]}
                            note={unlockLabel}
                            delta={recruitDelta(unitId, recruits[unitId], recruitmentSkillDots)}
                              tone="rose"
                            disabled={!unlocked}
                            canDecrease={recruits[unitId] > 0}
                            canIncrease={freePopulation >= POPULATION_ALLOCATION_STEP && usedRecruits < recruitCapacity}
                              onDecrease={() => adjustRecruitment(unitId, -POPULATION_ALLOCATION_STEP)}
                              onIncrease={() => adjustRecruitment(unitId, POPULATION_ALLOCATION_STEP)}
                            />
                          );
                        })}
                      </div>
                    </article>
                  </>
                ) : null}

                {selectedSector.id === "society" ? (
                  <>
                    <TraitTree
                      rootLabel="Contribuicao para a estabilidade"
                      options={(Object.entries(SOCIETY_FOCUS_META) as Array<[CitySocietyFocus, (typeof SOCIETY_FOCUS_META)[CitySocietyFocus]]>).map(
                        ([focusId, meta]) => ({
                          id: focusId,
                          label: meta.label,
                          active: societyFocus === focusId,
                          onClick: () => setSocietyFocus(focusId),
                        }),
                      )}
                    />
                    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-cyan-300" />
                        <p className="text-sm font-black text-slate-100">Populacao e empregos</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          cidade {usedPopulation}/{populationCurrent}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          imperio {empirePopulationUsed}/{empirePopulationCurrent}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          max {populationCap}/{empirePopulationCapacity}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          satisfacao {societyState.band}
                        </span>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-cyan-100">
                          {societyState.satisfaction} satisfacao
                        </span>
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                          x{societyState.productionMultiplier.toFixed(2)} prod
                        </span>
                        <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2 py-1 text-rose-100">
                          crise {societyState.crisisRisk}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-300">
                        Sociedade oficial: satisfação sobe com Sociedade, Ordem, Médicos e build; cai com lotação, guerra, déficits e ataque.
                      </p>
                      <div className="mt-3 grid grid-cols-[1fr_92px_1fr] items-center gap-2">
                        <button
                          type="button"
                          onClick={() => adjustPopulation("shrink")}
                          disabled={populationCurrent <= usedPopulation}
                          className="flex h-12 items-center justify-center rounded-xl border border-white/12 bg-white/7 text-slate-100 disabled:opacity-35"
                          aria-label="Reduzir moradores"
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                        <div className="rounded-xl border border-white/12 bg-white/8 py-2 text-center">
                          <p className="text-lg font-black text-slate-100">{populationCurrent}</p>
                          <p className="text-[9px] font-bold text-slate-400">/{populationCap}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => adjustPopulation("grow")}
                          disabled={populationCurrent >= populationCap}
                          className="flex h-12 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-500/12 text-cyan-100 disabled:opacity-35"
                          aria-label="Aumentar moradores"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {CITY_JOB_IDS.map((jobId) => (
                          <AllocationCard
                            key={jobId}
                            label={SOCIETY_FOCUS_META[jobId].label}
                            value={jobs[jobId]}
                            delta={getJobDelta(jobId)}
                            tone="emerald"
                            canDecrease={jobs[jobId] > 0}
                            canIncrease={freePopulation >= POPULATION_ALLOCATION_STEP}
                            onDecrease={() => adjustCityJob(jobId, -POPULATION_ALLOCATION_STEP)}
                            onIncrease={() => adjustCityJob(jobId, POPULATION_ALLOCATION_STEP)}
                          />
                        ))}
                      </div>
                    </article>
                  </>
                ) : null}

                {selectedSector.id === "defense" ? (
                  <>
                    <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2">
                        <Swords className="h-4 w-4 text-cyan-300" />
                        <p className="text-sm font-black text-slate-100">Guarnicao defensiva</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          livres {freePopulation}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          muralha {usedDefenders}/{defenseCapacity}
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-slate-200">
                          poder {localDefensePower}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {DEFENSE_RECRUIT_IDS.map((unitId) => {
                          const unlocked =
                            (unitId === "guards" && wallDefenseUnlocks.guards) ||
                            (unitId === "archers" && wallDefenseUnlocks.archers) ||
                            (unitId === "ballistae" && wallDefenseUnlocks.ballistae);
                          const label = unitId === "guards" ? "Guardas" : unitId === "archers" ? "Arqueiros" : "Balistas";
                          const unlockLabel = unitId === "guards" ? "Nv 1" : unitId === "archers" ? "Nv 4" : "Nv 7";
                          return (
                            <AllocationCard
                              key={unitId}
                            label={label}
                            value={defenseRecruits[unitId]}
                              note={unlockLabel}
                              delta={defenseDelta(unitId, defenseRecruits[unitId], defenseSkillDots)}
                              tone="cyan"
                              disabled={!unlocked}
                              canDecrease={defenseRecruits[unitId] > 0}
                              canIncrease={freePopulation >= POPULATION_ALLOCATION_STEP && usedDefenders < defenseCapacity}
                              onDecrease={() => adjustDefenseRecruitment(unitId, -POPULATION_ALLOCATION_STEP)}
                              onIncrease={() => adjustDefenseRecruitment(unitId, POPULATION_ALLOCATION_STEP)}
                            />
                          );
                        })}
                      </div>
                    </article>
                  </>
                ) : null}

                {opsLog.length > 0 ? (
                  <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="space-y-1.5">
                      {opsLog.map((line) => (
                        <p key={line} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-slate-200">
                          {line}
                        </p>
                      ))}
                    </div>
                  </article>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {pendingSkillUpgrade ? (
        <div className="fixed inset-0 z-[84] flex items-center justify-center bg-slate-950/58 p-4 backdrop-blur-sm" data-smoke="skill-upgrade-popup">
          <article
            className="relative w-full max-w-[316px] overflow-hidden rounded-[26px] border border-white/12 bg-slate-950/95 px-4 py-3 shadow-[0_18px_60px_rgba(2,6,23,0.55)]"
            style={{
              backgroundImage:
                `linear-gradient(145deg, rgba(2,6,23,0.18), rgba(2,6,23,0.84)), url('${sectorPanelImage(pendingSkillUpgrade.sectorId, cityClass, isCapitalVillage)}')`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{selectedSector?.label}</p>
                <p className="mt-1 text-lg font-black tracking-tight text-slate-100">{pendingSkillUpgrade.option.label}</p>
                <p className="mt-1 text-[11px] font-semibold text-cyan-100">{pendingSkillUpgrade.option.bonus}</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-300">{describeLevelGain(pendingSkillUpgrade.sectorId, pendingSkillUpgrade.nextLevel)}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/12 text-lg font-black text-cyan-50">
                  <LevelMedallion level={pendingSkillUpgrade.currentPoints + 1} className="text-lg font-black text-cyan-50" iconClassName="h-[52px] w-[52px]" />
                </div>
                <button
                  type="button"
                  onClick={() => setPendingSkillUpgrade(null)}
                  data-smoke="close-skill-upgrade-popup"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-black">
              <CostChip kind="materials" value={formatCompact(pendingSkillUpgrade.cost.materials)} affordable={resources.materials >= pendingSkillUpgrade.cost.materials} />
              <CostChip kind="supplies" value={formatCompact(pendingSkillUpgrade.cost.supplies)} affordable={resources.supplies >= pendingSkillUpgrade.cost.supplies} />
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={confirmSkillUpgrade}
                data-smoke="confirm-skill-upgrade"
                className="w-full rounded-xl border border-cyan-300/30 bg-cyan-500/12 px-3 py-3 text-[11px] font-black text-cyan-100"
              >
                Confirmar upgrade
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}

