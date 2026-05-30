"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { MarketingShell } from "@/components/marketing-shell";
import { getSupabaseBrowserClient, hasPublicSupabaseEnv } from "@/lib/supabase-browser";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <path d="M14.048 9.38c-.02-2.087 1.706-3.094 1.784-3.145-0.974-1.423-2.487-1.618-3.02-1.636-1.285-.13-2.516.759-3.167.759-.655 0-1.66-.741-2.733-.72-1.403.02-2.7.817-3.42 2.073-1.459 2.534-.374 6.283 1.05 8.337.696 1.003 1.524 2.126 2.613 2.086 1.053-.042 1.45-.676 2.724-.676 1.27 0 1.63.676 2.737.654 1.13-.02 1.843-1.022 2.533-2.03.8-1.163 1.13-2.291 1.147-2.35-.025-.01-2.196-.843-2.218-3.35zM11.905 3.094c.578-.7.968-1.672.862-2.64-.834.034-1.843.556-2.44 1.258-.537.621-.1.006-1.668 1.545.917-.028 1.854-.464 2.598-1.163h.648z"/>
    </svg>
  );
}

type SocialProvider = "google" | "apple";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  function getRedirectPath() {
    const nextPath =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null;
    return nextPath?.startsWith("/") ? nextPath : "/lobby";
  }

  async function handleSocialLogin(provider: SocialProvider) {
    if (!hasPublicSupabaseEnv()) {
      setError("Supabase não configurado.");
      return;
    }
    setError(null);
    setSocialLoading(provider);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${getRedirectPath()}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setSocialLoading(null);
      }
      // Sem setSocialLoading(null) em sucesso — o redirect vai acontecer
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setSocialLoading(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!hasPublicSupabaseEnv()) {
      setError("Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(getRedirectPath());
    router.refresh();
  }

  async function handleDevLogin() {
    setError(null);
    setDevLoading(true);
    try {
      const response = await fetch("/api/dev-login", { method: "POST" });
      if (!response.ok) {
        throw new Error("Entrada dev indisponível neste ambiente.");
      }
      router.replace(getRedirectPath());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar como dev.");
    } finally {
      setDevLoading(false);
    }
  }

  const busy = loading || devLoading || socialLoading !== null;

  return (
    <MarketingShell
      title="Entre no tabuleiro"
      subtitle="KingsWorld já está estruturado para guerra, logística e fim de mundo. Agora a campanha começa de verdade."
    >
      {/* Botões sociais */}
      <div className="form-stack">
        <button
          type="button"
          disabled={busy}
          onClick={() => handleSocialLogin("google")}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/18 bg-white/8 px-4 py-3 text-sm font-bold text-slate-50 backdrop-blur-sm transition active:scale-95 disabled:opacity-50 hover:bg-white/12"
        >
          {socialLoading === "google" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <GoogleLogo />
          )}
          {socialLoading === "google" ? "Entrando..." : "Continuar com Google"}
        </button>

        <button
          type="button"
          disabled
          title="Em breve — disponível na versão iOS"
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm font-bold text-slate-500 backdrop-blur-sm cursor-not-allowed"
        >
          <AppleLogo />
          <span>Continuar com Apple</span>
          <span className="ml-auto rounded-full border border-white/14 bg-white/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
            Em breve
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/12" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            ou continue com email
          </span>
          <div className="h-px flex-1 bg-white/12" />
        </div>

        {/* Formulário email/senha */}
        <form className="form-stack" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />
          <input
            type="password"
            placeholder="Senha"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={busy}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {process.env.NODE_ENV !== "production" ? (
          <button
            className="secondary-button"
            type="button"
            onClick={handleDevLogin}
            disabled={busy}
            data-smoke="login-dev-button"
          >
            {devLoading ? "Abrindo dev..." : "Entrar como dev"}
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-500/12 px-3 py-2 text-[12px] font-semibold text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="inline-actions">
          <Link className="secondary-button" href="/register">
            Criar conta
          </Link>
          <Link className="ghost-link" href="/forgot-password">
            Esqueci minha senha
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
