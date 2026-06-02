import { type SovereignUpgradeCost } from "@/core/GameBalance";
import { type BuildingId } from "@/lib/buildings";
import { type CityClass } from "@/lib/cities";
import {
  type BuildingSkillSlotId,
  type CityDefenseRecruitId,
  type CityJobId,
  type CityProductionAllocations,
  type CityProductionFocus,
  type CitySocietyFocus,
  type HeroBuildId,
  type TroopRecruitId,
  type VillageBuildingSkills,
} from "@/lib/imperial-state";
import type { HeroSpecialistId } from "@/lib/council";
import type { LocalCommand } from "./village-scene-types";
export type ResourceView = { materials: number; supplies: number; influence: number };
export type SectorId = "crown" | "economy" | "society" | "recruitment" | "defense";

export type CitySector = {
  id: SectorId;
  label: string;
  tone: "blue" | "green" | "red";
  buildingId: BuildingId;
  formulaBuildingIds: BuildingId[];
};

export type TraitOption = {
  id: string;
  label: string;
  note?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export type PopulationAction = "grow" | "shrink";
export type HeroHireCost = { materials: number; supplies: number };
export type BuildingSkillMeta = { id: BuildingSkillSlotId; label: string; impact: string; bonus: string };
export type PendingSkillUpgrade = {
  buildingId: BuildingId;
  sectorId: SectorId;
  sectorLabel: string;
  option: BuildingSkillMeta;
  currentLevel: number;
  currentPoints: number;
  nextLevel: number;
  cost: { materials: number; supplies: number; influence: number };
};

export const LOCAL_COMMAND_META: Record<LocalCommand, { label: string; summary: string }> = {
  guard: { label: "Guarnicao", summary: "Defesa local e resposta mais segura." },
  drill: { label: "Treino", summary: "A cidade gira para preparo militar e lote maior." },
  sortie: { label: "Sortida", summary: "Pressao ofensiva e leitura agressiva da fronteira." },
  fortify: { label: "Blindar", summary: "Muralha e resistencia local acima de tudo." },
  rations: { label: "Racao", summary: "Sustenta a campanha sem quebrar suprimentos." },
};

export const CITY_SECTORS: CitySector[] = [
  {
    id: "crown",
    label: "Governo",
    tone: "blue",
    buildingId: "palace",
    formulaBuildingIds: ["palace", "senate"],
  },
  {
    id: "economy",
    label: "Produção",
    tone: "green",
    buildingId: "mines",
    formulaBuildingIds: ["mines", "farms", "roads"],
  },
  {
    id: "society",
    label: "Sociedade",
    tone: "green",
    buildingId: "housing",
    formulaBuildingIds: ["housing", "research"],
  },
  {
    id: "recruitment",
    label: "Quartel",
    tone: "red",
    buildingId: "barracks",
    formulaBuildingIds: ["barracks", "arsenal"],
  },
  {
    id: "defense",
    label: "Muralha",
    tone: "blue",
    buildingId: "wall",
    formulaBuildingIds: ["wall"],
  },
];

export const PRODUCTION_FOCUS_META: Record<CityProductionFocus, { label: string; note: string }> = {
  materials: { label: "Materiais", note: "Puxa pedreira, obra e caixa bruto." },
  supplies: { label: "Mantimentos", note: "Empurra comida e folego de campanha." },
  commerce: { label: "Negocios", note: "Converte cidade em caixa e giro." },
  logistics: { label: "Logística", note: "Rotas, obra e distribuição interna." },
};

export const SOCIETY_FOCUS_META: Record<CitySocietyFocus, { label: string; note: string }> = {
  medics: { label: "Médicos", note: "Cura pressão e reduz colapso social." },
  crafts: { label: "Oficios", note: "Emprego e produtividade local." },
  order: { label: "Ordem", note: "Disciplina e estabilidade urbana." },
  scholars: { label: "Estudos", note: "Quadros tecnicos e leitura da cidade." },
};

export const HERO_PROMOTION_META: Record<HeroSpecialistId, { label: string; note: string }> = {
  engineer: { label: "Engenheiro", note: "Obras, acabamento e defesa." },
  marshal: { label: "General", note: "Ataque, moral e comando militar." },
  navigator: { label: "Explorador", note: "Revela mapa, abre rotas e reduz ETA." },
  intendente: { label: "Administrador", note: "Suprimentos, comboios e fluxo interno." },
  erudite: { label: "Sábio", note: "Pesquisa, doutrina e legado." },
};

export const HERO_PROMOTION_IDS: HeroSpecialistId[] = ["engineer", "marshal", "navigator", "intendente", "erudite"];
export const HERO_PROMOTION_LIMIT = 10;
export const HERO_HIRE_COST: HeroHireCost = { materials: 1200, supplies: 850 };
export const HERO_BUILD_META: Record<HeroBuildId, { label: string; note: string }> = {
  leadership: { label: "Liderança", note: "Governo mais limpo, mais influência política." },
  logistics: { label: "Logística", note: "Ajuda rotas, produção e caixa girarem." },
  discipline: { label: "Disciplina", note: "Puxa quartel, muralha e resposta militar." },
  lore: { label: "Leitura", note: "Ajuda sociedade, estudo e leitura imperial." },
};
export const HERO_BUILD_IDS: HeroBuildId[] = ["leadership", "logistics", "discipline", "lore"];
export const CITY_CLASS_IDS: CityClass[] = ["neutral", "metropole", "posto_avancado", "bastiao", "celeiro"];
export const CITY_CLASS_IMAGE_BY_ID: Record<CityClass, string> = {
  neutral: "/images/cidade.jpg",
  metropole: "/images/metropole.jpg",
  posto_avancado: "/images/posto.jpg",
  bastiao: "/images/bastiao.jpg",
  celeiro: "/images/celeiro.jpg",
};
export const PRODUCTION_WORKER_IDS: CityProductionFocus[] = ["materials", "supplies", "commerce", "logistics"];
export const CITY_JOB_IDS: CityJobId[] = ["medics", "crafts", "order", "scholars"];
export const TROOP_RECRUIT_IDS: TroopRecruitId[] = ["militia", "shooters", "scouts", "machinery"];
export const DEFENSE_RECRUIT_IDS: CityDefenseRecruitId[] = ["guards", "archers", "ballistae"];
export const BUILDING_SKILL_SLOT_IDS: BuildingSkillSlotId[] = ["a", "b", "c", "d"];
export const BUILDING_SKILL_META: Record<SectorId, BuildingSkillMeta[]> = {
  crown: [
    { id: "a", label: "Coroa", impact: "clima político", bonus: "+2 gov" },
    { id: "b", label: "Conselho", impact: "senado e leis", bonus: "+2 sat" },
    { id: "c", label: "Heróis", impact: "contratação", bonus: "-2% custo" },
    { id: "d", label: "Capital", impact: "ordem imperial", bonus: "+1 cap" },
  ],
  economy: [
    { id: "a", label: "Materiais", impact: "obra e caixa", bonus: "+3% M/d" },
    { id: "b", label: "Mantimentos", impact: "folego", bonus: "+3% S/d" },
    { id: "c", label: "Comercio", impact: "giro", bonus: "+1 log" },
    { id: "d", label: "Logística", impact: "rotas", bonus: "-2% custo" },
  ],
  society: [
    { id: "a", label: "Moradia", impact: "cap. populacao", bonus: "+2 pop" },
    { id: "b", label: "Oficios", impact: "empregos", bonus: "+2% prod" },
    { id: "c", label: "Saude", impact: "pressao social", bonus: "+2 sat" },
    { id: "d", label: "Estudos", impact: "leitura", bonus: "+1 estudo" },
  ],
  recruitment: [
    { id: "a", label: "Milicia", impact: "massa", bonus: "+2% pwr" },
    { id: "b", label: "Atiradores", impact: "linha", bonus: "+2% pwr" },
    { id: "c", label: "Batedores", impact: "visao", bonus: "+1 vis" },
    { id: "d", label: "Cerco", impact: "ruptura", bonus: "+1 cerco" },
  ],
  defense: [
    { id: "a", label: "Guardas", impact: "base local", bonus: "+2% def" },
    { id: "b", label: "Arqueiros", impact: "resposta", bonus: "+2% def" },
    { id: "c", label: "Balistas", impact: "peso", bonus: "+1 def" },
    { id: "d", label: "Alarme", impact: "tempo", bonus: "+1 tempo" },
  ],
};

export const SECTOR_IMAGE_BY_ID: Record<SectorId, string> = {
  crown: "/images/governo.jpg",
  economy: "/images/producao.jpg",
  society: "/images/sociedade.jpg",
  recruitment: "/images/quartel.jpg",
  defense: "/images/muralha.jpg",
};

export const SECTOR_ICON_BY_ID: Record<SectorId, string> = {
  crown: "/icons/building-government.png",
  economy: "/icons/building-production.png",
  society: "/icons/building-society.png",
  recruitment: "/icons/building-barracks.png",
  defense: "/icons/building-wall.png",
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function canAfford(cost: SovereignUpgradeCost, resources: ResourceView, currentInfluenceScore: number) {
  return (
    resources.materials >= cost.materials &&
    resources.supplies >= cost.supplies &&
    currentInfluenceScore >= cost.requiredInfluence
  );
}

export function canAffordSkillUpgrade(cost: SovereignUpgradeCost, resources: ResourceView) {
  return resources.materials >= cost.materials && resources.supplies >= cost.supplies;
}

export function emptyCityJobs(): Record<CityJobId, number> {
  return { medics: 0, crafts: 0, order: 0, scholars: 0 };
}

export function emptyProductionWorkers(): CityProductionAllocations {
  return { materials: 0, supplies: 0, commerce: 0, logistics: 0 };
}

export function emptyCityRecruits(): Record<TroopRecruitId, number> {
  return { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
}

export function emptyCityDefenseRecruits(): Record<CityDefenseRecruitId, number> {
  return { guards: 0, archers: 0, ballistae: 0 };
}

export function sumValues(record: Record<string, number>) {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

export function defaultSkillDots(level: number): Record<BuildingSkillSlotId, number> {
  let remaining = clamp(Math.floor(level), 0, 10);
  const dots: Record<BuildingSkillSlotId, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (const slotId of BUILDING_SKILL_SLOT_IDS) {
    const spend = Math.min(3, remaining);
    dots[slotId] = spend;
    remaining -= spend;
  }
  return dots;
}

export function totalSkillDots(dots: Record<BuildingSkillSlotId, number>) {
  return clamp(sumValues(dots), 0, 10);
}

export function resolveSectorBaseLevel(
  sector: CitySector,
  levels: Partial<Record<BuildingId, number>>,
) {
  return clamp(
    Math.max(...sector.formulaBuildingIds.map((buildingId) => Math.floor(levels[buildingId] ?? 0))),
    0,
    10,
  );
}

export function resolveSectorSkillDots(
  sector: CitySector,
  levels: Partial<Record<BuildingId, number>>,
  buildingSkills: VillageBuildingSkills,
) {
  return buildingSkills[sector.id] ?? defaultSkillDots(resolveSectorBaseLevel(sector, levels));
}

export function describeLevelGain(sectorId: SectorId, nextLevel: number) {
  if (sectorId === "economy") {
    return `Nv ${nextLevel}: mais produção e caixa local`;
  }
  if (sectorId === "crown") {
    return `Nv ${nextLevel}: governo mais forte e heróis melhores`;
  }
  if (sectorId === "society") {
    return `Nv ${nextLevel}: +10 capacidade populacional`;
  }
  if (sectorId === "recruitment") {
    const unlock =
      nextLevel === 3 ? " · destrava Atiradores" : nextLevel === 5 ? " · destrava Batedores" : nextLevel === 7 ? " · destrava Maquinaria" : "";
    return `Nv ${nextLevel}: +10 capacidade de recruta${unlock}`;
  }
  return `Nv ${nextLevel}: muralha mais forte`;
}

export function sectorLuxuryTone(sectorId: SectorId) {
  if (sectorId === "crown") return "from-cyan-500/18 via-sky-500/10 to-transparent border-cyan-300/18";
  if (sectorId === "economy") return "from-amber-500/18 via-yellow-500/10 to-transparent border-amber-300/18";
  if (sectorId === "society") return "from-emerald-500/18 via-teal-500/10 to-transparent border-emerald-300/18";
  if (sectorId === "recruitment") return "from-rose-500/18 via-orange-500/10 to-transparent border-rose-300/18";
  return "from-cyan-500/16 via-indigo-500/10 to-transparent border-cyan-300/18";
}

export function skillNodeTone(active: boolean, disabled: boolean) {
  if (disabled) return "border-white/10 bg-white/5 text-slate-500";
  if (active) return "border-cyan-300/40 bg-cyan-500/14 text-cyan-50";
  return "border-white/12 bg-white/6 text-slate-200 hover:bg-white/10";
}

export function skillNodePalette(sectorId: SectorId) {
  if (sectorId === "economy") {
    return {
      border: "border-amber-300/24",
      shell: "from-amber-500/22 via-yellow-500/10 to-slate-950/92",
      core: "border-amber-300/30 bg-amber-400/14 text-amber-50",
      glow: "shadow-[0_0_28px_rgba(251,191,36,0.12)]",
      accent: "bg-amber-300",
    };
  }
  if (sectorId === "society") {
    return {
      border: "border-emerald-300/24",
      shell: "from-emerald-500/22 via-teal-500/10 to-slate-950/92",
      core: "border-emerald-300/30 bg-emerald-400/14 text-emerald-50",
      glow: "shadow-[0_0_28px_rgba(52,211,153,0.12)]",
      accent: "bg-emerald-300",
    };
  }
  if (sectorId === "recruitment") {
    return {
      border: "border-rose-300/24",
      shell: "from-rose-500/22 via-orange-500/10 to-slate-950/92",
      core: "border-rose-300/30 bg-rose-400/14 text-rose-50",
      glow: "shadow-[0_0_28px_rgba(251,113,133,0.12)]",
      accent: "bg-rose-300",
    };
  }
  if (sectorId === "defense") {
    return {
      border: "border-indigo-300/24",
      shell: "from-indigo-500/22 via-cyan-500/10 to-slate-950/92",
      core: "border-indigo-300/30 bg-indigo-400/14 text-indigo-50",
      glow: "shadow-[0_0_28px_rgba(129,140,248,0.12)]",
      accent: "bg-indigo-300",
    };
  }
  return {
    border: "border-cyan-300/24",
    shell: "from-cyan-500/22 via-sky-500/10 to-slate-950/92",
    core: "border-cyan-300/30 bg-cyan-400/14 text-cyan-50",
    glow: "shadow-[0_0_28px_rgba(103,232,249,0.12)]",
    accent: "bg-cyan-300",
  };
}

export function productionWorkerDelta(focusId: CityProductionFocus, workers: number, productionLevel: number, skillDots?: Record<BuildingSkillSlotId, number>) {
  const value = Math.max(0, Math.floor(workers));
  const levelBonus = Math.max(1, Math.floor(productionLevel * 0.8));
  const materialsBonus = 1 + ((skillDots?.a ?? 0) * 0.03);
  const suppliesBonus = 1 + ((skillDots?.b ?? 0) * 0.03);
  const commerceBonus = skillDots?.c ?? 0;
  const logisticsBonus = skillDots?.d ?? 0;
  if (focusId === "materials") return `+${Math.floor((value * 6 + levelBonus) * materialsBonus)} M/d`;
  if (focusId === "supplies") return `+${Math.floor((value * 6 + levelBonus) * suppliesBonus)} S/d`;
  if (focusId === "commerce") return `+${Math.floor(value * 1.6 + productionLevel + commerceBonus)} log`;
  return `+${Math.floor(value * 0.8 + productionLevel + logisticsBonus)} log`;
}

export function jobDelta(jobId: CityJobId, workers: number, societyLevel: number, skillDots?: Record<BuildingSkillSlotId, number>) {
  const value = Math.max(0, Math.floor(workers));
  const levelBonus = Math.max(0, Math.floor(societyLevel / 3));
  if (jobId === "medics") return `+${Math.floor(value * 0.7 + levelBonus + (skillDots?.c ?? 0) * 2)} sat`;
  if (jobId === "crafts") return `+${Math.floor((value * 0.5 + levelBonus) * (1 + (skillDots?.b ?? 0) * 0.02))} prod`;
  if (jobId === "order") return `+${Math.floor(value * 0.7 + levelBonus + (skillDots?.c ?? 0))} ordem`;
  return `+${Math.floor(value * 0.6 + levelBonus + (skillDots?.d ?? 0))} estudo`;
}

export function recruitDelta(unitId: TroopRecruitId, count: number, skillDots?: Record<BuildingSkillSlotId, number>) {
  const value = Math.max(0, Math.floor(count));
  if (unitId === "militia") return `+${Math.floor(value * (1 + (skillDots?.a ?? 0) * 0.02))} pwr`;
  if (unitId === "shooters") return `+${Math.floor(value * 2 * (1 + (skillDots?.b ?? 0) * 0.02))} pwr`;
  if (unitId === "scouts") return `+${value * 2 + (skillDots?.c ?? 0)} vis`;
  return `+${value * 4 + (skillDots?.d ?? 0)} cerco`;
}

export function defenseDelta(unitId: CityDefenseRecruitId, count: number, skillDots?: Record<BuildingSkillSlotId, number>) {
  const value = Math.max(0, Math.floor(count));
  if (unitId === "guards") return `+${Math.floor(value * (1 + (skillDots?.a ?? 0) * 0.02))} def`;
  if (unitId === "archers") return `+${Math.floor(value * 2 * (1 + (skillDots?.b ?? 0) * 0.02))} def`;
  return `+${value * 4 + (skillDots?.c ?? 0)} def`;
}

export function resolveSectorFromBuilding(buildingId: BuildingId | null | undefined): SectorId | null {
  if (!buildingId) return null;
  const found = CITY_SECTORS.find((sector) => sector.formulaBuildingIds.includes(buildingId));
  return found?.id ?? null;
}

export function getSectorById(sectorId: SectorId | null) {
  return sectorId ? CITY_SECTORS.find((sector) => sector.id === sectorId) ?? null : null;
}

export function cityCardTone(tone: CitySector["tone"]) {
  if (tone === "green") return "border-emerald-300/20 bg-emerald-500/8";
  if (tone === "red") return "border-rose-300/20 bg-rose-500/8";
  return "border-cyan-300/20 bg-cyan-500/8";
}

export function sectorCircleTone(sectorId: SectorId) {
  if (sectorId === "economy") return "border-amber-300/26 bg-amber-500/16 text-amber-100";
  if (sectorId === "society") return "border-emerald-300/26 bg-emerald-500/16 text-emerald-100";
  if (sectorId === "recruitment") return "border-rose-300/26 bg-rose-500/16 text-rose-100";
  if (sectorId === "defense") return "border-indigo-300/26 bg-indigo-500/16 text-indigo-100";
  return "border-cyan-300/26 bg-cyan-500/16 text-cyan-100";
}

export function sectorPanelImage(sectorId: SectorId, _cityClass: CityClass, _isCapital = false) {
  return SECTOR_IMAGE_BY_ID[sectorId];
}

export function CostChip({
  kind,
  value,
  affordable = true,
}: {
  kind: "materials" | "supplies" | "infra";
  value: string;
  affordable?: boolean;
}) {
  const baseTone = affordable
    ? "border-white/25 bg-slate-700/70 text-slate-50 font-black"
    : "border-rose-300/50 bg-rose-500/30 text-rose-100 font-black";

  if (kind === "supplies") {
    return (
      <span className={`inline-flex items-center justify-center gap-1 rounded-full border px-1.5 py-1 ${baseTone}`}>
        <img src="/icons/recursos.png" alt="" className="h-5 w-5 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]" />
        {value}
      </span>
    );
  }

  if (kind === "infra") {
    return (
      <span className="inline-flex items-center justify-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-1.5 py-1 text-cyan-100">
        <img src="/icons/influence-infrastructure.png" alt="" className="h-5 w-5 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]" />
        {value}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center justify-center gap-1 rounded-full border px-1.5 py-1 ${baseTone}`}>
      <img src="/icons/producao.png" alt="" className="h-5 w-5 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]" />
      {value}
    </span>
  );
}

export function traitNodeTone(active: boolean) {
  return active
    ? "border-cyan-300/40 bg-cyan-500/14 text-cyan-50"
    : "border-white/12 bg-white/6 text-slate-200";
}

export function cityClassTone(cityClass: CityClass) {
  if (cityClass === "metropole") return "border-cyan-300/35 bg-cyan-500/14 text-cyan-100";
  if (cityClass === "posto_avancado") return "border-rose-300/35 bg-rose-500/14 text-rose-100";
  if (cityClass === "bastiao") return "border-amber-300/35 bg-amber-500/14 text-amber-100";
  if (cityClass === "celeiro") return "border-emerald-300/35 bg-emerald-500/14 text-emerald-100";
  return "border-white/15 bg-white/8 text-slate-200";
}

