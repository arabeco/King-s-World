import Link from "next/link";

import { LobbyWorldSelector } from "@/components/lobby-world-selector";
import { SectionCard } from "@/components/ui";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { listWorldSummaries } from "@/lib/world-data";

export default async function LobbyPage() {
  const [worlds, appUser] = await Promise.all([
    listWorldSummaries(),
    requireAuthenticatedAppUser(),
  ]);

  return (
    <main className="marketing-shell marketing-shell--lobby" style={{ padding: "2rem 0 3rem" }}>
      <div className="marketing-brand-mark" aria-hidden="true" />
      <section className="kw-lobby-hero">
        <p className="eyebrow">Lobby de mundos</p>
        <h1>
          Escolha seu <span className="kw-gold-text">mundo</span>
        </h1>
        <p>
          Sua conta vive fora da campanha. O rei, a capital e o destino comecam depois que voce entra no mundo.
        </p>
      </section>

      {worlds.length > 0 ? (
        <LobbyWorldSelector username={appUser.username} worlds={worlds} />
      ) : (
        <SectionCard title="Nenhum mundo disponivel" eyebrow="Lobby">
          <p>Crie ou ative um mundo no Supabase para liberar a entrada.</p>
        </SectionCard>
      )}

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
