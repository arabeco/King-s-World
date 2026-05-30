"use client";

import { AlertTriangle, ArrowRight, Compass, Lightbulb, ShieldAlert } from "lucide-react";

import type { PlayerAlertCard, PlayerAlertChoice } from "@/lib/player-alerts";
import type { ImperialDecisionInboxItem } from "@/lib/imperial-state";
import { emitUiFeedback } from "@/lib/ui-feedback";

function tone(card: PlayerAlertCard) {
  if (card.severity === "high") {
    return {
      badge: "Critico",
      shell: "border-rose-300/25 bg-rose-500/10 text-rose-50",
      pill: "border-rose-300/30 bg-rose-500/16 text-rose-100",
      icon: AlertTriangle,
    };
  }
  if (card.severity === "medium") {
    return {
      badge: "Pressao",
      shell: "border-amber-300/25 bg-amber-500/10 text-amber-50",
      pill: "border-amber-300/30 bg-amber-500/16 text-amber-100",
      icon: ShieldAlert,
    };
  }
  return {
    badge: "Leitura",
    shell: "border-sky-300/25 bg-sky-500/10 text-sky-50",
    pill: "border-sky-300/30 bg-sky-500/16 text-sky-100",
    icon: Lightbulb,
  };
}

function kindLabel(kind: PlayerAlertCard["kind"]) {
  if (kind === "decision") return "Escolha";
  if (kind === "opportunity") return "Janela";
  return "Sinal";
}

function choiceClass(card: PlayerAlertCard, choice: PlayerAlertChoice) {
  const base = "rounded-xl border px-2.5 py-2 text-left text-[10px] font-semibold transition";
  if (!choice.tab) {
    return `${base} border-white/10 bg-white/6 text-slate-200 hover:bg-white/10`;
  }

  if (card.severity === "high") {
    return `${base} border-rose-300/35 bg-rose-500/16 text-rose-50 hover:bg-rose-500/22`;
  }
  if (card.severity === "medium") {
    return `${base} border-amber-300/35 bg-amber-500/16 text-amber-50 hover:bg-amber-500/22`;
  }
  return `${base} border-cyan-300/35 bg-cyan-500/16 text-cyan-50 hover:bg-cyan-500/22`;
}

function urgencyMeta(
  card: PlayerAlertCard,
  decisionState?: ImperialDecisionInboxItem,
): { expiresIn: string; ignoreCost: string } | null {
  if (card.kind !== "decision") {
    return null;
  }
  if (decisionState) {
    const statusLabel =
      decisionState.status === "expired"
        ? "Expirada"
        : decisionState.status === "resolved"
          ? "Resolvida"
          : `Expira no dia ${decisionState.expiresAtDay}`;
    return {
      expiresIn: statusLabel,
      ignoreCost: decisionState.consequenceLabel,
    };
  }
  if (card.severity === "high") {
    return {
      expiresIn: "Expira em 2 dias",
      ignoreCost: "Se ignorar: custo moderado por atraso em uma frente real.",
    };
  }
  if (card.severity === "medium") {
    return {
      expiresIn: "Expira em 3 dias",
      ignoreCost: "Se ignorar: perde eficiencia e margem pequena.",
    };
  }
  return {
    expiresIn: "Expira em 4 dias",
    ignoreCost: "Se ignorar: a janela fecha e o ganho potencial cai.",
  };
}

export function PlayerAlertCards({
  primary,
  secondary,
  onChoice,
  title = "O que importa agora",
  subtitle = "Prioridade, risco e proximo clique.",
  decisionInboxById,
  onIgnoreDecision,
  showChoices = true,
}: {
  primary: PlayerAlertCard | null;
  secondary: PlayerAlertCard[];
  onChoice: (choice: PlayerAlertChoice) => void;
  title?: string;
  subtitle?: string;
  decisionInboxById?: Map<string, ImperialDecisionInboxItem>;
  onIgnoreDecision?: (cardId: string) => void;
  showChoices?: boolean;
}) {
  return (
    <article className="kw-glass rounded-3xl p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="kw-title text-base">{title}</h2>
          <p className="kw-subtle text-[11px]">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/6 px-2 py-1 text-[10px] font-semibold text-slate-300" title="Foco principal e sinais de apoio">
          {primary ? `1 + ${secondary.length}` : "0"}
        </span>
      </div>

      {primary ? (
        <AlertCard card={primary} onChoice={onChoice} featured decisionState={decisionInboxById?.get(primary.id)} onIgnoreDecision={onIgnoreDecision} showChoices={showChoices} />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[11px] leading-5 text-slate-300">
          Nada exige escolha agora. Use a aba Info para leitura fina da run.
        </div>
      )}

      {secondary.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {secondary.map((card) => (
            <AlertCard key={card.id} card={card} onChoice={onChoice} decisionState={decisionInboxById?.get(card.id)} onIgnoreDecision={onIgnoreDecision} showChoices={showChoices} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AlertCard({
  card,
  onChoice,
  featured = false,
  decisionState,
  onIgnoreDecision,
  showChoices,
}: {
  card: PlayerAlertCard;
  onChoice: (choice: PlayerAlertChoice) => void;
  featured?: boolean;
  decisionState?: ImperialDecisionInboxItem;
  onIgnoreDecision?: (cardId: string) => void;
  showChoices: boolean;
}) {
  const cardTone = tone(card);
  const Icon = cardTone.icon;
  const urgency = urgencyMeta(card, decisionState);

  return (
    <section className={`rounded-2xl border p-2.5 ${cardTone.shell} ${featured ? "shadow-[0_18px_40px_rgba(15,23,42,0.24)]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${cardTone.pill}`}>
              {cardTone.badge}
            </span>
            <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-200">
              {kindLabel(card.kind)}
            </span>
          </div>
          <p className="mt-1 text-[13px] font-bold text-slate-50">{card.title}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/8 p-2">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-white/6 px-2 py-1.5 text-[11px] text-slate-100">
        <p>{card.situation}</p>
        <p className="mt-1 text-slate-300">{card.impact}</p>
      </div>
      {urgency ? (
        <div className="mt-2 rounded-xl border border-amber-300/22 bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-100">
          <p>{urgency.expiresIn}</p>
          <p className="mt-1 text-amber-50/90">{urgency.ignoreCost}</p>
        </div>
      ) : null}

      {showChoices && card.choices.length > 0 ? (
        <div className="mt-2 grid gap-1.5">
          {card.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => {
                emitUiFeedback("tap", choice.tab ? "medium" : "light");
                onChoice(choice);
              }}
              className={choiceClass(card, choice)}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{choice.label}</span>
                {choice.tab ? (
                  choice.tab === "guide" ? <Compass className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />
                ) : null}
              </div>
              {choice.note ? <p className="mt-1 text-[10px] font-normal opacity-90">{choice.note}</p> : null}
            </button>
          ))}
          {card.kind === "decision" ? (
            <button
              type="button"
              onClick={() => onIgnoreDecision?.(card.id)}
              className="rounded-xl border border-rose-300/30 bg-rose-500/12 px-2.5 py-2 text-left text-[10px] font-semibold text-rose-50 transition hover:bg-rose-500/20"
            >
              Ignorar (aceitar custo)
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
