"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isNativeApp, isNativeAuthCallbackUrl, parseAuthCallback } from "@/lib/native-auth";

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

      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (disposed || !isNativeAuthCallbackUrl(url)) {
          return;
        }

        const { code, accessToken, refreshToken, error, next } = parseAuthCallback(url);

        try {
          await Browser.close();
        } catch {
          // Custom Tab pode já ter fechado — ignora.
        }

        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error)}`);
          return;
        }

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
            router.replace("/login?error=auth_callback");
            return;
          }

          router.replace(next ?? "/lobby");
          router.refresh();
        } catch {
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
