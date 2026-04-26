"use client";

import { UserRound } from "lucide-react";

import { calculateSovereigntyScore, calculateVillageDevelopment } from "@/core/GameBalance";
import { countUnlockedMilitaryTechs } from "@/lib/empire-systems";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { KING_PROFILE_BY_ID, KING_PROFILES } from "@/lib/king-profiles";
import type { VillageSummary, WorldState } from "@/lib/mock-data";

export function WorldProfileClient({
  worldId,
  world,
  villages,
  username,
}: {
  worldId: string;
  world: WorldState;
  villages: VillageSummary[];
  username: string;
}) {
  const { imperialState } = useImperialState(worldId, villages);
  const mergedVillages = mergeImperialVillages(villages, imperialState);
  const selectedKing = imperialState.kingProfileId ? KING_PROFILE_BY_ID[imperialState.kingProfileId] : KING_PROFILES[0];
  const kingName = imperialState.kingName ?? selectedKing.name;
  const heroCount = Object.values(imperialState.heroByVillage).filter((hero) => hero && hero !== "none").length;
  const sovereignty = calculateSovereigntyScore({
    villages: mergedVillages,
    villageDevelopments: mergedVillages.map((village) => calculateVillageDevelopment(village.buildingLevels)),
    councilHeroes: heroCount,
    militaryRankingPoints: world.sovereignty.militaryRankingPoints,
    eraQuestsCompleted: imperialState.sandboxQuestsCompleted || world.sovereignty.eraQuestsCompleted,
    wondersControlled: imperialState.sandboxWondersBuilt || world.sovereignty.wondersControlled,
    currentDay: world.day,
    hasTribeDome: imperialState.sandboxDomeActive || world.sovereignty.tribeDomeUnlocked,
    tribeLoyaltyStage: world.sovereignty.tribeLoyaltyStage,
    kingAlive: world.sovereignty.kingAlive,
    workforce: imperialState.workforceByFocus,
    unlockedMilitaryTechs: countUnlockedMilitaryTechs(imperialState.militaryTechTree),
    dragonChoice: imperialState.dragonChoice,
    senateSatisfaction: imperialState.senate.satisfaction,
  });

  return (
    <section className="space-y-3">
      <article
        className="overflow-hidden rounded-[32px] border border-white/18 bg-slate-950/70 shadow-[0_24px_54px_rgba(2,6,23,0.48)]"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.08), rgba(2,6,23,0.96)), url('${selectedKing.imageSrc}')`,
          backgroundPosition: "center top",
          backgroundSize: "cover",
        }}
      >
        <div className="min-h-[430px] p-4 pt-64">
          <div className="rounded-[26px] border border-white/16 bg-slate-950/62 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">Rei da campanha</p>
            <h1 className="mt-1 text-2xl font-black text-slate-50">{kingName}</h1>
            <p className="mt-1 text-[12px] leading-5 text-slate-200">{selectedKing.summary}</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {selectedKing.traits.map((trait) => (
                <span
                  key={trait.label}
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
            <div className="mt-3 text-center">
              <div className="mx-auto max-w-[150px] rounded-2xl border border-cyan-200/18 bg-cyan-400/10 p-3">
                <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Score</p>
                <p className="text-xl font-black text-cyan-100">{sovereignty.total}</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="kw-glass rounded-[28px] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Conta global</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-500/12 text-cyan-100">
            <UserRound className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-50">{username}</h2>
            <p className="text-[12px] text-slate-300">Seu nick fixo fica fora da campanha.</p>
          </div>
        </div>
      </article>
    </section>
  );
}
