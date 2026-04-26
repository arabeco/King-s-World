"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthSignOutButton } from "@/components/auth-signout-button";
import { SectionCard, StatusBadge } from "@/components/ui";
import type { WorldSummary } from "@/lib/mock-data";

type ProfileClientProps = {
  initialUsername: string;
  globalScore: number;
  medals: string[];
  history: {
    world: string;
    rank: number;
    tribe: string;
  }[];
  worlds: WorldSummary[];
};

type ProfileApiResponse = {
  profile?: {
    id: string;
    username: string;
    email?: string;
  };
  error?: string;
};

export function ProfileClient({ initialUsername, globalScore, medals, history, worlds }: ProfileClientProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [draftUsername, setDraftUsername] = useState(initialUsername);
  const [editingName, setEditingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [busy, setBusy] = useState<"profile" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/me/profile", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as ProfileApiResponse;
        if (active && payload.profile?.username) {
          setUsername(payload.profile.username);
          setDraftUsername(payload.profile.username);
        }
      } catch {
        // Keep the server-provided profile if the API is temporarily unavailable.
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleWorldChange = (worldId: string) => {
    if (!worldId) return;
    const world = worlds.find((entry) => entry.id === worldId);
    if (!world) return;
    const href =
      world.status === "Em Andamento"
        ? `/world/${world.id}/base`
        : world.status === "Finalizado"
          ? `/world/${world.id}/report`
          : `/world/${world.id}/empire`;
    router.push(href);
  };

  const saveName = async () => {
    const next = draftUsername.trim();
    if (next.length < 3) {
      setMessage("O nick precisa ter pelo menos 3 caracteres.");
      return;
    }

    try {
      setBusy("profile");
      setError(null);
      setMessage(null);
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: next }),
      });
      const payload = (await response.json()) as ProfileApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel salvar o nick.");
      }

      setUsername(payload.profile?.username ?? next);
      setDraftUsername(payload.profile?.username ?? next);
      setEditingName(false);
      setMessage("Nick salvo no perfil.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o nick.");
    } finally {
      setBusy(null);
    }
  };

  const requestDeletion = async () => {
    try {
      setBusy("delete");
      setError(null);
      setMessage(null);
      const response = await fetch("/api/me/delete-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: deleteReason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel solicitar exclusao.");
      }

      setDeleteOpen(false);
      setDeleteReason("");
      setMessage("Pedido de exclusao registrado. A conta fica marcada para revisao segura.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel solicitar exclusao.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="marketing-shell marketing-shell--profile" style={{ padding: "2rem 0 3rem" }}>
      <div className="marketing-brand-mark" aria-hidden="true" />
      <div className="dashboard-grid">
        <SectionCard title={username} eyebrow="Perfil global">
          <div className="metric-grid">
            <div>
              <span>Score global</span>
              <strong>{globalScore.toLocaleString("pt-BR")}</strong>
            </div>
            <div>
              <span>Medalhas</span>
              <strong>{medals.length}</strong>
            </div>
          </div>

          <div className="form-stack" style={{ marginTop: "1rem" }}>
            {editingName ? (
              <>
                <input
                  type="text"
                  value={draftUsername}
                  minLength={3}
                  onChange={(event) => setDraftUsername(event.target.value)}
                  placeholder="Seu nick"
                />
                <div className="inline-actions">
                  <button className="primary-button" type="button" onClick={saveName} disabled={busy === "profile"}>
                    {busy === "profile" ? "Salvando..." : "Salvar nick"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setDraftUsername(username);
                      setEditingName(false);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <button className="secondary-button" type="button" onClick={() => setEditingName(true)}>
                Editar nick
              </button>
            )}

            <label className="list-meta" htmlFor="world-picker">
              Trocar de mundo
            </label>
            <select id="world-picker" defaultValue="" onChange={(event) => handleWorldChange(event.target.value)}>
              <option value="" disabled>
                Escolha um mundo
              </option>
              {worlds.map((world) => (
                <option key={world.id} value={world.id}>
                  {world.name} - {world.status}
                </option>
              ))}
            </select>
          </div>
        </SectionCard>

        <SectionCard title="Legado" eyebrow="Marcas permanentes">
          <div className="list-stack">
            {medals.length > 0 ? medals.map((medal) => <StatusBadge key={medal} label={medal} tone="warning" />) : <p className="list-meta">Sem medalhas ainda.</p>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Historico de mundos" eyebrow="Campanhas encerradas">
        <div className="list-stack">
          {history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.world} className="world-card">
                <strong>{entry.world}</strong>
                <span className="list-meta">Rank final #{entry.rank} - Tribo {entry.tribe}</span>
              </div>
            ))
          ) : (
            <p className="list-meta">Quando uma temporada terminar, o resultado aparece aqui.</p>
          )}
        </div>

        {message ? <p style={{ marginTop: "1rem" }}>{message}</p> : null}
        {error ? <p role="alert" style={{ marginTop: "1rem", color: "#fecaca" }}>{error}</p> : null}

        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <Link className="secondary-button" href="/lobby">
            Voltar ao lobby
          </Link>
          <Link className="primary-button" href="/premium">
            Premium Android
          </Link>
          <button className="secondary-button" type="button" onClick={() => setDeleteOpen(true)}>
            Deletar conta
          </button>
          <AuthSignOutButton />
        </div>
      </SectionCard>

      {deleteOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="marketing-panel"
          style={{
            position: "fixed",
            inset: "auto 1rem 1rem 1rem",
            zIndex: 50,
            maxWidth: 520,
            margin: "0 auto",
            borderColor: "rgba(248,113,113,0.35)",
            overflow: "hidden",
            background:
              "linear-gradient(180deg, rgba(2,6,23,0.36), rgba(2,6,23,0.96)), url('/images/modal-delete-account.jpg') center / cover",
          }}
        >
          <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 16, background: "rgba(15,23,42,0.58)", backdropFilter: "blur(14px)" }}>
            <h2>Deletar conta?</h2>
            <p>
              Isso nao apaga imediatamente. Ele registra um pedido de exclusao no Supabase para uma rotina segura de remocao.
            </p>
            <textarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Motivo opcional"
              rows={3}
              style={{ width: "100%", marginTop: "0.75rem" }}
            />
            <div className="inline-actions" style={{ marginTop: "1rem" }}>
              <button
                className="primary-button"
                type="button"
                disabled={busy === "delete"}
                onClick={requestDeletion}
              >
                {busy === "delete" ? "Registrando..." : "Registrar pedido"}
              </button>
              <button className="secondary-button" type="button" onClick={() => setDeleteOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
