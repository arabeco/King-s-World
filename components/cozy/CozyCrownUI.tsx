import CozySymbol from "./CozySymbol";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { CozyPayload } from "@/lib/cozy/types";
import type { CozyCommand } from "./useCozyWorld";
import styles from "./cozy-crown.module.css";

export type CrownPanelProps = {
  data: CozyPayload;
  act: (action: CozyCommand) => Promise<boolean>;
  locked: boolean;
  now: number;
};
export const crownNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
    Math.floor(value),
  );
export const crownRemaining = (at: number, now: number) => {
  const minutes = Math.max(0, Math.ceil((at - now) / 60_000));
  if (!minutes) return "Concluindo…";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    : `${Math.floor(hours / 24)} d ${hours % 24} h`;
};
export function CrownPanel({
  tone,
  children,
}: {
  tone:
    "military" | "government" | "council" | "achievements" | "infrastructure";
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} data-crown-panel={tone}>
      {children}
    </section>
  );
}
export function CrownHeading({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </header>
  );
}
export function CrownButton({
  children,
  quiet = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { quiet?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`${quiet ? styles.quietButton : styles.button} ${className}`}
    >
      {children}
    </button>
  );
}
export function CrownCost({
  amount,
  kind = "materials",
}: {
  amount: number;
  kind?: "materials" | "gold" | "supplies";
}) {
  return (
    <span
      className={styles.cost}
      aria-label={`${crownNumber(amount)} ${kind === "gold" ? "ouro" : kind === "supplies" ? "suprimentos" : "materiais"}`}
    >
      <CozySymbol name={kind} size={22}/>
      <strong>{crownNumber(amount)}</strong>
    </span>
  );
}
export function CrownProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const actual = Math.max(0, Math.min(value, max));
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={label}
      aria-valuenow={actual}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <span style={{ width: `${max ? (actual / max) * 100 : 0}%` }} />
    </div>
  );
}
