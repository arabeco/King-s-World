import Link from "next/link";

import { LobbyWorldSelector } from "@/components/lobby-world-selector";
import { CozyAccountPanel } from "@/components/cozy/CozyAccountPanel";
import { SectionCard } from "@/components/ui";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { listWorldSummaries } from "@/lib/world-data";

export default async function LobbyPage() {
  const appUser = await requireAuthenticatedAppUser();
  const worlds = await listWorldSummaries(appUser.id);

  return (
    <main className="marketing-shell marketing-shell--lobby" style={{ padding: "2rem 0 3rem" }}>
      <div className="marketing-brand-mark" aria-hidden="true" />
      <section className="kw-lobby-hero">
        <p className="eyebrow">Lobby de mundos</p>
        <h1>
          Escolha seu <span className="kw-gold-text">mundo</span>
        </h1>
      </section>

      <LobbyWorldSelector username={appUser.username} worlds={worlds} />
      <CozyAccountPanel />

      <SectionCard title="Gerenciar conta" eyebrow="Global" accent="cyan">
        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <Link className="primary-button" href="/premium">
            Premium Android
          </Link>
          <Link className="ghost-link" href="/profile">
            Ver perfil global
          </Link>
          <Link className="ghost-link" href="/login">
            Trocar conta
          </Link>
        </div>
      </SectionCard>
    </main>
  );
}
