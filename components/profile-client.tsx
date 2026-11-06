"use client";

import AccountNavigation from "@/components/AccountNavigation";
import {CozyAccountPanel} from "./cozy/CozyAccountPanel";
import pageStyles from "./sovereign-page.module.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, X } from "lucide-react";

import {collectionRequest} from "@/lib/collection-client";
import { AuthSignOutButton } from "@/components/auth-signout-button";
import { SectionCard } from "@/components/ui";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ProfileClientProps = {
  initialUsername: string;

};

type ProfileApiResponse = {
  profile?: {
    id: string;
    username: string;
    email?: string;
  };
  error?: string;
};

export function ProfileClient({ initialUsername }: ProfileClientProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [draftUsername, setDraftUsername] = useState(initialUsername);
  const [editingName, setEditingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [busy, setBusy] = useState<"profile" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  const saveName = async () => {
    const next = draftUsername.trim();
    setError(null);setMessage(null);
    if (next.length < 3) {
      setError("O nick precisa ter pelo menos 3 caracteres.");
      return;
    }

    if(next.length>24||!/^[a-zA-Z0-9_]+$/.test(next)){setError("Use de 3 a 24 letras, números ou underline.");return;}
    try {
      setBusy("profile");
      setError(null);
      setMessage(null);
      const payload = await collectionRequest<ProfileApiResponse>("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: next }),
      });

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
    <main className={pageStyles.page}>
      <AccountNavigation active="profile"/>
      <div className={pageStyles.stage}>
        <button type="button" className={pageStyles.back} aria-label="Voltar" onClick={()=>document.referrer.startsWith(location.origin+"/")?router.back():router.push("/lobby")}>‹</button>
        <CozyAccountPanel username={username}/>
      </div><details style={{maxWidth:540,margin:"20px auto"}}><summary>Configurações da conta</summary>
      <div className="dashboard-grid">
        <SectionCard title={username} eyebrow="Perfil global">
          <div className="form-stack" style={{ marginTop: "1rem" }}>
            {editingName ? (
              <>
                <input
                  type="text"
                  value={draftUsername}
                  aria-label="Nickname da conta"
                  aria-describedby="nickname-rules"
                  aria-invalid={Boolean(error)}
                  minLength={3}
                  maxLength={24}
                  disabled={busy==='profile'}
                  autoComplete="nickname"
                  pattern="[a-zA-Z0-9_]+"
                  onChange={(event) => setDraftUsername(event.target.value)}
                  placeholder="Seu nick"
                />
                <small id="nickname-rules">3–24 caracteres · letras, números e _</small>
                {error&&<p role="alert" style={{color:"#fecaca"}}>{error}</p>}
                <div className="inline-actions">
                  <button className="primary-button" type="button" onClick={saveName} disabled={busy === "profile"}>
                    {busy === "profile" ? "Salvando..." : "Salvar nick"}
                  </button>
                  <button
                    disabled={busy==='profile'}
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setDraftUsername(username);
                      setError(null);setMessage(null);
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


          </div>
        </SectionCard>

      </div>
      <SectionCard title="Acesso à conta" eyebrow="Conta">
        {message ? <p style={{ marginTop: "1rem", color: "#86efac" }}>{message}</p> : null}
        {error&&!editingName ? <p role="alert" style={{ marginTop: "1rem", color: "#fecaca" }}>{error}</p> : null}

        <div className="inline-actions" style={{ marginTop: "1rem" }}>
          <AuthSignOutButton />
        </div>
      </SectionCard>

      </details>
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
