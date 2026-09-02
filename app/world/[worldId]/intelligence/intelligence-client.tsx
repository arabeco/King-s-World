"use client";

import { AlertTriangle, Bell, ChevronRight, CircleCheck, Compass, MapPinned, ShieldAlert, Swords, X } from "lucide-react";
import { useMemo, useState } from "react";

import { TimeOfDestinyPanel } from "@/components/sandbox/TimeOfDestinyPanel";
import { calculateTribeProgressStage, calculateVillageDevelopment } from "@/core/GameBalance";
import { mergeImperialVillages, useImperialStateContext } from "@/lib/imperial-state";
import {
  buildPlayerAlertDeck,
  buildPlayerCommandSnapshot,
  type PlayerAlertCard,
  type PlayerAlertChoice,
} from "@/lib/player-alerts";
import type { ProfileHealthCard } from "@/lib/season-audit-analytics";
import { emitUiFeedback } from "@/lib/ui-feedback";
import { buildGuide, resolveBuild, type WorldTab } from "@/lib/world-assistant-guide";
import { useLiveWorldContext } from "@/lib/world-runtime";

type ActivityTone = "danger" | "warning" | "info" | "success";

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: ActivityTone;
};

function isPlayerFacingAlert(alert: string): boolean {
  return !/supabase|tempo real|estado persistente|campanha em progresso|runtime|sincroniza|fonte [uú]nica/i.test(alert);
}

const tabLabels: Record<WorldTab, string> = {
  intelligence: "Comando",
  base: "Cidades",
  board: "Mundo",
  empire: "Império",
  guide: "Perfil",
};

function activityToneClass(tone: ActivityTone): string {
  if (tone === "danger") return "border-rose-300/30 bg-rose-500/10";
  if (tone === "warning") return "border-amber-300/30 bg-amber-500/10";
  if (tone === "success") return "border-emerald-300/30 bg-emerald-500/10";
  return "border-cyan-300/25 bg-cyan-500/8";
}

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

