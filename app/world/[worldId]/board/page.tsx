"use client";

import { useMemo } from "react";

import {
  calculateDefensePower,
  calculateSovereigntyScore,
  calculateTroopPower,
  calculateTribeProgressStage,
  calculateVillageDevelopment,
  calculateVillagePopulationCap,
} from "@/core/GameBalance";
import { StrategicMap } from "@/components/board/StrategicMap";
import { countUnlockedMilitaryTechs } from "@/lib/empire-systems";
import { mergeImperialVillages, useImperialStateContext } from "@/lib/imperial-state";
import { useLiveWorldContext } from "@/lib/world-runtime";

export default function BoardPage({ params }: { params: { worldId: string } }) {
  const { world, worldMeta, runtimeState } = useLiveWorldContext();
  const { imperialState } = useImperialStateContext();
  const villages = useMemo(() => mergeImperialVillages(world.villages, imperialState), [imperialState, world.villages]);
  const assignedHeroCount = Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length;
  const tribeStage = calculateTribeProgressStage({
    currentDay: world.day,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted,
    kingAlive: world.sovereignty.kingAlive,
  });
  const population = villages.reduce(
    (total, village) => {
      const capacity = calculateVillagePopulationCap(village.buildingLevels);
      const production = imperialState.productionWorkersByVillage[village.id] ?? { materials: 0, supplies: 0, commerce: 0, logistics: 0 };
      const jobs = imperialState.jobsByVillage[village.id] ?? { medics: 0, crafts: 0, order: 0, scholars: 0 };
      const recruits = imperialState.recruitsByVillage[village.id] ?? { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
      const defenders = imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 };
      const employed = Object.values(production).reduce((sum, value) => sum + value, 0) + Object.values(jobs).reduce((sum, value) => sum + value, 0);
      const recruited = Object.values(recruits).reduce((sum, value) => sum + value, 0);
      const defended = Object.values(defenders).reduce((sum, value) => sum + value, 0);
      const current = Math.min(capacity, Math.max(employed + recruited + defended, imperialState.populationByVillage[village.id] ?? capacity));
      return { current: total.current + current, capacity: total.capacity + capacity, employed: total.employed + employed, recruited: total.recruited + recruited };
    },
    { current: 0, capacity: 0, employed: 0, recruited: 0 },
  );

  const sovereignty = calculateSovereigntyScore({
    villages,
    villageDevelopments: villages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
    councilHeroes: Math.max(world.sovereignty.councilHeroes, assignedHeroCount),
    militaryRankingPoints: world.sovereignty.militaryRankingPoints,
    eraQuestsCompleted: world.sovereignty.eraQuestsCompleted,
    wondersControlled: world.sovereignty.wondersControlled,
    currentDay: world.day,
    hasTribeDome: world.sovereignty.tribeDomeUnlocked || imperialState.sandboxDomeActive,
    tribeLoyaltyStage: world.sovereignty.tribeLoyaltyStage ?? tribeStage,
    kingAlive: world.sovereignty.kingAlive,
    workforce: imperialState.workforceByFocus,
    unlockedMilitaryTechs: countUnlockedMilitaryTechs(imperialState.militaryTechTree),
    dragonChoice: imperialState.dragonChoice,
    populationCurrent: population.current,
    populationCapacity: population.capacity,
    employedPopulation: population.employed,
    recruitedPopulation: population.recruited,
    senateSatisfaction: imperialState.senate.satisfaction,
    troopPower: calculateTroopPower(imperialState.troops),
    defensePower: villages.reduce(
      (sum, village) => sum + calculateDefensePower(imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 }),
      0,
    ),
  });

  return (
    <StrategicMap
      worldId={world.id}
      worldRouteId={params.worldId}
      tribeName={world.tribe.name}
      sites={world.boardSites}
      villages={villages}
      currentDay={world.day}
      sovereigntyScore={sovereignty.total}
      readOnly={worldMeta.readOnly}
      worldStarted={runtimeState.started}
    />
  );
}
