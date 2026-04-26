import type { ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  children,
  className = "",
  mediaSrc,
  accent = "default",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  mediaSrc?: string;
  accent?: "default" | "gold" | "cyan" | "danger";
}) {
  return (
    <section className={`section-card section-card--${accent} ${mediaSrc ? "section-card--media" : ""} ${className}`}>
      {mediaSrc ? <div className="section-card__media" style={{ backgroundImage: `url('${mediaSrc}')` }} /> : null}
      <div className="section-card__content">
        <div className="section-card__header">
          {eyebrow ? <span className="section-card__eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        <div className="section-card__body">{children}</div>
      </div>
    </section>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" | "warning" | "success" }) {
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}
