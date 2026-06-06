import { Capacitor } from "@capacitor/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// Deep link do app — precisa bater com:
// - custom_url_scheme em android/app/src/main/res/values/strings.xml
// - intent-filter em android/app/src/main/AndroidManifest.xml
// - appId em capacitor.config.ts
// - Redirect URLs do Supabase
export const NATIVE_AUTH_SCHEME = "com.kingsworld.app";
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://auth/callback`;

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNativeAuthCallbackUrl(url: string): boolean {
  return typeof url === "string" && url.startsWith(NATIVE_AUTH_REDIRECT);
}

export type ParsedAuthCallback = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
  next: string | null;
};

/**
 * Extrai code/tokens/erro do deep link de retorno do OAuth.
 * Cobre PKCE (?code=) — o fluxo esperado com @supabase/ssr — e Implicit
 * (#access_token=) como rede de segurança. Tolera URL malformada.
 */
export function parseAuthCallback(value: string): ParsedAuthCallback {
  try {
    const parsed = new URL(value);

    const code = parsed.searchParams.get("code");
    const queryError = parsed.searchParams.get("error");
    const queryErrorDesc = parsed.searchParams.get("error_description");
    const nextParam = parsed.searchParams.get("next");

    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let hashError: string | null = null;
    let hashErrorDesc: string | null = null;
    if (parsed.hash && parsed.hash.length > 1) {
      const hashParams = new URLSearchParams(parsed.hash.slice(1));
      accessToken = hashParams.get("access_token");
      refreshToken = hashParams.get("refresh_token");
      hashError = hashParams.get("error");
      hashErrorDesc = hashParams.get("error_description");
    }

    const next = nextParam && nextParam.startsWith("/") ? nextParam : null;

    return {
      code,
      accessToken,
      refreshToken,
      error: queryError ?? hashError,
      errorDescription: queryErrorDesc ?? hashErrorDesc,
      next,
    };
  } catch {
    return {
      code: null,
      accessToken: null,
      refreshToken: null,
      error: "invalid_callback_url",
      errorDescription: null,
      next: null,
    };
  }
}

/**
 * Inicia o login do Google no nativo: pede a URL de OAuth com PKCE (sem deixar
 * a WebView redirecionar) e abre no navegador do sistema (Custom Tab). O retorno
 * chega via deep link e é tratado pelo NativeAuthBridge.
 */
export async function startNativeGoogleSignIn(
  supabase: SupabaseClient,
  nextPath: string,
): Promise<void> {
  const safeNext = nextPath.startsWith("/") ? nextPath : "/lobby";
  const redirectTo = `${NATIVE_AUTH_REDIRECT}?next=${encodeURIComponent(safeNext)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }
  if (!data?.url) {
    throw new Error("Supabase não retornou a URL de OAuth.");
  }

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url });
}
