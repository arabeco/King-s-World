import type { ReactNode } from "react";

export function MarketingShell({
  title,
  subtitle,
  children,
  scene = "login",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  scene?: "login" | "register" | "profile" | "lobby";
}) {
  return (
    <main className={`marketing-shell marketing-shell--${scene}`}>
      <div className="marketing-brand-mark" aria-hidden="true" />
      <section className="marketing-hero">
        <p className="eyebrow">KingsWorld</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </section>
      <section className="marketing-panel">{children}</section>
    </main>
  );
}
