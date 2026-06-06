"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  authLog,
  isNativeApp,
  isNativeAuthCallbackUrl,
  parseAuthCallback,
  takeNativeNext,
} from "@/lib/native-auth";

/**
 * Escuta o deep link de retorno do OAuth (Google) quando o app roda como
 * shell Capacitor. Renderiza nada — só registra o listener appUrlOpen.
 * No web (navegador normal) é no-op.
 */
export function NativeAuthBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let disposed = false;
    let remove: (() => void) | undefined;

    (async () => {
      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
      ]);
      if (disposed) {
        return;
      }

      const supabase = getSupabaseBrowserClient();

      authLog("listener appUrlOpen registrado");

      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        authLog(`appUrlOpen: ${url.slice(0, 60)}`);
        if (disposed || !isNativeAuthCallbackUrl(url)) {
          authLog("ignorado (não é callback de auth)");
          return;
        }

        const { code, accessToken, refreshToken, error, next } = parseAuthCallback(url);
        authLog(`parsed code=${code ? "sim" : "não"} token=${accessToken ? "sim" : "não"} err=${error ?? "-"}`);

        try {
          await Browser.close();
        } catch {
          // Custom Tab pode já ter fechado — ignora.
        }

        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error)}`);
          return;
        }

        const dest = next ?? takeNativeNext();

        try {
          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              throw exchangeError;
            }
          } else if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              throw sessionError;
            }
          } else {
            authLog("callback sem code nem token");
            router.replace("/login?error=auth_callback");
            return;
          }

          authLog(`sessão OK → ${dest}`);
          router.replace(dest);
          router.refresh();
        } catch (e) {
          authLog(`falha na troca: ${e instanceof Error ? e.message : "erro"}`);
          router.replace("/login?error=auth_callback");
        }
      });

      remove = () => {
        handle.remove();
      };
    })();

    return () => {
      disposed = true;
      remove?.();
    };
  }, [router]);

  return null;
}
