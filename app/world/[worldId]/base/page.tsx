import { type EvolutionMode } from "@/core/GameBalance";
import { BasePageClient, type BaseSubTab, type LocalCommand } from "@/components/base/BasePageClient";
import type { SectorId } from "@/components/base/village-scene-config";
import type { BuildingId } from "@/lib/buildings";
import { getWorldPayload } from "@/lib/world-data";
import { getSandboxPlaybooks } from "@/lib/sandbox-playbooks";

const MODE_IDS: EvolutionMode[] = ["balanced", "metropole", "vanguard", "bastion", "flow"];
const LOCAL_COMMAND_IDS: LocalCommand[] = ["guard", "drill", "sortie", "fortify", "rations"];
const BUILDING_IDS: BuildingId[] = ["palace", "senate", "mines", "farms", "housing", "research", "roads", "barracks", "arsenal", "wall"];
const SECTOR_IDS: SectorId[] = ["crown", "economy", "society", "recruitment", "defense"];

function normalizeMode(input: string | undefined): EvolutionMode {
  if (!input) return "balanced";
  return MODE_IDS.includes(input as EvolutionMode) ? (input as EvolutionMode) : "balanced";
}

function normalizeLocalCommand(input: string | undefined): LocalCommand {
  if (!input) return "guard";
  return LOCAL_COMMAND_IDS.includes(input as LocalCommand) ? (input as LocalCommand) : "guard";
}

function normalizeSubTab(input: string | undefined): BaseSubTab {
  if (!input) return "city";
  return "city";
}

function normalizeBuilding(input: string | undefined): BuildingId | null {
  if (!input) return null;
  return BUILDING_IDS.includes(input as BuildingId) ? (input as BuildingId) : null;
}

function normalizeSector(input: string | undefined): SectorId | null {
  if (!input) return null;
  return SECTOR_IDS.includes(input as SectorId) ? (input as SectorId) : null;
}

export default async function BasePage({
  params,
  searchParams,
}: {
  params: { worldId: string };
  searchParams: { v?: string; m?: string; lc?: string; sb?: string; s?: string; b?: string };
}) {
  const payload = await getWorldPayload(params.worldId);
  const world = payload.world;
  const sandboxPlaybooks = payload.isSandboxWorld ? (getSandboxPlaybooks() ?? undefined) : undefined;
  const selectedVillageId = typeof searchParams.v === "string" ? searchParams.v : world.activeVillageId;
  const evolutionMode = normalizeMode(typeof searchParams.m === "string" ? searchParams.m : undefined);
  const localCommand = normalizeLocalCommand(typeof searchParams.lc === "string" ? searchParams.lc : undefined);
  const subTab = normalizeSubTab(typeof searchParams.sb === "string" ? searchParams.sb : undefined);
  const selectedSectorId = normalizeSector(typeof searchParams.s === "string" ? searchParams.s : undefined);
  const selectedBuildingId = normalizeBuilding(typeof searchParams.b === "string" ? searchParams.b : undefined);

  return (
    <BasePageClient
      worldId={params.worldId}
      villages={world.villages}
      researches={world.researches}
      timeline={world.timeline}
      worldName={world.name}
      worldDay={world.day}
      worldPhase={world.phase}
      worldSpeedMultiplier={world.speedMultiplier ?? 1}
      averageInfluenceScore={world.averageInfluenceScore}
      activeAlerts={world.activeAlerts}
      tribe={world.tribe}
      sovereignty={world.sovereignty}
      readOnly={payload.worldMeta.readOnly}
      selectedVillageId={selectedVillageId}
      evolutionMode={evolutionMode}
      initialLocalCommand={localCommand}
      initialSubTab={subTab}
      initialSelectedSectorId={selectedSectorId}
      initialSelectedBuildingId={selectedBuildingId}
      sandboxPlaybooks={sandboxPlaybooks}
    />
  );
}
