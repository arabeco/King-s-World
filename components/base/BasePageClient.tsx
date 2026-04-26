"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { useEffect, useState } from "react";

import type { EvolutionMode } from "@/core/GameBalance";
import { VillageScene } from "@/components/base/VillageScene";
import { SandboxOpeningPanel } from "@/components/sandbox/SandboxOpeningPanel";
import type { SectorId } from "@/components/base/village-scene-config";
import type { BuildingId } from "@/lib/buildings";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import type { ResearchEntry, TimelineEntry, VillageSummary } from "@/lib/mock-data";
import type { SandboxStrategyPlaybook, SandboxStrategyId } from "@/lib/sandbox-playbooks";
import { emitUiFeedback } from "@/lib/ui-feedback";

export type LocalCommand = "guard" | "drill" | "sortie" | "fortify" | "rations";
export type BaseSubTab = "city";

const LOCAL_COMMAND_IDS: LocalCommand[] = ["guard", "drill", "sortie", "fortify", "rations"];

const LOCAL_COMMAND_META: Record<LocalCommand, { label: string; summary: string }> = {
  guard: { label: "Guarnicao", summary: "Cidade entra em prioridade de defesa e puxa resposta automatica da legiao central." },
  drill: { label: "Treino", summary: "Melhora o recrutamento na Capital com lote maior e custo menor." },
  sortie: { label: "Sortida", summary: "Postura ofensiva para pressao, saque e ataque escolhido no mapa." },
  fortify: { label: "Blindar", summary: "Empurra muralha, seguranca local e preparo anti-horda." },
  rations: { label: "Racao", summary: "Economiza suprimento para sustentar campanha longa." },
};

type BasePageClientProps = {
  worldId: string;
  villages: VillageSummary[];
  researches: ResearchEntry[];
  timeline: TimelineEntry[];
  worldName: string;
  worldDay: number;
  worldPhase: string;
  worldSpeedMultiplier?: number;
  averageInfluenceScore: number;
  activeAlerts: string[];
  tribe: {
    name: string;
    citadelStatus: string;
    totalScore: number;
    rank: number;
    membersAlive: number;
  };
  sovereignty: {
    kingAlive: boolean;
    councilHeroes: number;
    militaryRankingPoints: number;
    wondersControlled: number;
    eraQuestsCompleted: number;
    tribeDomeUnlocked: boolean;
    tribeLoyaltyStage?: number;
  };
  readOnly: boolean;
  selectedVillageId: string;
  evolutionMode: EvolutionMode;
  initialLocalCommand: LocalCommand;
  initialSubTab: BaseSubTab;
  initialSelectedSectorId: SectorId | null;
  initialSelectedBuildingId: BuildingId | null;
  sandboxPlaybooks?: Record<SandboxStrategyId, SandboxStrategyPlaybook>;
};

export function BasePageClient({
  worldId,
  villages,
  researches,
  timeline,
  worldName,
  worldDay,
  worldPhase,
  worldSpeedMultiplier = 1,
  averageInfluenceScore,
  activeAlerts,
  tribe,
  sovereignty,
  readOnly,
  selectedVillageId,
  evolutionMode,
  initialLocalCommand,
  initialSubTab,
  initialSelectedSectorId,
  initialSelectedBuildingId,
  sandboxPlaybooks,
}: BasePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localCommand, setLocalCommand] = useState<LocalCommand>(initialLocalCommand);
  const { imperialState, setImperialState } = useImperialState(worldId, villages);
  const mergedVillages = mergeImperialVillages(villages, imperialState);

  useEffect(() => {
    setLocalCommand(initialLocalCommand);
  }, [initialLocalCommand]);

  const activeVillage = mergedVillages.find((entry) => entry.id === selectedVillageId) ?? mergedVillages[0];

  return (
    <>
      {sandboxPlaybooks ? (
        <SandboxOpeningPanel
          worldId={worldId}
          villages={mergedVillages}
          selectedVillageId={selectedVillageId}
          playbooks={sandboxPlaybooks}
        />
      ) : null}

      <VillageScene
        worldId={worldId}
        villages={mergedVillages}
        village={activeVillage}
        readOnly={readOnly}
        researchEntries={researches}
        timelineEntries={timeline}
        evolutionMode={evolutionMode}
        localCommand={localCommand}
        worldSpeedMultiplier={worldSpeedMultiplier}
        initialSelectedSectorId={initialSelectedSectorId}
        initialSelectedBuildingId={initialSelectedBuildingId}
      />
    </>
  );
}
