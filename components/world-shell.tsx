﻿"use client";

import type { ChangeEvent, ReactNode } from "react";
import { Compass, HelpCircle, Target, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { BottomNavigation } from "@/components/BottomNavigation";
import { Header } from "@/components/Header";
import { SandboxDayDeltaModal } from "@/components/sandbox/SandboxDayDeltaModal";
import { SandboxProgressEngine } from "@/components/sandbox/SandboxProgressEngine";
import { WorldLoadingScreen } from "@/components/world-loading-screen";
import { WorldAssistant } from "@/components/world-assistant";
import { calculateBuildingUpgradeCost, calculateDefensePower, calculateSovereigntyScore, calculateTribeProgressStage, calculateTroopPower, calculateVillageDevelopment, type EvolutionMode } from "@/core/GameBalance";
import { countUnlockedMilitaryTechs } from "@/lib/empire-systems";
import { ImperialStateProvider, mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { KING_PROFILES, type KingProfileId } from "@/lib/king-profiles";
import { buildKingdomSurvivalState } from "@/lib/kingdom-survival";
import { emitUiFeedback, emitUiToast } from "@/lib/ui-feedback";
import type { WorldPayload } from "@/lib/world-data";
import { buildGuide, buildSandboxCoachCta, resolveBuild, type WorldTab as GuideWorldTab } from "@/lib/world-assistant-guide";
import { LiveWorldProvider, useLiveWorld } from "@/lib/world-runtime";

type WorldTab = "empire" | "base" | "board" | "intelligence" | "guide";

const EVOLUTION_MODE_IDS: EvolutionMode[] = ["balanced", "metropole", "vanguard", "bastion", "flow"];

const WORLD_PRELOAD_IMAGES = [
  "/world/main-map0.png",
  "/world/lobby2.png",
  "/icons/nav-empire.png",
  "/icons/nav-cities.png",
  "/icons/nav-intel.png",
  "/icons/nav-world.png",
  "/icons/nav-profile.png",
  "/icons/influencia-icon.png",
  "/icons/producao.png",
  "/icons/recursos.png",
  "/icons/populacao.png",
  "/icons/exercito.png",
  "/images/governo.jpg",
  "/images/producao.jpg",
  "/images/sociedade.jpg",
  "/images/quartel.jpg",
  "/images/muralha.jpg",
  "/images/help.jpg",
  "/images/card-council.jpg",
  "/images/card-expansion.jpg",
  "/images/card-opportunity.jpg",
  "/images/day-report.jpg",
  "/images/battle-report.jpg",
  "/images/capital.jpg",
  "/images/metropole.jpg",
  "/images/cidade.jpg",
  "/images/king-aurelian.jpg",
  "/images/king-magnor.jpg",
  "/images/king-valerius.jpg",
  "/images/king-orian.jpg",
  "/images/queen-serenna.jpg",
  "/images/queen-isolde.jpg",
  "/images/queen-maelis.jpg",
  "/images/queen-nyra.jpg",
  "/images/king-corven.jpg",
  "/cities/capital-icon.png",
  "/cities/neutra-icon.png",
  "/cities/metropole-icon.png",
  "/cities/bastiao-icon.png",
  "/cities/celeiro-icon.png",
  "/cities/postoavancado-icon.png",
];

const WORLD_BOOT_MIN_MS = 2400;
const WORLD_BOOT_MAX_MS = 5000;

function resolveKingPortraitStyle(kingId: KingProfileId): { backgroundPositionY: string; backgroundSize: string } {
  void kingId;
  return {
    backgroundPositionY: "100%",
    backgroundSize: "100%",
  };
}

function normalizeEvolutionMode(input: string | null): EvolutionMode | undefined {
  if (!input) {
    return undefined;
  }

  return EVOLUTION_MODE_IDS.includes(input as EvolutionMode) ? (input as EvolutionMode) : undefined;
}

function compactAmount(value: number): string {
  if (value >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const formatted = (value / 1_000).toFixed(value >= 100_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}k`;
  }
  return `${value}`;
}

function TopMetric({
  label,
  value,
  tone,
  iconSrc,
  full = false,
}: {
  label: string;
  value: string;
  tone: string;
  iconSrc: string;
  full?: boolean;
}) {
  return (
    <div
      title={full ? `${label} — armazém CHEIO, produção desperdiçada` : label}
      className={`kw-resource-chip flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 ${
        full ? "animate-pulse border border-rose-300/60 bg-rose-500/20" : "kw-hud-chip"
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${tone}`}>
        <img src={iconSrc} alt="" className="h-8 w-8 max-w-none object-contain drop-shadow-[0_3px_7px_rgba(0,0,0,0.72)]" />
      </span>
      <span className={`truncate text-[10px] font-black ${full ? "text-rose-100" : "text-slate-100"}`}>{value}</span>
    </div>
  );
}

function worldTabLabel(tab: GuideWorldTab): string {
  if (tab === "base") return "Cidades";
  if (tab === "board") return "Mundo";
  if (tab === "empire") return "Império";
  if (tab === "guide") return "Perfil";
  return "Comando";
}

export function WorldShell({
  worldId,
  initialPayload,
  children,
}: {
  worldId: string;
  initialPayload: WorldPayload;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segment = useSelectedLayoutSegment();
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedKingId, setSelectedKingId] = useState<KingProfileId>("aurelian");
  const [kingNameDraft, setKingNameDraft] = useState("");
  const [kingSelectionSaving, setKingSelectionSaving] = useState(false);
  const [kingSelectionError, setKingSelectionError] = useState<string | null>(null);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [bootBypass, setBootBypass] = useState(false);

  const liveWorld = useLiveWorld(worldId, initialPayload);
  const { world, worldMeta, runtimeState, isSandboxWorld, campaignDate } = liveWorld;
  const imperialRuntime = useImperialState(worldId, world.villages);
  const { imperialState, setImperialState, isImperialStateReady, isImperialStateHydrated } = imperialRuntime;
  const selectedKingProfile = useMemo(
    () => KING_PROFILES.find((profile) => profile.id === selectedKingId) ?? KING_PROFILES[0],
    [selectedKingId],
  );
  const mergedVillages = mergeImperialVillages(world.villages, imperialState);
  const selectedVillageId = searchParams.get("v") ?? world.activeVillageId;
  const evolutionMode = searchParams.get("m");
  const baseSubTab = searchParams.get("sb") === "city" ? "city" : "kingdom";
  const activeVillage = mergedVillages.find((village) => village.id === selectedVillageId) ?? mergedVillages[0];
  const questsCompleted = isSandboxWorld ? imperialState.sandboxQuestsCompleted : world.sovereignty.eraQuestsCompleted;
  const wondersControlled = isSandboxWorld ? imperialState.sandboxWondersBuilt : world.sovereignty.wondersControlled;
  const tribeStage = calculateTribeProgressStage({
    currentDay: world.day,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted ?? 0,
    kingAlive: world.sovereignty.kingAlive,
  });
  const assignedHeroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );
  const populationSummary = useMemo(() => {
    return mergedVillages.reduce(
      (summary, village) => {
        const cap = Math.min(100, Math.max(0, Math.floor((village.buildingLevels.housing ?? 0) * 10)));
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
    mergedVillages,
  ]);
  const sovereigntyScore = useMemo(
    () =>
      calculateSovereigntyScore({
        villages: mergedVillages,
        villageDevelopments: mergedVillages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
        councilHeroes: Math.max(world.sovereignty.councilHeroes, assignedHeroCount),
        militaryRankingPoints: world.sovereignty.militaryRankingPoints,
        eraQuestsCompleted: questsCompleted,
        wondersControlled,
        currentDay: world.day,
        hasTribeDome: world.sovereignty.tribeDomeUnlocked || imperialState.sandboxDomeActive,
        tribeLoyaltyStage: world.sovereignty.tribeLoyaltyStage ?? tribeStage,
        kingAlive: world.sovereignty.kingAlive,
        workforce: imperialState.workforceByFocus,
        unlockedMilitaryTechs: countUnlockedMilitaryTechs(imperialState.militaryTechTree),
        dragonChoice: imperialState.dragonChoice,
        populationCurrent: populationSummary.current,
        populationCapacity: populationSummary.cap,
        employedPopulation: populationSummary.employed,
        recruitedPopulation: populationSummary.recruited,
        senateSatisfaction: imperialState.senate.satisfaction,
        troopPower: calculateTroopPower(imperialState.troops),
        defensePower: mergedVillages.reduce(
          (sum, village) => sum + calculateDefensePower(imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 }),
          0,
        ),
      }),
    [
      assignedHeroCount,
      imperialState.dragonChoice,
      imperialState.militaryTechTree,
      imperialState.sandboxDomeActive,
      imperialState.senate.satisfaction,
      imperialState.troops,
      imperialState.tribeEnvoysCommitted,
      imperialState.workforceByFocus,
      mergedVillages,
      populationSummary,
      questsCompleted,
      tribeStage,
      wondersControlled,
      world.day,
      world.sovereignty,
    ],
  );
  const crownState = buildKingdomSurvivalState({
    villages: mergedVillages,
    activeAlerts: world.activeAlerts,
    sovereignty: {
      kingAlive: world.sovereignty.kingAlive,
    },
    defense: {
      // ⚔️ Tropas totais do império (proxy de guarnição da capital)
      capitalStationedTroops:
        imperialState.troops.militia + imperialState.troops.shooters + imperialState.troops.scouts + imperialState.troops.machinery,
      // 🏛️ Maravilhas + heróis de conselho
      wondersControlled: wondersControlled,
      councilHeroes: Math.max(world.sovereignty.councilHeroes, assignedHeroCount),
      // 🌾 Excedente de suprimento
      surplusSupplies: imperialState.resources.supplies,
    },
    // Rei em trânsito durante transferência → defesa cai pela metade.
    kingInTransit: imperialState.capitalTransfer.active,
  });
  const activeTab: WorldTab =
    segment === "empire" ||
    segment === "board" ||
    segment === "intelligence" ||
    segment === "guide" ||
    segment === "base"
      ? segment
      : "base";
  const isReportRoute = segment === "report";
  const showCityHeader = activeTab === "base" && !isReportRoute;
  const showGlobalCrownBanner = activeTab === "intelligence";
  const showBottomNavigation = !isReportRoute;
  // Glow de atenção na bottom nav: senado com decisão, cidade evoluível, tropas paradas.
  const navAttention = useMemo(() => {
    const totalTroops =
      imperialState.troops.militia + imperialState.troops.shooters + imperialState.troops.scouts + imperialState.troops.machinery;
    const troopsIdle =
      totalTroops > 0 && !imperialState.mapMovements.some((movement) => movement.status === "traveling");

    let cityCanEvolve = false;
    for (const village of mergedVillages) {
      const entries = Object.entries(village.buildingLevels ?? {}) as Array<
        [Parameters<typeof calculateBuildingUpgradeCost>[0], number]
      >;
      for (const [buildingId, level] of entries) {
        if (typeof level !== "number" || level >= 10) continue;
        try {
          const cost = calculateBuildingUpgradeCost(buildingId, level + 1);
          if (cost.materials <= imperialState.resources.materials && cost.supplies <= imperialState.resources.supplies) {
            cityCanEvolve = true;
            break;
          }
        } catch {
          // prédio desconhecido — ignora
        }
      }
      if (cityCanEvolve) break;
    }

    return {
      empire: Boolean(imperialState.senate.activeMeeting),
      base: cityCanEvolve,
      board: troopsIdle,
    };
  }, [
    imperialState.mapMovements,
    imperialState.resources.materials,
    imperialState.resources.supplies,
    imperialState.senate.activeMeeting,
    imperialState.troops,
    mergedVillages,
  ]);
  const highestDevelopment = useMemo(
    () => mergedVillages.reduce((best, village) => Math.max(best, calculateVillageDevelopment(village.buildingLevels)), 0),
    [mergedVillages],
  );
  const guideBuildId = useMemo(
    () => resolveBuild(normalizeEvolutionMode(evolutionMode), activeVillage.cityClass),
    [activeVillage.cityClass, evolutionMode],
  );
  const dayGuide = useMemo(
    () =>
      buildGuide(guideBuildId, world.day, {
        villageCount: mergedVillages.length,
        highestDevelopment,
        heroCount: assignedHeroCount,
        wonders: wondersControlled,
        quests: questsCompleted,
      }),
    [assignedHeroCount, guideBuildId, highestDevelopment, mergedVillages.length, questsCompleted, wondersControlled, world.day],
  );
  const capitalVillageId = mergedVillages.find((village) => village.type === "Capital")?.id ?? activeVillage.id;
  const focusVillageId = useMemo(
    () =>
      mergedVillages.reduce(
        (best, village) => {
          const score = calculateVillageDevelopment(village.buildingLevels);
          return score > best.score ? { id: village.id, score } : best;
        },
        { id: activeVillage.id, score: calculateVillageDevelopment(activeVillage.buildingLevels) },
      ).id,
    [activeVillage.buildingLevels, activeVillage.id, mergedVillages],
  );
  const sandboxCoachCta = isSandboxWorld
    ? buildSandboxCoachCta(world.day, imperialState.sandboxStrategyId, capitalVillageId, focusVillageId)
    : null;
  const waitingForKingState = !isImperialStateReady && !worldMeta.readOnly;
  const needsKingSelection = isImperialStateReady && isImperialStateHydrated && !imperialState.kingProfileId && !worldMeta.readOnly;
  const showWorldChrome = !waitingForKingState && !needsKingSelection;
  const worldTabHrefs = useMemo(() => {
    const tabs: WorldTab[] = ["empire", "base", "intelligence", "board", "guide"];
    return tabs.map((tab) => {
      const params = new URLSearchParams();
      params.set("v", activeVillage.id);
      if (evolutionMode) {
        params.set("m", evolutionMode);
      }
      return `/world/${worldId}/${tab}?${params.toString()}`;
    });
  }, [activeVillage.id, evolutionMode, worldId]);
  const campaignEnded = worldMeta.readOnly || crownState.gameOver;
  const endResult = worldMeta.readOnly
    ? worldMeta.result ?? "world_end"
    : crownState.gameOver
      ? "defeat"
      : null;
  const finalAreas = useMemo(() => {
    const byId = new Map(sovereigntyScore.areas.map((entry) => [entry.id, entry.current]));
    return [
      { label: "Infra", value: byId.get("production") ?? 0 },
      { label: "Governo", value: byId.get("government") ?? 0 },
      { label: "Militar", value: byId.get("military") ?? 0 },
      { label: "Sociedade", value: byId.get("society") ?? 0 },
      { label: "Legado", value: byId.get("legacy") ?? 0 },
    ];
  }, [sovereigntyScore.areas]);
  const finalPlacementLabel =
    worldMeta.result === "victorious"
      ? "Vitória Suprema"
      : worldMeta.result === "survived"
        ? "Sobreviveu até o fim"
        : worldMeta.result === "defeated"
          ? "Reino derrotado"
          : worldMeta.result === "eliminated"
            ? "Eliminado da temporada"
            : crownState.gameOver
              ? "Run encerrada"
              : sovereigntyScore.total >= 1500
                ? "Sobreviveu ao corte final"
                : "Campanha encerrada";

  useEffect(() => {
    if (campaignEnded) {
      setEndModalOpen(true);
    }
  }, [campaignEnded]);

  useEffect(() => {
    setBootReady(false);
    setBootProgress(0);
    setBootBypass(false);
  }, [worldId]);

  useEffect(() => {
    if (bootReady) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setBootBypass(true);
      setBootProgress(100);
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [bootReady]);

  useEffect(() => {
    const canPrewarmWorld = !needsKingSelection && (waitingForKingState || showWorldChrome);
    if (!canPrewarmWorld || bootReady) {
      return;
    }

    let cancelled = false;
    const setProgress = (value: number) => {
      if (!cancelled) {
        setBootProgress((current) => Math.max(current, Math.min(95, value)));
      }
    };
    const finish = () => {
      if (!cancelled) {
        setBootProgress(100);
        window.setTimeout(() => {
          if (cancelled) return;
          setBootReady(true);
        }, 900);
      }
    };

    setProgress(8);
    const warmRoutes = [...worldTabHrefs, "/profile", "/lobby", "/premium"];
    warmRoutes.forEach((href) => router.prefetch(href));
    setProgress(18);
    let imagesWarmupDone = false;
    let routeWarmupDone = false;
    let minElapsed = false;
    const maybeFinish = () => {
      if (cancelled) return;
      if (imagesWarmupDone && routeWarmupDone && minElapsed && isImperialStateReady) {
        finish();
      }
    };
    const imageJobs = WORLD_PRELOAD_IMAGES.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src;
        }),
    );
    void Promise.allSettled(imageJobs).then(() => {
      imagesWarmupDone = true;
      setProgress(86);
      maybeFinish();
    });

    const stageTimer = window.setTimeout(() => setProgress(22), 900);
    const fetchWarmupTimer = window.setTimeout(() => {
      const routeJobs = warmRoutes.map((href) =>
        fetch(href, { method: "GET", credentials: "include" }).catch(() => undefined),
      );
      const apiJobs = [
        fetch("/api/me/profile", { method: "GET", credentials: "include", cache: "no-store" }).catch(() => undefined),
        fetch(`/api/worlds/${worldId}/imperial-state`, { method: "GET", credentials: "include", cache: "no-store" }).catch(() => undefined),
      ];
      void Promise.allSettled([...routeJobs, ...apiJobs]).then(() => {
        routeWarmupDone = true;
        setProgress(64);
        maybeFinish();
      });
      setProgress(36);
    }, 1300);
    const routesTimer = window.setTimeout(() => setProgress(50), 2400);
    const assetsTimer = window.setTimeout(() => setProgress(62), 3600);
    const minTimer = window.setTimeout(() => {
      minElapsed = true;
      setProgress(82);
      maybeFinish();
    }, WORLD_BOOT_MIN_MS);
    const maxTimer = window.setTimeout(() => {
      setProgress(95);
      finish();
    }, WORLD_BOOT_MAX_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(stageTimer);
      window.clearTimeout(fetchWarmupTimer);
      window.clearTimeout(routesTimer);
      window.clearTimeout(assetsTimer);
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, [bootReady, isImperialStateReady, needsKingSelection, router, showWorldChrome, waitingForKingState, worldTabHrefs]);

  const confirmKingSelection = async () => {
    if (kingSelectionSaving) {
      return;
    }

    const name = kingNameDraft.trim() || selectedKingProfile.name;
    setKingSelectionSaving(true);
    setKingSelectionError(null);

    try {
      const persisted = await setImperialState((current) => ({
        ...current,
        kingProfileId: selectedKingProfile.id,
        kingName: name.slice(0, 32),
        logs: [`Coroa assumida por ${name.slice(0, 32)}.`, ...current.logs].slice(0, 12),
      }));

        if (!persisted) {
          setKingSelectionError("A Coroa ficou no aparelho, mas ainda não confirmou no Supabase. Tente novamente antes de recarregar.");
          emitUiFeedback("close", "medium");
          emitUiToast({
            tone: "error",
            title: "Coroa não confirmou no banco",
            message: "Tente novamente antes de recarregar.",
          });
          return;
        }

        emitUiFeedback("open", "medium");
        emitUiToast({
          tone: "success",
          title: "Coroa assumida",
          message: `${name.slice(0, 32)} foi salvo nesta campanha.`,
        });
        setHelpOpen(true);
      } finally {
      setKingSelectionSaving(false);
    }
  };

  const jumpToCoachTarget = (tab: GuideWorldTab, query?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(query ?? {}).forEach(([key, value]) => params.set(key, value));
    if (!params.has("v")) {
      params.set("v", activeVillage.id);
    }
    emitUiFeedback("open", "medium");
    setHelpOpen(false);
    startTransition(() => {
      router.push(`/world/${worldId}/${tab}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    });
  };

  const onVillageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("v", event.target.value);
    emitUiFeedback("tap", "light");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <LiveWorldProvider value={liveWorld}>
    <ImperialStateProvider value={imperialRuntime}>
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700">
      {isSandboxWorld ? <SandboxProgressEngine worldId={worldId} currentDay={world.day} villages={mergedVillages} /> : null}
      {isSandboxWorld ? <SandboxDayDeltaModal currentDay={world.day} imperialState={imperialState} /> : null}
      <img
        src="/kingsworld-bg.svg"
        alt="Fundo isometrico do mundo"
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25 saturate-50"
      />
      <div className="absolute inset-0 -z-10 bg-slate-950/46" />

      {showWorldChrome && showCityHeader ? (
        <Header
          selectedVillageId={activeVillage.id}
          villages={mergedVillages.map((village) => ({
            id: village.id,
            name: village.name,
            type: village.type,
            cityClass: village.cityClass,
            cityClassLocked: village.cityClassLocked,
            influence: calculateVillageDevelopment(village.buildingLevels),
          }))}
          onVillageChange={onVillageChange}
          onSaveVillageMeta={(villageId, name, cityClass) => {
            setImperialState((current) => ({
              ...current,
              villageNameByVillage: {
                ...current.villageNameByVillage,
                [villageId]: name,
              },
              cityClassByVillage: {
                ...current.cityClassByVillage,
                [villageId]: cityClass,
              },
            }));
            emitUiFeedback("open", "light");
          }}
          topOffset="calc(env(safe-area-inset-top) + 112px)"
        />
      ) : null}

      {showWorldChrome ? (
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-[calc(env(safe-area-inset-top)+4px)]">
        <div className="kw-hud-panel relative mx-auto w-full max-w-md rounded-[24px] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{world.name}</p>
              <p className="truncate text-sm font-black text-slate-100">Dia {world.day} · {world.phase}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div title="Influência total" className="kw-hud-chip flex items-center gap-2 rounded-xl px-2 py-1.5 text-right">
                <span className="flex h-8 w-8 items-center justify-center">
                  <img src="/icons/influencia-icon.png" alt="" className="h-9 w-9 max-w-none object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.72)]" />
                </span>
                <p className="text-sm font-black text-cyan-100">{compactAmount(sovereigntyScore.total)}</p>
              </div>
              <button
                type="button"
                aria-label="Abrir ajuda da run"
                title="Ajuda da run"
                onClick={() => {
                  emitUiFeedback("open", "light");
                  setHelpOpen(true);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/35 bg-slate-950/70 text-cyan-100 shadow-lg backdrop-blur transition active:scale-95"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5 text-[10px] font-semibold text-slate-100">
            <TopMetric
              label="Materiais"
              value={compactAmount(imperialState.resources.materials)}
              tone="text-zinc-100"
              iconSrc="/icons/producao.png"
              full={(() => {
                const cap = (imperialState.resources as { materialsCapacity?: number }).materialsCapacity;
                return typeof cap === "number" && cap > 0 && imperialState.resources.materials >= cap * 0.97;
              })()}
            />
            <TopMetric
              label="Suprimentos"
              value={compactAmount(imperialState.resources.supplies)}
              tone="text-emerald-100"
              iconSrc="/icons/recursos.png"
              full={(() => {
                const cap = (imperialState.resources as { suppliesCapacity?: number }).suppliesCapacity;
                return typeof cap === "number" && cap > 0 && imperialState.resources.supplies >= cap * 0.97;
              })()}
            />
            <TopMetric label="População" value={`${populationSummary.current}/${populationSummary.cap}`} tone="text-sky-100" iconSrc="/icons/populacao.png" />
            <TopMetric
              label="Tropas"
              value={compactAmount(imperialState.troops.militia + imperialState.troops.shooters + imperialState.troops.scouts + imperialState.troops.machinery)}
              tone="text-rose-100"
              iconSrc="/icons/exercito.png"
            />
          </div>
        </div>
      </header>
      ) : null}

      {showWorldChrome ? (
      <main
        className={`mx-auto flex min-h-screen w-full max-w-md flex-col px-3 pb-[calc(env(safe-area-inset-bottom)+48px)] ${
          showCityHeader
            ? "pt-[calc(env(safe-area-inset-top)+206px)]"
            : "pt-[calc(env(safe-area-inset-top)+108px)]"
        }`}
      >
        {showGlobalCrownBanner && crownState.gameOver ? (
          <article className="mb-3 rounded-[28px] border border-rose-300/30 bg-rose-950/55 p-4 shadow-[0_22px_46px_rgba(2,6,23,0.45)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/85">Fim de Run</p>
            <h2 className="mt-1 text-xl font-black text-rose-50">O Rei Caiu</h2>
            <p className="mt-2 text-[12px] leading-5 text-rose-100">{crownState.detail}</p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/6 p-3 text-[11px] text-slate-100">
              <p className="font-bold text-rose-100">Causa</p>
              <p className="mt-1">{crownState.reasons.join(" · ") || "A Coroa foi perdida."}</p>
            </div>
          </article>
        ) : null}
        {children}
      </main>
      ) : null}

      {showWorldChrome && helpOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Fechar ajuda"
            onClick={() => {
              emitUiFeedback("close", "light");
              setHelpOpen(false);
            }}
            className="absolute inset-0 bg-slate-950/74 backdrop-blur-sm"
          />
          <section
            className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+76px)] mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/94 p-4 shadow-[0_28px_70px_rgba(2,6,23,0.65)]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(2,6,23,0.50), rgba(2,6,23,0.95)), url('/images/help.jpg')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ajuda da run</p>
                <h2 className="mt-1 text-lg font-black text-slate-50">{dayGuide.beginnerTitle}</h2>
                <p className="mt-1 text-[11px] font-semibold text-cyan-100">
                  Dia {world.day} | {dayGuide.build.label} | {dayGuide.windowLabel}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar ajuda"
                onClick={() => {
                  emitUiFeedback("close", "light");
                  setHelpOpen(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative z-10 mt-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/80">O que fazer agora</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-100">{dayGuide.nextAction}</p>
            </div>

            <div className="relative z-10 mt-2 grid grid-cols-4 gap-1.5 text-center text-[9px] font-black uppercase tracking-[0.08em] text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/7 px-1.5 py-2">
                <span className="block text-cyan-100">1</span>
                Coroa
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 px-1.5 py-2">
                <span className="block text-cyan-100">2</span>
                Capital
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/7 px-1.5 py-2">
                <span className="block text-cyan-100">3</span>
                Mapa
              </div>
              <div className="rounded-2xl border border-amber-300/25 bg-amber-500/12 px-1.5 py-2 text-amber-50">
                <span className="block">1500</span>
                Influência
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {dayGuide.beginnerSteps.slice(0, 3).map((step, index) => (
                <p key={step} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] leading-5 text-slate-200">
                  {index + 1}. {step}
                </p>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {sandboxCoachCta ? (
                <button
                  type="button"
                  onClick={() => jumpToCoachTarget(sandboxCoachCta.tab, sandboxCoachCta.query)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300/35 bg-amber-500/14 px-3 py-3 text-[10px] font-black text-amber-50"
                >
                  <Target className="h-3.5 w-3.5" />
                  Acao do dia
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => jumpToCoachTarget(dayGuide.recommendedTab)}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-cyan-300/35 bg-cyan-500/14 px-3 py-3 text-[10px] font-black text-cyan-100"
              >
                <Compass className="h-3.5 w-3.5" />
                Ir para {worldTabLabel(dayGuide.recommendedTab)}
              </button>
              <button
                type="button"
                onClick={() => jumpToCoachTarget("intelligence")}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/8 px-3 py-3 text-[10px] font-black text-slate-200"
              >
                Abrir Comando
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {needsKingSelection ? (
        <div className="fixed inset-0 z-[95]">
          <div className="absolute inset-0 bg-slate-950/84 backdrop-blur-md" />
          <section data-smoke="king-selection-modal" className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] mx-auto max-h-[calc(100vh-1.25rem)] w-full max-w-md overflow-y-auto rounded-[32px] border border-white/20 bg-slate-950/94 p-3 shadow-[0_34px_80px_rgba(2,6,23,0.72)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Primeira entrada no mundo</p>
            <h2 className="mt-1 text-[26px] font-black leading-none text-slate-50">Escolha sua Coroa</h2>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-300">
              Este personagem pertence a esta campanha. Seu nick de conta fica separado no lobby e no perfil.
            </p>
            <div className="mt-2 rounded-2xl border border-amber-300/24 bg-amber-500/12 p-2.5 text-[10px] leading-4 text-amber-50">
              Objetivo da temporada: construir um reino vivo, passar de <strong>1500 de influência</strong> e chegar ao Exodo sem perder a Coroa.
            </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {KING_PROFILES.map((profile) => {
                  const active = profile.id === selectedKingProfile.id;
                  const portraitStyle = resolveKingPortraitStyle(profile.id);
                  return (
                    <button
                    key={profile.id}
                    type="button"
                    data-smoke={`king-card-${profile.id}`}
                    onClick={() => {
                      setSelectedKingId(profile.id);
                      setKingNameDraft((current) => current || profile.name);
                      emitUiFeedback("tap", "light");
                    }}
                    className={`min-h-[208px] overflow-hidden rounded-[24px] border text-left shadow-lg transition active:scale-95 ${
                      active ? "border-cyan-200/80 bg-cyan-500/16" : "border-white/12 bg-white/6"
                    }`}
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0), rgba(2,6,23,0.26) 48%, rgba(2,6,23,0.94)), url('${profile.imageSrc}')`,
                        backgroundPosition: `center ${portraitStyle.backgroundPositionY}`,
                        backgroundSize: portraitStyle.backgroundSize,
                      }}
                    >
                    <div className="flex h-full min-h-[208px] flex-col justify-end p-2.5">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-cyan-100/85">{profile.title}</p>
                      <p className="mt-0.5 text-[12px] font-black leading-tight text-slate-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.82)]">{profile.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {profile.traits.map((trait) => (
                          <span
                            key={`${profile.id}-${trait.label}`}
                            className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black ${
                              trait.tone === "bonus"
                                ? "border-emerald-300/35 bg-emerald-400/16 text-emerald-100"
                                : "border-rose-300/35 bg-rose-400/16 text-rose-100"
                            }`}
                          >
                            {trait.label}: {trait.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              className="mt-3 overflow-hidden rounded-[28px] border border-white/16 bg-white/8"
              style={{
                ...(() => {
                  const portraitStyle = resolveKingPortraitStyle(selectedKingProfile.id);
                  return {
                    backgroundPosition: `center ${portraitStyle.backgroundPositionY}`,
                    backgroundSize: portraitStyle.backgroundSize,
                  };
                })(),
                backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0), rgba(2,6,23,0.26) 48%, rgba(2,6,23,0.95)), url('${selectedKingProfile.imageSrc}')`,
              }}
            >
              <div className="p-3 pt-52">
                <div className="rounded-2xl border border-white/14 bg-slate-950/72 p-2.5 backdrop-blur-xl">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">{selectedKingProfile.title}</p>
                  <h3 className="mt-0.5 text-base font-black text-slate-50">{selectedKingProfile.name}</h3>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-200">{selectedKingProfile.summary}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {selectedKingProfile.traits.map((trait) => (
                      <span
                        key={`selected-${trait.label}`}
                        className={`rounded-xl border px-2 py-1 text-center text-[10px] font-black ${
                          trait.tone === "bonus"
                            ? "border-emerald-300/35 bg-emerald-400/16 text-emerald-100"
                            : "border-rose-300/35 bg-rose-400/16 text-rose-100"
                        }`}
                      >
                        {trait.label}: {trait.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400" htmlFor="king-name">
              Nome do rei ou rainha
            </label>
            <input
              id="king-name"
              data-smoke="king-name-input"
              value={kingNameDraft}
              onChange={(event) => setKingNameDraft(event.target.value)}
              maxLength={32}
              placeholder={selectedKingProfile.name}
              className="relative z-10 mt-2 w-full rounded-2xl border border-white/18 px-3 py-3 text-sm font-bold text-slate-50 outline-none placeholder:text-slate-500"
              style={{ background: "rgb(2 6 23)" }}
            />
            <button
              type="button"
              onClick={confirmKingSelection}
              data-smoke="confirm-king-selection"
              disabled={kingSelectionSaving}
              className="mt-4 w-full rounded-2xl border border-cyan-200/45 bg-cyan-400/20 px-4 py-3 text-sm font-black text-cyan-50 shadow-[0_18px_38px_rgba(8,47,73,0.32)] active:scale-95"
            >
              {kingSelectionSaving ? "Salvando Coroa..." : "Começar campanha"}
            </button>
            {kingSelectionError ? (
              <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-500/12 px-3 py-2 text-[11px] font-bold leading-5 text-amber-50">
                {kingSelectionError}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {campaignEnded && endModalOpen ? (
        <div className="fixed inset-0 z-[98]">
          <div className="absolute inset-0 bg-slate-950/86 backdrop-blur-md" />
          <section
            data-smoke="final-season-modal"
            className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+16px)] mx-auto max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-[32px] border border-white/18 bg-slate-950/96 shadow-[0_34px_80px_rgba(2,6,23,0.72)]"
            style={{
              backgroundImage:
                endResult === "defeat"
                  ? "linear-gradient(180deg, rgba(2,6,23,0.16), rgba(2,6,23,0.52) 42%, rgba(2,6,23,0.96)), url('/images/threat-raiders.jpg')"
                  : "linear-gradient(180deg, rgba(2,6,23,0.12), rgba(2,6,23,0.40) 42%, rgba(2,6,23,0.96)), url('/images/card-premium.jpg')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="p-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                    {endResult === "defeat" ? "Reino derrotado" : "Temporada encerrada"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-50">
                    {endResult === "defeat" ? "A Coroa caiu" : "O mundo chegou ao fim"}
                  </h2>
                  <p className="mt-2 text-[12px] leading-5 text-slate-200">
                    {endResult === "defeat"
                      ? crownState.detail
                      : "A campanha foi encerrada. O mundo agora fica em modo leitura para revisar seu legado final."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEndModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
                  aria-label="Fechar encerramento"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 rounded-[28px] border border-white/14 bg-slate-950/58 p-3 backdrop-blur-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Resumo final</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                    <span className="block text-slate-500">Resultado</span>
                    <span className="mt-1 block text-slate-50">{finalPlacementLabel}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                    <span className="block text-slate-500">{worldMeta.finalRank ? "Posição" : "Dia"}</span>
                    <span className="mt-1 block text-slate-50">{worldMeta.finalRank ? `#${worldMeta.finalRank}` : world.day}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                    <span className="block text-slate-500">Rei</span>
                    <span className="mt-1 block truncate text-slate-50">{imperialState.kingName || selectedKingProfile.name}</span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                    <span className="block text-slate-500">{worldMeta.finalScore !== null ? "Score" : "Cidades"}</span>
                    <span className="mt-1 block text-slate-50">{worldMeta.finalScore !== null ? compactAmount(worldMeta.finalScore) : mergedVillages.length}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {finalAreas.map((entry) => (
                  <div key={entry.label} className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{entry.label}</p>
                    <p className="mt-1 text-lg font-black text-slate-50">{entry.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-[24px] border border-white/10 bg-white/6 p-3 text-[11px] text-slate-200">
                <p className="font-bold text-slate-50">Causa do encerramento</p>
                <p className="mt-1">
                  {endResult === "defeat" || worldMeta.result === "defeated" || worldMeta.result === "eliminated"
                    ? crownState.reasons.join(" · ") || "O rei caiu antes do fim da temporada."
                    : worldMeta.finalReason === "victory"
                      ? "Seu reino dominou a temporada e fechou o mundo como vencedor."
                      : worldMeta.finalReason === "timeout"
                        ? "O prazo do mundo chegou ao fim e a temporada foi arquivada."
                        : "A campanha foi encerrada."}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEndModalOpen(false);
                    router.push(`/world/${worldId}/report`);
                  }}
                  data-smoke="open-final-report"
                  className="rounded-2xl border border-amber-200/45 bg-amber-400/20 px-4 py-3 text-sm font-black text-amber-50"
                >
                  Ver relatório final
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEndModalOpen(false);
                    router.push("/lobby");
                  }}
                  className="rounded-2xl border border-cyan-200/45 bg-cyan-400/20 px-4 py-3 text-sm font-black text-cyan-50"
                >
                  Voltar ao lobby
                </button>
                <button
                  type="button"
                  onClick={() => setEndModalOpen(false)}
                  data-smoke="continue-readonly"
                  className="col-span-2 rounded-2xl border border-white/14 bg-white/8 px-4 py-3 text-sm font-black text-slate-100"
                >
                  Continuar em leitura
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {((waitingForKingState || (showWorldChrome && !bootReady)) && !bootBypass) && !needsKingSelection ? <WorldLoadingScreen progress={bootProgress} /> : null}

      {showWorldChrome && showBottomNavigation ? <BottomNavigation worldId={worldId} activeTab={activeTab} villageId={activeVillage.id} evolutionMode={evolutionMode} attention={navAttention} /> : null}
    </div>
    </ImperialStateProvider>
    </LiveWorldProvider>
  );
}
