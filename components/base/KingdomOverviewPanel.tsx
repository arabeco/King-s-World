"use client";

import { AlertTriangle, Castle, ChevronRight, Flame, Shield, Snowflake, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  SOVEREIGNTY_PORTAL_CUT,
  calculateDefensePower,
  calculateSovereigntyScore,
  calculateTroopPower,
  calculateTribeProgressStage,
  calculateVillageDevelopment,
  calculateVillagePopulationCap,
  getVillageDefenseLevel,
  getVillageGovernmentLevel,
} from "@/core/GameBalance";
import type { HeroSpecialistId } from "@/lib/council";
import {
  HERO_META,
  MILITARY_TECHS,
  type InfluenceAreaSummary,
  buildInfluenceAreas,
  canUnlockMilitaryTech,
  countUnlockedMilitaryTechs,
  getCapitalTechPoints,
} from "@/lib/empire-systems";
import type { ImperialState } from "@/lib/imperial-state";
import { buildKingdomSurvivalState } from "@/lib/kingdom-survival";
import { CITY_CLASS_META, type CityClass } from "@/lib/cities";
import type { VillageSummary } from "@/lib/mock-data";
import {
  applyMeetingChoiceEffects,
  buildIgnoredMeetingOutcome,
  buildSenateClimate,
  previewSenateChoice,
  type PoliticalPressureBand,
  type SenateMeetingChoice,
} from "@/lib/senate-meetings";
import { emitUiFeedback } from "@/lib/ui-feedback";

type KingdomOverviewPanelProps = {
  villages: VillageSummary[];
  activeVillage: VillageSummary;
  worldDay: number;
  worldPhase: string;
  activeAlerts: string[];
  sovereignty: {
    kingAlive: boolean;
    councilHeroes: number;
    militaryRankingPoints: number;
    wondersControlled: number;
    eraQuestsCompleted: number;
    tribeDomeUnlocked: boolean;
    tribeLoyaltyStage?: number;
  };
  tribe: {
    name: string;
    citadelStatus: string;
    totalScore: number;
    rank: number;
    membersAlive: number;
  };
  imperialState: ImperialState;
  setImperialState: (updater: ImperialState | ((current: ImperialState) => ImperialState)) => void;
  onOpenCityView: (villageId?: string) => void;
};

type SheetId = InfluenceAreaSummary["id"] | null;

const CAPITAL_TRANSFER_COST = {
  materials: 420,
  supplies: 360,
} as const;

const CAPITAL_TRANSFER_DAYS = 2;
// Após uma transferência, não dá pra começar outra por 10 dias (impede fuga infinita).
const CAPITAL_TRANSFER_COOLDOWN_DAYS = 10;

function toneClass(tone: "amber" | "cyan" | "rose" | "emerald" | "violet") {
  if (tone === "amber") return "kw-progress__bar--green";
  if (tone === "cyan") return "kw-progress__bar--blue";
  if (tone === "rose") return "kw-progress__bar--red";
  if (tone === "emerald") return "kw-progress__bar--green";
  return "kw-progress__bar--blue";
}

function areaIconSrc(areaId: InfluenceAreaSummary["id"]) {
  if (areaId === "production") return "/icons/influence-infrastructure.png";
  if (areaId === "government") return "/icons/influence-government.png";
  if (areaId === "military") return "/icons/influence-military.png";
  if (areaId === "society") return "/icons/influence-society.png";
  return "/icons/influence-legacy.png";
}

function areaToneShell(tone: InfluenceAreaSummary["tone"]) {
  if (tone === "amber") return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  if (tone === "cyan") return "border-cyan-300/20 bg-cyan-500/10 text-cyan-100";
  if (tone === "rose") return "border-rose-300/20 bg-rose-500/10 text-rose-100";
  if (tone === "emerald") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  return "border-violet-300/20 bg-violet-500/10 text-violet-100";
}

function areaImage(areaId: InfluenceAreaSummary["id"]) {
  if (areaId === "production") return "/images/producao.jpg";
  if (areaId === "government") return "/images/governo.jpg";
  if (areaId === "military") return "/images/card-battle.jpg";
  if (areaId === "society") return "/images/sociedade.jpg";
  return "/images/maravilha.jpg";
}

function areaAccent(tone: InfluenceAreaSummary["tone"]) {
  if (tone === "amber") return "from-amber-300/40 to-orange-500/10";
  if (tone === "cyan") return "from-cyan-300/40 to-sky-500/10";
  if (tone === "rose") return "from-rose-300/40 to-red-500/10";
  if (tone === "emerald") return "from-emerald-300/40 to-teal-500/10";
  return "from-violet-300/40 to-indigo-500/10";
}

function areaOrbitPosition(id: InfluenceAreaSummary["id"]) {
  if (id === "production") return "left-1/2 top-0 -translate-x-1/2";
  if (id === "government") return "left-0 top-1/2 -translate-y-1/2";
  if (id === "military") return "right-0 top-1/2 -translate-y-1/2";
  if (id === "society") return "bottom-0 left-[8%]";
  return "bottom-0 right-[8%]";
}