export function IntelligenceClient({
  params,
  profileHealth,
}: {
  params: { worldId: string };
  profileHealth: ProfileHealthCard[];
}) {
  void profileHealth;
  const { world } = useLiveWorldContext();
  const { imperialState } = useImperialStateContext();
  const [openedDecision, setOpenedDecision] = useState<PlayerAlertCard | null>(null);

  const villages = useMemo(() => mergeImperialVillages(world.villages, imperialState), [imperialState, world.villages]);
  const activeVillage = useMemo(
    () => villages.find((village) => village.id === world.activeVillageId) ?? villages[0],
    [villages, world.activeVillageId],
  );
  const heroCount = useMemo(
    () => Object.values(imperialState.heroByVillage).filter((entry) => entry && entry !== "none").length,
    [imperialState.heroByVillage],
  );
  const highestDevelopment = useMemo(
    () => villages.reduce((best, village) => Math.max(best, calculateVillageDevelopment(village.buildingLevels)), 0),
    [villages],
  );
  const questsCompleted = params.worldId === "world-test" ? imperialState.sandboxQuestsCompleted : world.sovereignty.eraQuestsCompleted;
  const wondersControlled = params.worldId === "world-test" ? imperialState.sandboxWondersBuilt : world.sovereignty.wondersControlled;
  const tribeStage = calculateTribeProgressStage({
    currentDay: world.day,
    tribeEnvoysCommitted: imperialState.tribeEnvoysCommitted ?? 0,
    kingAlive: world.sovereignty.kingAlive,
  });
  const population = useMemo(
    () =>
      villages.reduce(
        (total, village) => {
          const capacity = Math.min(100, Math.max(0, Math.floor((village.buildingLevels.housing ?? 0) * 10)));
          const production = imperialState.productionWorkersByVillage[village.id] ?? { materials: 0, supplies: 0, commerce: 0, logistics: 0 };
          const jobs = imperialState.jobsByVillage[village.id] ?? { medics: 0, crafts: 0, order: 0, scholars: 0 };
          const recruits = imperialState.recruitsByVillage[village.id] ?? { militia: 0, shooters: 0, scouts: 0, machinery: 0 };
          const defense = imperialState.defenseRecruitsByVillage[village.id] ?? { guards: 0, archers: 0, ballistae: 0 };
          const employed = sumValues(production) + sumValues(jobs);
          const recruited = sumValues(recruits);
          const defended = sumValues(defense);
          const current = Math.min(capacity, Math.max(employed + recruited + defended, imperialState.populationByVillage[village.id] ?? capacity));
          return {
            current: total.current + current,
            capacity: total.capacity + capacity,
            employed: total.employed + employed,
            recruited: total.recruited + recruited,
          };
        },
        { current: 0, capacity: 0, employed: 0, recruited: 0 },
      ),
    [
      imperialState.defenseRecruitsByVillage,
      imperialState.jobsByVillage,
      imperialState.populationByVillage,
      imperialState.productionWorkersByVillage,
      imperialState.recruitsByVillage,
      villages,
    ],
  );
  const buildId = useMemo(() => resolveBuild(undefined, activeVillage.cityClass), [activeVillage.cityClass]);
  const guide = useMemo(
    () =>
      buildGuide(buildId, world.day, {
        villageCount: villages.length,
        highestDevelopment,
        heroCount,
        wonders: wondersControlled,
        quests: questsCompleted,
      }),
    [buildId, heroCount, highestDevelopment, questsCompleted, villages.length, wondersControlled, world.day],
  );
  const alertInput = useMemo(
    () => ({
      currentDay: world.day,
      worldPhase: world.phase,
      activeAlerts: world.activeAlerts,
      activeVillage,
      villages,
      imperialState,
      guide,
      heroCount: Math.max(world.sovereignty.councilHeroes, heroCount),
      highestDevelopment,
      questsCompleted,
      wondersControlled,
      militaryRankingPoints: world.sovereignty.militaryRankingPoints,
      tribeDomeUnlocked: world.sovereignty.tribeDomeUnlocked || imperialState.sandboxDomeActive,
      tribeLoyaltyStage: world.sovereignty.tribeLoyaltyStage ?? tribeStage,
      kingAlive: world.sovereignty.kingAlive,
      populationCurrent: population.current,
      populationCapacity: population.capacity,
      employedPopulation: population.employed,
      recruitedPopulation: population.recruited,
    }),
    [activeVillage, guide, heroCount, highestDevelopment, imperialState, population, questsCompleted, tribeStage, villages, wondersControlled, world.activeAlerts, world.day, world.phase, world.sovereignty],
  );
  const alertDeck = useMemo(() => buildPlayerAlertDeck(alertInput), [alertInput]);
  const snapshot = useMemo(() => buildPlayerCommandSnapshot(alertInput), [alertInput]);
  const cards = useMemo(() => [alertDeck.primary, ...alertDeck.secondary], [alertDeck]);
  const pendingDecision = cards.find((card) => card.kind === "decision") ?? null;
  const playerFacingAlerts = useMemo(() => world.activeAlerts.filter(isPlayerFacingAlert), [world.activeAlerts]);
  const urgentAlert = imperialState.resources.supplies <= 0
    ? "Suprimentos zerados: tropas e rotas podem parar."
    : snapshot.attackedCities > 0
      ? `${snapshot.attackedCities} cidade(s) sob ataque.`
      : snapshot.activeDeficits > 0
        ? `${snapshot.activeDeficits} cidade(s) com produção em déficit.`
        : playerFacingAlerts[0] ?? (alertDeck.primary.severity !== "low" ? alertDeck.primary.title : null);
  const nextActionTab: WorldTab = guide.recommendedTab === "intelligence" ? "empire" : guide.recommendedTab;
  const influenceProgress = Math.max(0, Math.min(100, Math.round((snapshot.influence / snapshot.portalCut) * 100)));

  const activities = useMemo<ActivityEntry[]>(() => {
    const alerts: ActivityEntry[] = playerFacingAlerts.slice(0, 2).map((alert, index) => ({
      id: `alert-${index}`,
      title: "Alerta do reino",
      detail: alert,
      meta: `Dia ${world.day}`,
      tone: /horda|ataque|portal|corte/i.test(alert) ? "danger" : "warning",
    }));
    const actions: ActivityEntry[] = imperialState.logs.slice(0, 3).map((log, index) => ({
      id: `action-${index}`,
      title: "Ação computada",
      detail: log,
      meta: "Registro do reino",
      tone: "info",
    }));
    const reports: ActivityEntry[] = world.reports.slice(0, 3).map((report) => ({
      id: report.id,
      title: report.title,
      detail: report.summary,
      meta: report.time,
      tone: report.category === "combate" ? "warning" : report.category === "economia" ? "success" : "info",
    }));
    return [...alerts, ...actions, ...reports].slice(0, 6);
  }, [imperialState.logs, playerFacingAlerts, world.day, world.reports]);

  const navigate = (tab: WorldTab, query?: Record<string, string>) => {
    const next = new URLSearchParams();
    next.set("v", activeVillage.id);
    Object.entries(query ?? {}).forEach(([key, value]) => next.set(key, value));
    emitUiFeedback("open", "medium");
    window.location.assign(`/world/${params.worldId}/${tab}?${next.toString()}`);
  };

  const handleChoice = (choice: PlayerAlertChoice) => {
    if (choice.tab) navigate(choice.tab, choice.query);
  };

  return (
    <section className="space-y-3 pb-4" data-smoke="command-center">
      {params.worldId === "world-test" ? (
        <TimeOfDestinyPanel currentDay={world.day} villages={villages} imperialState={imperialState} activeAlerts={world.activeAlerts} />
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-cyan-200/20 bg-slate-950/74 shadow-[0_18px_52px_rgba(2,6,23,0.34)]">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Comando</p>
            <h1 className="mt-0.5 text-lg font-black text-slate-50">Chegue vivo ao Portal</h1>
          </div>
          <span className="shrink-0 text-right text-[11px] font-bold text-slate-300">Dia {world.day}/{world.durationDays}</span>
        </div>
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Influência</p>
              <p className="mt-0.5 text-2xl font-black text-cyan-100">{snapshot.influence.toLocaleString("pt-BR")} <span className="text-sm text-slate-400">/ {snapshot.portalCut}</span></p>
            </div>
            <p className="text-right text-[11px] font-semibold text-slate-300">{snapshot.portalEligible ? "Portal liberado" : `Faltam ${snapshot.portalGap.toLocaleString("pt-BR")}`}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progresso de Influência para o Portal" aria-valuenow={snapshot.influence} aria-valuemin={0} aria-valuemax={snapshot.portalCut}>
            <div className="h-full rounded-full bg-cyan-300" style={{ width: `${influenceProgress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-300">
            <span>{villages.length} cidades</span>
            <span>{snapshot.totalTroops.toLocaleString("pt-BR")} tropas</span>
            <span>{snapshot.exploredAreas} áreas exploradas</span>
          </div>
        </div>
      </section>

      <section className={`rounded-[22px] border px-3.5 py-3 ${urgentAlert ? "border-rose-300/30 bg-rose-500/10" : "border-emerald-300/25 bg-emerald-500/8"}`}>
        <div className="flex items-start gap-3">
          {urgentAlert ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" /> : <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />}
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">Risco agora</p>
            <p className="mt-1 text-[13px] font-bold leading-5 text-slate-50">{urgentAlert ?? "Nenhuma ameaça imediata"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-amber-300/30 bg-amber-500/10 p-3.5">
        <div className="flex items-center gap-2 text-amber-100">
          <Compass className="h-4 w-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.14em]">Melhor jogada</p>
        </div>
        <p className="mt-2 text-[15px] font-black leading-5 text-slate-50">{guide.nextAction}</p>
        <button type="button" onClick={() => navigate(nextActionTab)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 py-2.5 text-[12px] font-black text-slate-950 active:scale-[0.98]">
          Ir para {tabLabels[nextActionTab]}
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      <section className="border-y border-white/10 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Decisão pendente</p>
            <p className="mt-1 text-[13px] font-bold text-slate-100">{pendingDecision?.title ?? "Nenhuma decisão esperando resposta"}</p>
          </div>
          {pendingDecision ? <button type="button" onClick={() => setOpenedDecision(pendingDecision)} className="shrink-0 rounded-xl border border-cyan-300/35 bg-cyan-500/12 px-3 py-2 text-[11px] font-black text-cyan-100">Decidir</button> : null}
        </div>
      </section>

      <section className="pt-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-cyan-200" /><h2 className="text-sm font-black text-slate-100">Atividade recente</h2></div>
          <span className="text-[10px] font-semibold text-slate-400">{activities.length} registros</span>
        </div>
        {activities.length > 0 ? (
          <div className="space-y-1.5">
            {activities.map((entry) => (
              <article key={entry.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${activityToneClass(entry.tone)}`}>
                {entry.tone === "danger" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" /> : entry.tone === "warning" ? <Swords className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" /> : <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2"><p className="truncate text-[11px] font-black text-slate-100">{entry.title}</p><span className="shrink-0 text-[9px] text-slate-400">{entry.meta}</span></div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-300">{entry.detail}</p>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-[11px] text-slate-400">O reino está quieto. Sua próxima ação aparecerá aqui.</div>}
      </section>

      {openedDecision ? (
        <div className="fixed inset-0 z-[90]">
          <button type="button" aria-label="Fechar decisão" onClick={() => setOpenedDecision(null)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+16px)] top-[calc(env(safe-area-inset-top)+72px)] mx-auto flex w-full max-w-md items-end">
            <article className="w-full rounded-[24px] border border-white/15 bg-slate-950 p-4 text-slate-100 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Decisão do reino</p><h3 className="mt-1 text-lg font-black text-slate-50">{openedDecision.title}</h3></div>
                <button type="button" aria-label="Fechar" onClick={() => setOpenedDecision(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-slate-200"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-slate-200">{openedDecision.situation}</p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">{openedDecision.impact}</p>
              <div className="mt-4 space-y-2">
                {openedDecision.choices.map((choice) => (
                  <button key={choice.id} type="button" onClick={() => handleChoice(choice)} className="w-full rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2.5 text-left">
                    <span className="text-[12px] font-black text-cyan-50">{choice.label}</span>
                    {choice.note ? <span className="mt-1 block text-[10px] leading-4 text-cyan-100/80">{choice.note}</span> : null}
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
