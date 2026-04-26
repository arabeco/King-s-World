"use client";

import type { ImperialExplorationDiscovery } from "@/lib/imperial-state";

type ExplorationRevealModalProps = {
  discovery: ImperialExplorationDiscovery;
  onDismiss: () => void;
};

function discoveryTypeLabel(type: ImperialExplorationDiscovery["type"]): string {
  switch (type) {
    case "opportunity":
      return "Oportunidade";
    case "threat":
      return "Ameaça";
    case "ruins":
      return "Ruína";
    case "dragon":
      return "Criatura rara";
    default:
      return "Território";
  }
}

function discoveryAccent(type: ImperialExplorationDiscovery["type"]): {
  chip: string;
  panel: string;
  glow: string;
} {
  switch (type) {
    case "opportunity":
      return {
        chip: "border-amber-300/45 bg-amber-500/12 text-amber-100",
        panel: "border-amber-300/25 bg-amber-500/10",
        glow: "rgba(251,191,36,0.26)",
      };
    case "threat":
      return {
        chip: "border-rose-300/45 bg-rose-500/12 text-rose-100",
        panel: "border-rose-300/25 bg-rose-500/10",
        glow: "rgba(244,63,94,0.24)",
      };
    case "ruins":
      return {
        chip: "border-violet-300/45 bg-violet-500/12 text-violet-100",
        panel: "border-violet-300/25 bg-violet-500/10",
        glow: "rgba(168,85,247,0.22)",
      };
    case "dragon":
      return {
        chip: "border-orange-300/50 bg-orange-500/14 text-orange-100",
        panel: "border-orange-300/30 bg-orange-500/10",
        glow: "rgba(249,115,22,0.26)",
      };
    default:
      return {
        chip: "border-cyan-300/35 bg-cyan-500/10 text-cyan-100",
        panel: "border-cyan-300/20 bg-cyan-500/10",
        glow: "rgba(34,211,238,0.22)",
      };
  }
}

export function ExplorationRevealModal({ discovery, onDismiss }: ExplorationRevealModalProps) {
  const accent = discoveryAccent(discovery.type);

  return (
    <div
      className="absolute inset-0 z-[95] flex items-end justify-center bg-black/50 p-3 sm:p-5"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[30px] border border-white/20 shadow-[0_24px_80px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(2,6,23,0.08) 0%, rgba(2,6,23,0.24) 34%, rgba(2,6,23,0.84) 72%, rgba(2,6,23,0.96) 100%), url('${discovery.imageSrc}')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          minHeight: "74%",
          boxShadow: `0 24px 80px rgba(0,0,0,0.62), 0 0 44px ${accent.glow}`,
        }}
      >
        <div className="flex h-full min-h-[560px] flex-col justify-between p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className={`inline-flex rounded-full border bg-black/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${accent.chip}`}>
              {discoveryTypeLabel(discovery.type)}
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/20 text-lg font-semibold text-white/90 transition hover:bg-black/30"
              aria-label="Fechar descoberta"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className={`rounded-[28px] border bg-black/18 p-4 backdrop-blur-md ${accent.panel}`}>
              <p className="text-3xl font-black leading-none text-white">{discovery.title}</p>
              <p className="mt-3 max-w-[28ch] text-sm leading-5 text-slate-200">{discovery.summary}</p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
                <div className={`rounded-2xl border bg-black/22 px-3 py-3 ${accent.panel}`}>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-400">Risco</span>
                  <span className="mt-1 block text-white">{discovery.riskLabel}</span>
                </div>
                <div className={`rounded-2xl border bg-black/22 px-3 py-3 ${accent.panel}`}>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-400">Valor</span>
                  <span className="mt-1 block text-white">{discovery.rewardLabel}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className={`rounded-2xl border px-3 py-3 text-sm font-black transition hover:brightness-110 ${accent.chip}`}
              >
                {discovery.actionLabel}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-2xl border border-white/15 bg-black/18 px-3 py-3 text-sm font-bold text-slate-100 transition hover:bg-black/26"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
