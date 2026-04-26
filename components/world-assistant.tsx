"use client";

import {
  BookOpen,
  CalendarDays,
  CircleDot,
  Compass,
  Crown,
  Lightbulb,
  Map,
  MousePointerClick,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { calculateVillageDevelopment, type EvolutionMode } from "@/core/GameBalance";
import { PlayerAlertCards } from "@/components/player-alert-cards";
import type { ImperialState } from "@/lib/imperial-state";
import type { VillageSummary } from "@/lib/mock-data";
import { buildPlayerAlertDeck, type PlayerAlertChoice } from "@/lib/player-alerts";
import { emitUiFeedback } from "@/lib/ui-feedback";
import {
  buildGuide,
  buildSandboxCoachCta,
  formatCampaignDate,
  resolveBuild,
  type WorldTab,
} from "@/lib/world-assistant-guide";

export function WorldAssistant({
  worldId,
  currentDay,
  worldPhase,
  campaignDate,
  isSandboxWorld,
  realTimeEnabled,
  activeTab,
  evolutionMode,
  activeVillage,
  villages,
  imperialState,
  questsCompleted,
  wondersControlled,
  activeAlerts,
}: {
  worldId: string;
  currentDay: number;
  worldPhase: string;
  campaignDate: Date;
  isSandboxWorld: boolean;
  realTimeEnabled: boolean;
  activeTab: WorldTab;
  evolutionMode?: EvolutionMode;
  activeVillage: VillageSummary;
  villages: VillageSummary[];
  imperialState: ImperialState;
  questsCompleted: number;
  wondersControlled: number;
  activeAlerts: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const buildId = useMemo(
    () => resolveBuild(evolutionMode, activeVillage.cityClass),
    [activeVillage.cityClass, evolutionMode],
  );

  const heroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );

  const highestDevelopment = useMemo(
    () => villages.reduce((best, village) => Math.max(best, calculateVillageDevelopment(village.buildingLevels)), 0),
    [villages],
  );

  const guide = useMemo(
    () =>
      buildGuide(buildId, currentDay, {
        villageCount: villages.length,
        highestDevelopment,
        heroCount,
        wonders: wondersControlled,
        quests: questsCompleted,
      }),
    [buildId, currentDay, heroCount, highestDevelopment, questsCompleted, villages.length, wondersControlled],
  );

  const jumpToTab = (tab: WorldTab) => {
    const params = new URLSearchParams(searchParams.toString());
    emitUiFeedback("open", "medium");
    router.push(`/world/${worldId}/${tab}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const jumpToTabWithQuery = (tab: WorldTab, query: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(query).forEach(([key, value]) => params.set(key, value));
    emitUiFeedback("open", "medium");
    router.push(`/world/${worldId}/${tab}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const capitalVillageId = villages.find((village) => village.type === "Capital")?.id ?? activeVillage.id;
  const focusVillageId =
    villages.reduce((best, village) => {
      const score = calculateVillageDevelopment(village.buildingLevels);
      return score > best.score ? { id: village.id, score } : best;
    }, { id: activeVillage.id, score: calculateVillageDevelopment(activeVillage.buildingLevels) }).id;
  const sandboxCoachCta = isSandboxWorld
    ? buildSandboxCoachCta(currentDay, imperialState.sandboxStrategyId, capitalVillageId, focusVillageId)
    : null;
  const alertDeck = useMemo(
    () =>
      buildPlayerAlertDeck({
        currentDay,
        worldPhase,
        activeAlerts,
        activeVillage,
        villages,
        imperialState,
        guide,
        heroCount,
        highestDevelopment,
        questsCompleted,
        wondersControlled,
      }),
    [
      activeAlerts,
      activeVillage,
      currentDay,
      guide,
      heroCount,
      highestDevelopment,
      imperialState,
      questsCompleted,
      villages,
      wondersControlled,
      worldPhase,
    ],
  );

  const handleAlertChoice = (choice: PlayerAlertChoice) => {
    if (choice.tab) {
      jumpToTabWithQuery(choice.tab, choice.query ?? {});
      return;
    }

    emitUiFeedback("tap", "light");
  };

  return (
    <>
      <div className="mb-2 space-y-2">
        <article className="kw-glass rounded-2xl p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {isSandboxWorld ? "Intel sandbox" : "Intel da run"}
              </p>
              <p className="truncate text-sm font-bold text-slate-50">D{currentDay} | {guide.build.label} | {guide.windowLabel}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-300">{guide.focus}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                emitUiFeedback("open", "medium");
                setTutorialOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-sky-300/40 bg-sky-500/14 px-2 py-1.5 text-[10px] font-bold text-sky-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Guia
            </button>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[10px] text-slate-200">
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Data da campanha">
              <CalendarDays className="mx-auto h-4 w-4 text-slate-200" />
              <p className="mt-1 font-black text-slate-50">{formatCampaignDate(campaignDate)}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Cidades">
              <Map className="mx-auto h-4 w-4 text-cyan-200" />
              <p className="mt-1 font-black text-slate-50">{villages.length}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Pico de desenvolvimento">
              <CircleDot className="mx-auto h-4 w-4 text-emerald-200" />
              <p className="mt-1 font-black text-slate-50">{highestDevelopment}/100</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-2" title="Herois ativos">
              <Crown className="mx-auto h-4 w-4 text-amber-200" />
              <p className="mt-1 font-black text-slate-50">{heroCount}</p>
            </div>
          </div>

          <div className="mt-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-cyan-100" />
              <p className="text-[11px] font-bold text-slate-50">Agora</p>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-200">{guide.nextAction}</p>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => jumpToTab(guide.recommendedTab)}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-300/35 bg-cyan-500/14 px-2 py-1 text-[10px] font-semibold text-cyan-100"
            >
              <Compass className="h-3.5 w-3.5" />
              Ir para {guide.recommendedTab}
            </button>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/12 px-2 py-1 text-[10px] font-semibold text-emerald-100">
              <CircleDot className="h-3.5 w-3.5" />
              {realTimeEnabled ? "tempo real" : "pausado"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-2 py-1 text-[10px] font-semibold text-slate-200">
              <MousePointerClick className="h-3.5 w-3.5" />
              {activeTab}
            </span>
          </div>

          {sandboxCoachCta ? (
            <div className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-2">
              <button
                type="button"
                onClick={() => jumpToTabWithQuery(sandboxCoachCta.tab, sandboxCoachCta.query)}
                title={sandboxCoachCta.detail}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-300/45 bg-amber-500/18 px-2.5 py-2 text-[10px] font-bold text-amber-50"
              >
                <Target className="h-3.5 w-3.5" />
                {sandboxCoachCta.label}
              </button>
            </div>
          ) : null}
        </article>

        <PlayerAlertCards
          primary={alertDeck.primary}
          secondary={alertDeck.secondary}
          onChoice={handleAlertChoice}
          title="Sinais vivos"
          subtitle="Prioridade, risco e clique util."
        />
      </div>

      {tutorialOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="Fechar tutorial"
            onClick={() => {
              emitUiFeedback("close", "light");
              setTutorialOpen(false);
            }}
            className="absolute inset-0 bg-slate-950/76 backdrop-blur-sm"
          />

          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+18px)] top-[calc(env(safe-area-inset-top)+74px)] mx-auto flex w-full max-w-md">
            <div className="kw-glass flex h-full w-full flex-col rounded-[28px] p-3 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Popup tutorial</p>
                  <h3 className="text-lg font-bold text-slate-50">{guide.build.label} | Dia {currentDay}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-300">
                    {guide.summary} Esta build quer: {guide.build.identity}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    emitUiFeedback("close", "light");
                    setTutorialOpen(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="rounded-2xl border border-sky-300/25 bg-sky-500/10 p-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-sky-200" />
                    <p className="text-[11px] font-bold text-slate-50">Proxima acao</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-200">{guide.nextAction}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ritmo atual</p>
                    <p className="mt-1 text-sm font-bold text-slate-50">{villages.length} aldeias</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">Maior desenvolvimento: {highestDevelopment}/100</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Pilares</p>
                    <p className="mt-1 text-sm font-bold text-slate-50">{heroCount} herois | {questsCompleted} quests</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{wondersControlled} Maravilhas controladas</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-amber-200" />
                    <p className="text-[11px] font-bold text-slate-50">Checklist da fase</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {guide.actions.map((action) => (
                      <p key={action} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {action}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-200" />
                    <p className="text-[11px] font-bold text-slate-50">Marcos ideais da build</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {guide.checkpoints.map((checkpoint) => (
                      <p key={checkpoint} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {checkpoint}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-violet-200" />
                    <p className="text-[11px] font-bold text-slate-50">Leitura de contexto</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {activeAlerts.slice(0, 3).map((alert) => (
                      <p key={alert} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] leading-5 text-slate-200">
                        {alert}
                      </p>
                    ))}
                  </div>
                </div>

                {guide.warnings.length ? (
                  <div className="rounded-2xl border border-rose-300/20 bg-rose-500/8 p-2">
                    <p className="text-[11px] font-bold text-rose-100">Alertas da sua run</p>
                    <div className="mt-2 space-y-1.5">
                      {guide.warnings.map((warning) => (
                        <p key={warning} className="rounded-xl border border-rose-300/15 bg-rose-500/8 px-2 py-1.5 text-[11px] leading-5 text-rose-50">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => jumpToTab(guide.recommendedTab)}
                  className="inline-flex items-center gap-1 rounded-xl border border-cyan-300/35 bg-cyan-500/14 px-2.5 py-2 text-[10px] font-bold text-cyan-100"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Abrir aba recomendada
                </button>
                {sandboxCoachCta ? (
                  <button
                    type="button"
                    onClick={() => jumpToTabWithQuery(sandboxCoachCta.tab, sandboxCoachCta.query)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300/35 bg-amber-500/14 px-2.5 py-2 text-[10px] font-bold text-amber-50"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Abrir acao do dia
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
