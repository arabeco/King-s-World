"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";

import { AuthSignOutButton } from "@/components/auth-signout-button";
import { SectionCard, StatusBadge } from "@/components/ui";
import type { WorldSummary } from "@/lib/mock-data";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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
        // Mantém o perfil do servidor se a API estiver indisponível.
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: next }),
      });
      const payload = (await response.json()) as ProfileApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar o nick.");
      }

      setUsername(payload.profile?.username ?? next);
      setDraftUsername(payload.profile?.username ?? next);
      setEditingName(false);
      setMessage("Nick salvo no perfil.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o nick.");
    } finally {
      setBusy(null);
    }
  };

  const requestDeletion = async () => {
    try {
      setBusy("delete");
      setError(null);
      setMessage(null);

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke("delete-account");

      if (error) throw new Error(error.message ?? "Não foi possível excluir a conta.");
      if (!data?.ok) throw new Error(data?.error ?? "Não foi possível excluir a conta.");

      setDeleteOpen(false);
      setDeleteReason("");
      setMessage("Conta excluída. Redirecionando...");
      window.setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a conta.");
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
            {medals.length > 0
              ? medals.map((medal) => <StatusBadge key={medal} label={medal} tone="warning" />)
              : <p className="list-meta">Sem medalhas ainda.</p>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Histórico de mundos" eyebrow="Campanhas encerradas">
        <div className="list-stack">
          {history.length > 0 ? (
            history.map((entry) => (
              <div key={entry.world} className="world-card">
                <strong>{entry.world}</strong>
                <span className="list-meta">Rank final #{entry.rank} · Tribo {entry.tribe}</span>
              </div>
            ))
          ) : (
            <p className="list-meta">Quando uma temporada terminar, o resultado aparece aqui.</p>
          )}
        </div>

        {message ? <p style={{ marginTop: "1rem", color: "#86efac" }}>{message}</p> : null}
        {error ? <p role="alert" style={{ marginTop: "1rem", color: "#fecaca" }}>{error}</p> : null}

        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <Link className="secondary-button" href="/lobby">
            Lobby
          </Link>
          <Link className="primary-button" href="/premium">
            Premium
          </Link>
          <AuthSignOutButton />
        </div>
      </SectionCard>

      {/* Zona de risco — discreta, separada dos botões principais */}
      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "none",
            border: "none",
            color: "rgba(248,113,113,0.55)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            padding: "0.5rem 1rem",
            borderRadius: 12,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(248,113,113,0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(248,113,113,0.55)")}
        >
          <Trash2 size={13} />
          Encerrar conta
        </button>
      </div>

      {/* Modal de exclusão */}
      {deleteOpen ? (
        <div className="fixed inset-0 z-[90]">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setDeleteOpen(false)}
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
          />

          <section
            className="absolute inset-x-3 bottom-4 mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-rose-300/25 shadow-[0_28px_60px_rgba(2,6,23,0.7)]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(2,6,23,0.25), rgba(2,6,23,0.97)), url('/images/modal-delete-account.jpg')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/80">
                    Zona de risco
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-50">Encerrar conta?</h2>
                  <p className="mt-2 text-[12px] leading-5 text-slate-300">
                    Isso não apaga imediatamente. Registra um pedido de exclusão no banco para uma remoção segura e revisada — os dados ficam por até 30 dias antes de serem apagados.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setDeleteOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-slate-300"
                >
                  <X size={16} />
                </button>
              </div>

              <textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Motivo opcional (nos ajuda a melhorar)"
                rows={3}
                className="mt-4 w-full rounded-2xl border border-white/14 bg-slate-950/70 px-3 py-2.5 text-[12px] text-slate-200 placeholder:text-slate-600 outline-none resize-none"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy === "delete"}
                  onClick={requestDeletion}
                  className="rounded-2xl border border-rose-300/40 bg-rose-500/18 px-4 py-3 text-sm font-black text-rose-100 transition active:scale-95 disabled:opacity-50"
                >
                  {busy === "delete" ? "Registrando..." : "Confirmar encerramento"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(false)}
                  className="rounded-2xl border border-white/14 bg-white/8 px-4 py-3 text-sm font-black text-slate-200 transition active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