function pressureBandTone(band: PoliticalPressureBand) {
  if (band === "CRITICAL") return "border-rose-300/40 bg-rose-500/14 text-rose-100";
  if (band === "PRESSURED") return "border-amber-300/40 bg-amber-500/14 text-amber-100";
  if (band === "TENSE") return "border-cyan-300/40 bg-cyan-500/14 text-cyan-100";
  return "border-emerald-300/40 bg-emerald-500/14 text-emerald-100";
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${Math.round(value)}`;
}

function cityClassPanelTone(cityClass: CityClass | undefined, isCapital: boolean) {
  if (isCapital) return "border-cyan-300/35 bg-cyan-500/16";
  if (cityClass === "metropole") return "border-cyan-300/22 bg-cyan-500/10";
  if (cityClass === "posto_avancado") return "border-rose-300/22 bg-rose-500/10";
  if (cityClass === "bastiao") return "border-amber-300/22 bg-amber-500/10";
  if (cityClass === "celeiro") return "border-emerald-300/22 bg-emerald-500/10";
  return "border-white/10 bg-white/5";
}

// Imagem de fundo + ícone por tipo de cidade (mesmo padrão dos cards de estrutura)
const CITY_CARD_IMAGE: Record<string, string> = {
  metropole: "/images/metropole.jpg",
  posto_avancado: "/images/posto.jpg",
  bastiao: "/images/bastiao.jpg",
  celeiro: "/images/celeiro.jpg",
  neutral: "/images/cidade.jpg",
};
const CITY_CARD_ICON: Record<string, string> = {
  metropole: "/cities/metropole-icon.png",
  posto_avancado: "/cities/postoavancado-icon.png",
  bastiao: "/cities/bastiao-icon.png",
  celeiro: "/cities/celeiro-icon.png",
};
function cityCardImage(cityClass: CityClass | undefined, isCapital: boolean) {
  if (isCapital) return "/images/capital.jpg";
  return CITY_CARD_IMAGE[cityClass ?? "neutral"] ?? "/images/cidade.jpg";
}
function cityCardIcon(cityClass: CityClass | undefined, isCapital: boolean) {
  if (isCapital) return "/cities/capital-icon.png";
  return CITY_CARD_ICON[cityClass ?? "neutral"] ?? "/cities/capital-icon.png";
}

export function KingdomOverviewPanel({
  villages,
  activeVillage,
  worldDay,
  worldPhase,
  activeAlerts,
  sovereignty,
  tribe,
  imperialState,
  setImperialState,
  onOpenCityView,
}: KingdomOverviewPanelProps) {
  const [activeSheet, setActiveSheet] = useState<SheetId>(null);
  const assignedHeroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );
  const populationSummary = useMemo(() => {
    return villages.reduce(
      (summary, village) => {
        const cap = calculateVillagePopulationCap(village.buildingLevels);
        const productionWorkers = imperialState.productionWorkersByVillage[village.id] ?? { materials: 0, supplies: 0, commerce: 0, logistics: 0 };
        const jobs = imperialState.jobsByVillage[village.id] ?? { medics: 0, crafts: 0, order: 0, scholars: 0 };
        const recruits = imperialState.recruitsByVillage[village.id] ?? { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
        const defenders = imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 };
        const used =
          Object.values(productionWorkers).reduce((sum, value) => sum + value, 0) +
          Object.values(jobs).reduce((sum, value) => sum + value, 0) +
          Object.values(recruits).reduce((sum, value) => sum + value, 0) +
          Object.values(defenders).reduce((sum, value) => sum + value, 0);
        const current = Math.min(cap, Math.max(used, imperialState.populationByVillage[village.id] ?? cap));
        return {
          current: summary.current + current,
          cap: summary.cap + cap,
          employed: summary.employed + Object.values(productionWorkers).reduce((sum, value) => sum + value, 0) + Object.values(jobs).reduce((sum, value) => sum + value, 0),
          recruited: summary.recruited + Object.values(recruits).reduce((sum, value) => sum + value, 0),
          defended: summary.defended + Object.values(defenders).reduce((sum, value) => sum + value, 0),
        };
      },
      { current: 0, cap: 0, employed: 0, recruited: 0, defended: 0 },
    );
  }, [
    imperialState.defenseRecruitsByVillage,
    imperialState.jobsByVillage,
    imperialState.populationByVillage,
    imperialState.productionWorkersByVillage,
    imperialState.recruitsByVillage,
    villages,
  ]);
  const unlockedTechs = useMemo(
    () => countUnlockedMilitaryTechs(imperialState.militaryTechTree),
    [imperialState.militaryTechTree],
  );

  const tribeStage = calculateTribeProgressStage({
    currentDay: worldDay,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted,
    kingAlive: sovereignty.kingAlive,
  });

  const sovereigntyScore = useMemo(
    () =>
      calculateSovereigntyScore({
        villages,
        villageDevelopments: villages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
        councilHeroes: Math.max(sovereignty.councilHeroes, assignedHeroCount),
        militaryRankingPoints: sovereignty.militaryRankingPoints,
        eraQuestsCompleted: sovereignty.eraQuestsCompleted,
        wondersControlled: sovereignty.wondersControlled,
        currentDay: worldDay,
        hasTribeDome: sovereignty.tribeDomeUnlocked || imperialState.sandboxDomeActive,
        tribeLoyaltyStage: sovereignty.tribeLoyaltyStage ?? tribeStage,
        kingAlive: sovereignty.kingAlive,
        workforce: imperialState.workforceByFocus,
        unlockedMilitaryTechs: unlockedTechs,
        dragonChoice: imperialState.dragonChoice,
        populationCurrent: populationSummary.current,
        populationCapacity: populationSummary.cap,
        employedPopulation: populationSummary.employed,
        recruitedPopulation: populationSummary.recruited,
        senateSatisfaction: imperialState.senate.satisfaction,
        troopPower: calculateTroopPower(imperialState.troops),
        defensePower: villages.reduce(
          (sum, village) => sum + calculateDefensePower(imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 }),
          0,
        ),
      }),
    [
      assignedHeroCount,
      imperialState.dragonChoice,
      imperialState.sandboxDomeActive,
      imperialState.senate.satisfaction,
      imperialState.troops,
      imperialState.workforceByFocus,
      populationSummary,
      sovereignty,
      tribeStage,
      unlockedTechs,
      villages,
      worldDay,
    ],
  );

  const influenceAreas = useMemo(
    () =>
      buildInfluenceAreas({
        villages,
        workforce: imperialState.workforceByFocus,
        militaryTechTree: imperialState.militaryTechTree,
        heroByVillage: imperialState.heroByVillage,
        councilHeroes: Math.max(sovereignty.councilHeroes, assignedHeroCount),
        questsCompleted: sovereignty.eraQuestsCompleted,
        wondersControlled: sovereignty.wondersControlled,
        tribeStage: sovereignty.tribeLoyaltyStage ?? tribeStage,
        score: sovereigntyScore,
        dragonChoice: imperialState.dragonChoice,
      }),
    [
      assignedHeroCount,
      imperialState.dragonChoice,
      imperialState.heroByVillage,
      imperialState.militaryTechTree,
      imperialState.workforceByFocus,
      sovereignty.eraQuestsCompleted,
      sovereignty.councilHeroes,
      sovereignty.tribeLoyaltyStage,
      sovereignty.wondersControlled,
      sovereigntyScore,
      tribeStage,
      villages,
    ],
  );

  const crownState = useMemo(
    () =>
      buildKingdomSurvivalState({
        villages,
        activeAlerts,
        sovereignty: {
          kingAlive: sovereignty.kingAlive,
        },
      }),
    [activeAlerts, sovereignty.kingAlive, villages],
  );

  const senateClimate = useMemo(
    () =>
      buildSenateClimate({
        currentDay: worldDay,
        worldPhase,
        activeAlerts,
        villages,
        resources: imperialState.resources,
        troops: imperialState.troops,
        heroByVillage: imperialState.heroByVillage,
        senateSatisfaction: imperialState.senate.satisfaction,
        politicalNeglect: imperialState.senate.politicalNeglect,
        activeMeeting: imperialState.senate.activeMeeting,
        lastMeetingDay: imperialState.senate.lastMeetingDay,
        resolvedMeetingIds: imperialState.senate.resolvedMeetingIds,
        dismissedHeroes: imperialState.senate.dismissedHeroes,
        questsCompleted: sovereignty.eraQuestsCompleted,
        wondersControlled: sovereignty.wondersControlled,
        sandboxMarchStarted: imperialState.sandboxMarchStarted,
        kingAlive: sovereignty.kingAlive,
        hasTribeDome: imperialState.sandboxDomeActive,
        militaryTechCount: countUnlockedMilitaryTechs(imperialState.militaryTechTree),
        dragonChoice: imperialState.dragonChoice,
      }),
    [
      activeAlerts,
      imperialState.heroByVillage,
      imperialState.resources,
      imperialState.sandboxMarchStarted,
      imperialState.senate.activeMeeting,
      imperialState.senate.dismissedHeroes,
      imperialState.senate.lastMeetingDay,
      imperialState.senate.politicalNeglect,
      imperialState.senate.resolvedMeetingIds,
      imperialState.senate.satisfaction,
      imperialState.troops,
      sovereignty.eraQuestsCompleted,
      sovereignty.kingAlive,
      sovereignty.wondersControlled,
      villages,
      worldDay,
      worldPhase,
    ],
  );

  const capital = useMemo(() => villages.find((village) => village.type === "Capital") ?? villages[0] ?? null, [villages]);
  const capitalTransfer = imperialState.capitalTransfer;
  const senateMeeting = imperialState.senate.activeMeeting;
  const hiredHeroEntries = useMemo(
    () =>
      villages
        .map((entry) => ({
          village: entry,
          heroId: imperialState.heroByVillage[entry.id] ?? "none",
        }))
        .filter((entry): entry is { village: VillageSummary; heroId: HeroSpecialistId } => entry.heroId !== "none"),
    [imperialState.heroByVillage, villages],
  );
  const techPoints = getCapitalTechPoints(villages);
  const availableTechPoints = Math.max(0, techPoints - unlockedTechs);
  const currentCapitalId = capital?.id ?? imperialState.royalCapitalVillageId ?? null;
  const activeVillageWall = getVillageDefenseLevel(activeVillage.buildingLevels);
  const activeVillagePalace = Math.max(getVillageGovernmentLevel(activeVillage.buildingLevels), activeVillage.palaceLevel ?? 0);
  const activeVillageDevelopment = calculateVillageDevelopment(activeVillage.buildingLevels);
  const activeVillageCanReceiveCapital =
    activeVillage.id !== currentCapitalId &&
    !activeVillage.underAttack &&
    activeVillageWall >= 6 &&
    activeVillagePalace >= 6 &&
    activeVillageDevelopment >= 70;
  const canAffordCapitalTransfer =
    imperialState.resources.materials >= CAPITAL_TRANSFER_COST.materials &&
    imperialState.resources.supplies >= CAPITAL_TRANSFER_COST.supplies;
  // Pode transferir preventivamente (planeando), não só em emergência.
  // O trade-off é o custo + os 2 dias de marcha em que o rei fica vulnerável + 10 dias de cooldown.
  const isInCooldown = worldDay < (capitalTransfer.cooldownUntilDay ?? 0);
  const cooldownDaysLeft = Math.max(0, (capitalTransfer.cooldownUntilDay ?? 0) - worldDay);
  const canStartCapitalTransfer =
    !capitalTransfer.active &&
    !isInCooldown &&
    activeVillageCanReceiveCapital &&
    canAffordCapitalTransfer;
  const transferTarget = capitalTransfer.targetVillageId
    ? villages.find((village) => village.id === capitalTransfer.targetVillageId) ?? null
    : null;
  const openedInfluenceArea = activeSheet ? influenceAreas.find((area) => area.id === activeSheet) ?? null : null;
  const totalInfluence = useMemo(() => influenceAreas.reduce((sum, area) => sum + area.current, 0), [influenceAreas]);

  useEffect(() => {
    if (!capitalTransfer.active || !capitalTransfer.targetVillageId || worldDay < capitalTransfer.endsAtDay) {
      return;
    }

    setImperialState((current) => ({
      ...current,
      royalCapitalVillageId: current.capitalTransfer.targetVillageId,
      capitalTransfer: {
        active: false,
        sourceVillageId: null,
        targetVillageId: null,
        startedAtDay: 0,
        endsAtDay: 0,
        materialsCost: 0,
        suppliesCost: 0,
        influenceCost: 0,
        // Cooldown de 10 dias após completar — impede fuga em série.
        cooldownUntilDay: worldDay + CAPITAL_TRANSFER_COOLDOWN_DAYS,
      },
      senate: {
        ...current.senate,
        satisfaction: Math.max(0, Math.min(100, current.senate.satisfaction - 4)),
      },
      logs: [
        `A Capital foi transferida para ${
          villages.find((village) => village.id === current.capitalTransfer.targetVillageId)?.name ?? "a nova cidade"
        }`,
        ...current.logs,
      ].slice(0, 12),
    }));
  }, [capitalTransfer.active, capitalTransfer.endsAtDay, capitalTransfer.targetVillageId, setImperialState, villages, worldDay]);

  useEffect(() => {
    const shouldSyncPressure =
      imperialState.senate.politicalPressure !== senateClimate.politicalPressure ||
      imperialState.senate.pressureBand !== senateClimate.pressureBand;
    const shouldOpenMeeting =
      !imperialState.senate.activeMeeting && senateClimate.shouldOfferMeeting && Boolean(senateClimate.suggestedMeeting);

    if (!shouldSyncPressure && !shouldOpenMeeting) {
      return;
    }

    setImperialState((current) => {
      const nextShouldOpenMeeting =
        !current.senate.activeMeeting && senateClimate.shouldOfferMeeting && senateClimate.suggestedMeeting;

      return {
        ...current,
        senate: {
          ...current.senate,
          politicalPressure: senateClimate.politicalPressure,
          pressureBand: senateClimate.pressureBand,
          activeMeeting: nextShouldOpenMeeting ? senateClimate.suggestedMeeting : current.senate.activeMeeting,
        },
        logs: nextShouldOpenMeeting
          ? [`Reuniao do Imperio exige decisao: ${senateClimate.suggestedMeeting?.title}`, ...current.logs].slice(0, 12)
          : current.logs,
      };
    });
  }, [
    imperialState.senate.activeMeeting,
    imperialState.senate.politicalPressure,
    imperialState.senate.pressureBand,
    senateClimate.politicalPressure,
    senateClimate.pressureBand,
    senateClimate.shouldOfferMeeting,
    senateClimate.suggestedMeeting,
    setImperialState,
  ]);

  const unlockTech = (id: (typeof MILITARY_TECHS)[number]["id"]) => {
    if (!canUnlockMilitaryTech({ id, tree: imperialState.militaryTechTree, villages, dragonChoice: imperialState.dragonChoice })) {
      return;
    }
    const tech = MILITARY_TECHS.find((entry) => entry.id === id);
    if (!tech) return;
    setImperialState((current) => ({
      ...current,
      militaryTechTree: {
        ...current.militaryTechTree,
        [id]: 1,
      },
      dragonChoice: tech.dragon ?? current.dragonChoice,
      logs: [`Doutrina liberada: ${tech.label}`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("open", tech.dragon ? "heavy" : "medium");
  };

  const resolveMeeting = (choice: SenateMeetingChoice) => {
    const meeting = imperialState.senate.activeMeeting;
    if (!meeting) return;
    const result = applyMeetingChoiceEffects({
      state: imperialState.senate,
      resources: imperialState.resources,
      troops: imperialState.troops,
      meeting,
      choice,
    });
    setImperialState((current) => ({
      ...current,
      resources: result.resources,
      troops: result.troops,
      senate: result.senate,
      logs: [`Reuniao do Imperio: ${meeting.title} -> ${choice.label}`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("open", "medium");
  };

  const ignoreMeeting = () => {
    const meeting = imperialState.senate.activeMeeting;
    if (!meeting) return;
    const ignored = buildIgnoredMeetingOutcome({ state: imperialState.senate, meeting });
    setImperialState((current) => {
      const nextHeroByVillage = { ...current.heroByVillage };
      if (ignored.dismissedHero) {
        for (const [villageId, heroId] of Object.entries(nextHeroByVillage)) {
          if (heroId === ignored.dismissedHero) nextHeroByVillage[villageId] = "none";
        }
      }
      return {
        ...current,
        heroByVillage: nextHeroByVillage,
        senate: ignored.senate,
        logs: [
          ignored.dismissedHero
            ? `${HERO_META[ignored.dismissedHero].label} deixou o conselho apos negligencia repetida`
            : `Reuniao ignorada: ${meeting.title}`,
          ...current.logs,
        ].slice(0, 12),
      };
    });
    emitUiFeedback("close", "medium");
  };

  const startCapitalTransfer = () => {
    if (!currentCapitalId || !canStartCapitalTransfer) return;
    setImperialState((current) => ({
      ...current,
      resources: {
        ...current.resources,
        materials: current.resources.materials - CAPITAL_TRANSFER_COST.materials,
        supplies: current.resources.supplies - CAPITAL_TRANSFER_COST.supplies,
      },
      capitalTransfer: {
        active: true,
        sourceVillageId: currentCapitalId,
        targetVillageId: activeVillage.id,
        startedAtDay: worldDay,
        endsAtDay: worldDay + CAPITAL_TRANSFER_DAYS,
        materialsCost: CAPITAL_TRANSFER_COST.materials,
        suppliesCost: CAPITAL_TRANSFER_COST.supplies,
        influenceCost: 0,
        // Cooldown só passa a valer depois da transferência concluir.
        cooldownUntilDay: current.capitalTransfer.cooldownUntilDay ?? 0,
      },
      senate: {
        ...current.senate,
        satisfaction: Math.max(0, Math.min(100, current.senate.satisfaction - 6)),
        politicalPressure: Math.max(0, current.senate.politicalPressure - 8),
      },
      logs: [`Transferencia da Capital iniciada para ${activeVillage.name}`, ...current.logs].slice(0, 12),
    }));
    emitUiFeedback("open", "heavy");
  };

  return (
    <>
      <section className="space-y-3 md:mx-auto md:max-w-3xl">
        <article className="kw-glass rounded-[28px] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Imperio</p>
              <h2 className="kw-title text-lg">Influencia viva do reino</h2>
              <p className="mt-1 text-[11px] text-slate-300">
                Capital {capital?.name ?? "Capital"} · tribo {tribe.name} · Dia {worldDay}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCityView(activeVillage.id)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/8"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Cidade</p>
              <p className="mt-1 text-sm font-black text-slate-100">{activeVillage.name}</p>
            </button>
          </div>
          <div className="relative mx-auto mt-4 h-[360px] max-w-[340px]">
            <div className="absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200/45 bg-[radial-gradient(circle_at_50%_15%,rgba(103,232,249,0.28),rgba(8,47,73,0.2)_42%,rgba(2,6,23,0.86)_100%)] p-2 text-center shadow-[0_0_34px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.16)]">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/10 bg-slate-950/35 px-3 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-100/80">Influencia</p>
                <p className="mt-1 text-4xl font-black leading-none text-white tabular-nums">{Math.round(totalInfluence)}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">de {sovereigntyScore.max}</p>
                <p className={`mt-2 rounded-full border px-2 py-1 text-[10px] font-black ${sovereigntyScore.portalEligible ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100" : "border-amber-300/35 bg-amber-500/15 text-amber-100"}`}>
                  {sovereigntyScore.portalEligible ? "Portal liberado" : `${Math.max(0, SOVEREIGNTY_PORTAL_CUT - Math.round(totalInfluence))} faltando`}
                </p>
              </div>
            </div>

            {influenceAreas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => {
                  emitUiFeedback("open", "light");
                  setActiveSheet(area.id);
                }}
                className={`group absolute min-h-[88px] w-28 overflow-hidden rounded-[22px] border p-2.5 text-left shadow-[0_10px_30px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-white/30 ${areaToneShell(area.tone)} ${areaOrbitPosition(area.id)}`}
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.16), rgba(2,6,23,0.88)), url('${areaImage(area.id)}')`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }}
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b ${areaAccent(area.tone)}`} />
                <div className="pointer-events-none absolute inset-0 bg-slate-950/18 transition group-hover:bg-slate-950/4" />
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <img src={areaIconSrc(area.id)} alt="" className="h-8 w-8 object-contain drop-shadow-[0_2px_7px_rgba(0,0,0,0.72)]" />
                    <span className="rounded-full border border-white/20 bg-slate-950/45 px-1.5 py-0.5 text-[9px] font-black text-slate-100 backdrop-blur">
                      {Math.round((area.current / area.max) * 100)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">{area.label}</p>
                    <p className="mt-0.5 text-2xl font-black leading-none text-slate-50 tabular-nums">{Math.round(area.current)}</p>
                    <p className="mt-0.5 text-[9px] font-bold text-slate-300">/{area.max}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={`flex min-h-[56px] items-center gap-2.5 rounded-2xl border p-2.5 ${sovereigntyScore.portalEligible ? "border-emerald-300/35 bg-emerald-500/12" : "border-white/10 bg-white/5"}`}>
              <span className="text-2xl" aria-hidden>🌀</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Portal</p>
                <p className={`text-base font-black leading-tight ${sovereigntyScore.portalEligible ? "text-emerald-100" : "text-amber-100"}`}>
                  {sovereigntyScore.portalEligible ? "Liberado" : "Fechado"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenCityView(activeVillage.id)}
              className="flex min-h-[56px] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:bg-white/8"
            >
              <span className="text-2xl" aria-hidden>🎯</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Foco</p>
                <p className="text-base font-black leading-tight text-slate-100">{calculateVillageDevelopment(activeVillage.buildingLevels)}/100</p>
              </div>
            </button>
          </div>
        </article>

        {villages.some((v) => v.underAttack) ? (
          <article className="rounded-[24px] border border-rose-300/40 bg-rose-500/16 p-3">
            <div className="flex items-start gap-2">
              <Castle className="mt-0.5 h-4 w-4 text-rose-200" />
              <div>
                <p className="text-[12px] font-black text-rose-50">⚔️ Ataque chegando na Capital</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-200">
                  Bastião {crownState.capitalDefenseScore}/100 · muralha {crownState.capitalWallLevel}/10 · palácio {crownState.capitalPalaceLevel}/10
                </p>
                {capitalTransfer.active ? (
                  <p className="mt-1 text-[10px] font-semibold text-cyan-100">
                    Capital em transferencia para {transferTarget?.name ?? "novo destino"} ate o Dia {capitalTransfer.endsAtDay}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}

        <button
          type="button"
          data-smoke="senate-button"
          onClick={() => {
            emitUiFeedback("open", "light");
            setActiveSheet("government");
          }}
          className={`flex w-full items-center justify-between gap-2 rounded-[24px] border p-3 text-left transition ${
            senateMeeting
              ? "animate-pulse border-amber-300/60 bg-amber-500/20 shadow-[0_0_16px_rgba(251,191,36,0.4)]"
              : "border-white/12 bg-white/5 hover:bg-white/8"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg" aria-hidden>🏛️</span>
            <div className="min-w-0">
              <p className={`text-sm font-black ${senateMeeting ? "text-amber-50" : "text-slate-100"}`}>Senado</p>
              {senateMeeting ? (
                <p className="mt-0.5 truncate text-[11px] text-amber-100/90">{senateMeeting.title}</p>
              ) : null}
            </div>
          </div>
          {senateMeeting ? (
            <span className="shrink-0 rounded-full border border-amber-300/40 bg-amber-400/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-50">
              Decidir
            </span>
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
          )}
        </button>

        <article className="kw-glass rounded-[24px] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Cidades</p>
              <p className="mt-1 text-sm font-black text-slate-100">{villages.length} no reino</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300" />
          </div>
          <div className="mt-3 space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0">
            {villages.map((village) => {
              const development = calculateVillageDevelopment(village.buildingLevels);
              const isCapital = village.type === "Capital";
              const cityClass = village.cityClass ?? "neutral";
              return (
                <button
                  key={village.id}
                  type="button"
                  onClick={() => onOpenCityView(village.id)}
                  className={`relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[22px] border p-3 text-left transition hover:bg-white/8 ${cityClassPanelTone(cityClass, isCapital)}`}
                  style={{
                    backgroundImage: `linear-gradient(100deg, rgba(2,6,23,0.84), rgba(15,23,42,0.55) 55%, rgba(2,6,23,0.82)), url('${cityCardImage(cityClass, isCapital)}')`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/45 to-slate-950/35" />
                  <div className="relative flex min-w-0 items-center gap-3">
                    <img
                      src={cityCardIcon(cityClass, isCapital)}
                      alt=""
                      className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)]"
                    />
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-black ${isCapital ? "text-cyan-50" : "text-slate-100"}`}>{village.name}</p>
                      <p className={`mt-1 text-[11px] font-semibold ${isCapital ? "text-cyan-100/90" : "text-slate-300"}`}>
                        {isCapital ? "Capital" : "Cidade"} · {CITY_CLASS_META[cityClass].label}
                      </p>
                    </div>
                  </div>
                  <div className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm ${isCapital ? "border-cyan-200/40 bg-cyan-500/20" : "border-white/12 bg-slate-950/45"}`}>
                    <p className={`text-lg font-black leading-none tabular-nums ${isCapital ? "text-cyan-50" : "text-slate-100"}`}>{development}</p>
                    <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-slate-300">/100</p>
                  </div>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      {activeSheet ? (
        <div className="fixed inset-0 z-[72]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => {
              emitUiFeedback("close", "light");
              setActiveSheet(null);
            }}
          />
          <div className="absolute inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+18px)] top-[calc(env(safe-area-inset-top)+36px)] mx-auto flex w-auto max-w-md">
            <div className="kw-glass flex h-full w-full flex-col overflow-hidden rounded-[30px] p-3 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Influencia</p>
                  <h3 className="kw-title text-lg">
                    {openedInfluenceArea ? openedInfluenceArea.label : "Influencia"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    emitUiFeedback("close", "light");
                    setActiveSheet(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                {openedInfluenceArea ? (
                  <div className="space-y-2">
                    <article
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3"
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.22), rgba(2,6,23,0.9)), url('${areaImage(openedInfluenceArea.id)}')`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <img src={areaIconSrc(openedInfluenceArea.id)} alt="" className="h-8 w-8 object-contain drop-shadow-[0_2px_7px_rgba(0,0,0,0.72)]" />
                          <p className="text-sm font-black text-slate-100">{openedInfluenceArea.label}</p>
                        </div>
                        <span className="rounded-full border border-white/20 bg-slate-950/45 px-2 py-1 text-[10px] font-bold text-slate-100 backdrop-blur">
                          {openedInfluenceArea.current}/{openedInfluenceArea.max}
                        </span>
                      </div>
                      <div className="kw-progress mt-2">
                        <div
                          className={`kw-progress__bar ${toneClass(openedInfluenceArea.tone)}`}
                          style={{ width: `${(openedInfluenceArea.current / openedInfluenceArea.max) * 100}%` }}
                        />
                      </div>
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-slate-950/35 p-3 backdrop-blur">
                      <p className="text-[11px] font-semibold text-slate-100">Fontes</p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {openedInfluenceArea.id === "production"
                          ? `Base: soma dos niveis dos 5 predios das ${villages.length} cidades consideradas no reino.`
                          : openedInfluenceArea.id === "government"
                            ? "Base: herois vivos no Governo. Cada heroi vale 50 pontos."
                            : openedInfluenceArea.id === "military"
                              ? "Base: tropas ofensivas + defesa local + doutrina + dragao."
                              : openedInfluenceArea.id === "society"
                                ? "Base: populacao, empregos e estabilidade."
                                : "Base: quests, ate duas maravilhas e pacto tribal."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {openedInfluenceArea.id === "production" ? (
                          <>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Governo</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Producao</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Sociedade</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Quartel</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Muralha</span>
                          </>
                        ) : null}
                        {openedInfluenceArea.id === "government" ? (
                          <>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Capital</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Clima politico</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Herois contratados</span>
                          </>
                        ) : null}
                        {openedInfluenceArea.id === "military" ? (
                          <>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Tropas</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Defesa local</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Doutrina</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Dragao</span>
                          </>
                        ) : null}
                        {openedInfluenceArea.id === "society" ? (
                          <>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Sociedade</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Empregos</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Estabilidade</span>
                          </>
                        ) : null}
                        {openedInfluenceArea.id === "legacy" ? (
                          <>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Quests</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Maravilhas</span>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">Tribo</span>
                          </>
                        ) : null}
                      </div>
                    </article>
                    {openedInfluenceArea.id === "government" ? (
                      <div className="space-y-2">
                        <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-black text-slate-100">Governo</p>
                              <p className="mt-1 text-[11px] text-slate-300">
                                {senateClimate.reasons.length > 0 ? senateClimate.reasons.join(" · ") : "O clima politico esta estavel por enquanto."}
                              </p>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${pressureBandTone(imperialState.senate.pressureBand)}`}>
                              {imperialState.senate.pressureBand}
                            </span>
                          </div>
                        </article>

                        {senateMeeting ? (
                          <article className="rounded-[24px] border border-amber-300/25 bg-amber-500/10 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/85">
                                  {senateMeeting.kind === "CRITICAL" ? "Decisao politica" : "Reuniao disponivel"}
                                </p>
                                <p className="mt-1 text-base font-black text-amber-50">{senateMeeting.title}</p>
                              </div>
                              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${pressureBandTone(imperialState.senate.pressureBand)}`}>
                                {senateMeeting.kind}
                              </span>
                            </div>
                            <p className="mt-2 text-[12px] text-amber-50">{senateMeeting.situation}</p>
                            <p className="mt-2 rounded-2xl border border-white/10 bg-slate-950/25 px-3 py-2 text-[11px] text-slate-100">
                              {senateMeeting.heroLine}
                            </p>
                            <div className="mt-3 space-y-2">
                              {senateMeeting.choices.map((choice) => {
                                const preview = previewSenateChoice(choice, imperialState.senate.satisfaction);
                                return (
                                  <button
                                    key={choice.id}
                                    type="button"
                                    onClick={() => resolveMeeting(choice)}
                                    className="w-full rounded-2xl border border-white/12 bg-white/8 p-3 text-left transition hover:bg-white/12"
                                  >
                                    <p className="text-sm font-black text-slate-50">{choice.label}</p>
                                    <p className="mt-1 text-[11px] text-slate-200">{choice.note}</p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {preview.lines.map((line) => (
                                        <span
                                          key={`${choice.id}-${line.label}`}
                                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                                            line.tone === "positive"
                                              ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                                              : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                                          }`}
                                        >
                                          {line.label}
                                        </span>
                                      ))}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={ignoreMeeting}
                              className="mt-3 w-full rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-[11px] font-bold text-slate-200"
                            >
                              Ignorar reuniao
                            </button>
                          </article>
                        ) : null}

                        <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-black text-slate-100">Herois contratados</p>
                              <p className="mt-1 text-[11px] text-slate-300">Contratacao fica no Governo de cada cidade.</p>
                            </div>
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-500/12 px-2 py-1 text-[10px] font-bold text-cyan-100">
                              {assignedHeroCount}/10
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {hiredHeroEntries.length > 0 ? (
                              hiredHeroEntries.map(({ village, heroId }) => (
                                <button
                                  key={`${village.id}-${heroId}`}
                                  type="button"
                                  onClick={() => onOpenCityView(village.id)}
                                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:bg-white/8"
                                >
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-100">{HERO_META[heroId].label}</p>
                                    <p className="mt-1 text-[10px] text-slate-300">{village.name}</p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </button>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenCityView(activeVillage.id)}
                                className="w-full rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2.5 text-left text-[11px] font-bold text-cyan-100"
                              >
                                Abrir Governo da cidade
                              </button>
                            )}
                          </div>
                        </article>

                        <article className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-black text-slate-100">Mover Capital</p>
                              <p className="mt-1 text-[11px] text-slate-300">So em crise real e com cidade forte o suficiente.</p>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${pressureBandTone(imperialState.senate.pressureBand)}`}>
                              {crownState.crownRiskBand === "danger" ? "Crise" : "Fechado"}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-300">
                            Alvo: {activeVillage.name} · muralha {activeVillageWall}/10 · palacio {activeVillagePalace}/10 · dev {activeVillageDevelopment}/100
                          </p>
                          {capitalTransfer.active ? (
                            <p className="mt-2 text-[11px] font-semibold text-cyan-100">
                              Transferencia em curso para {transferTarget?.name ?? "novo destino"} ate o Dia {capitalTransfer.endsAtDay}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={startCapitalTransfer}
                            disabled={!canStartCapitalTransfer}
                            className="mt-3 w-full rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-[11px] font-bold text-cyan-100 disabled:border-white/15 disabled:bg-white/8 disabled:text-slate-400"
                          >
                            {capitalTransfer.active
                              ? `Transferência em curso até o Dia ${capitalTransfer.endsAtDay}`
                              : isInCooldown
                                ? `Coroa fixada por mais ${cooldownDaysLeft} dia(s)`
                                : !activeVillageCanReceiveCapital
                                  ? "Cidade selecionada ainda não segura a Coroa"
                                  : !canAffordCapitalTransfer
                                    ? "Recursos insuficientes"
                                    : `Transferir Capital para ${activeVillage.name}`}
                          </button>
                        </article>
                      </div>
                    ) : null}

                    {openedInfluenceArea.id === "military" ? (
                      <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Pontos</p>
                        <p className="mt-1 text-lg font-black text-slate-100">{techPoints}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Livres</p>
                        <p className="mt-1 text-lg font-black text-emerald-100">{availableTechPoints}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Dragao</p>
                        <p className="mt-1 text-sm font-black text-slate-100">
                          {imperialState.dragonChoice === "none" ? "Nenhum" : imperialState.dragonChoice === "fire" ? "Fogo" : "Gelo"}
                        </p>
                      </div>
                    </div>

                    {MILITARY_TECHS.map((tech) => {
                      const unlocked = Boolean(imperialState.militaryTechTree[tech.id]);
                      const canUnlock = canUnlockMilitaryTech({
                        id: tech.id,
                        tree: imperialState.militaryTechTree,
                        villages,
                        dragonChoice: imperialState.dragonChoice,
                      });

                      return (
                        <article key={tech.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                {tech.dragon === "fire" ? <Flame className="h-4 w-4 text-rose-300" /> : null}
                                {tech.dragon === "ice" ? <Snowflake className="h-4 w-4 text-cyan-300" /> : null}
                                {!tech.dragon ? <Shield className="h-4 w-4 text-slate-300" /> : null}
                                <p className="text-sm font-black text-slate-100">{tech.label}</p>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-300">{tech.summary}</p>
                            </div>
                            <span className="rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-bold text-slate-200">
                              {unlocked ? "Ativa" : tech.branch === "capstone" ? "Capstone" : "1 ponto"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => unlockTech(tech.id)}
                            disabled={!canUnlock}
                            className={`mt-3 w-full rounded-xl border px-3 py-2 text-[11px] font-bold ${
                              unlocked
                                ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                                : canUnlock
                                  ? "border-cyan-300/35 bg-cyan-500/15 text-cyan-100"
                                  : "border-white/15 bg-white/8 text-slate-400"
                            }`}
                          >
                            {unlocked
                              ? "Ja desbloqueada"
                              : tech.dragon
                                ? `Escolher ${tech.dragon === "fire" ? "Dragao de Fogo" : "Dragao de Gelo"}`
                                : "Desbloquear"}
                          </button>
                        </article>
                      );
                    })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
