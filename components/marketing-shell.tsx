import type { ReactNode } from "react";

export function MarketingShell({
  title,
  subtitle,
  children,
  scene = "login",
  compact = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scene?: "login" | "register" | "profile" | "lobby";
  compact?: boolean;
}) {
  return (
    <main className={`marketing-shell marketing-shell--${scene}`}>
      <div className="marketing-brand-mark" aria-hidden="true" />
      <section className={`marketing-hero${compact ? " marketing-hero--compact" : ""}`}>
        <p className="eyebrow">KingsWorld</p>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </section>
      <section className="marketing-panel">{children}</section>
    </main>
  );
}
