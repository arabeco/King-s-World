// KingsWorld — Edge Function: verify-google-play-purchase
// Deploy: npx supabase functions deploy verify-google-play-purchase --project-ref wdmrdovkkrgzalnpqdxe
// Secrets:  npx supabase secrets set GOOGLE_PLAY_PACKAGE_NAME="com.kingsworld.app" --project-ref wdmrdovkkrgzalnpqdxe
//           npx supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(cat cloak-auth-c2b842df0e56.json)" --project-ref wdmrdovkkrgzalnpqdxe

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";

// ---------------------------------------------------------------------------
// Env (auto-injetado pelo Supabase + secrets configurados no dashboard)
// ---------------------------------------------------------------------------
const SUPABASE_URL                     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY        = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_PLAY_PACKAGE_NAME         = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "";
const GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "";

const ANDROIDPUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Cache de access token (evita re-auth a cada request)
let cachedToken: { value: string; expiresAt: number } | null = null;

// ---------------------------------------------------------------------------
// Catálogo server-side (fonte de autoridade — cliente nunca é)
// ---------------------------------------------------------------------------
const KNOWN_PRODUCTS: Record<string, { kind: "subscription"; durationDays: number }> = {
  premium_monthly: { kind: "subscription", durationDays: 30 },
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  SUPABASE_URL,
  "https://kingsworld.vercel.app",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:3000",
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ---------------------------------------------------------------------------
// Google access token com cache de 1h
// ---------------------------------------------------------------------------
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  if (!GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON não configurado");

  const sa = JSON.parse(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  const privateKey = await importPKCS8(sa.private_key.replace(/\\n/g, "\n"), "RS256");

  const assertion = await new SignJWT({ scope: ANDROIDPUBLISHER_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(GOOGLE_OAUTH_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) throw new Error(`Google auth falhou: ${res.status} ${await res.text()}`);
  const payload = await res.json();

  cachedToken = { value: payload.access_token, expiresAt: now + (payload.expires_in ?? 3600) };
  return cachedToken.value;
}

// ---------------------------------------------------------------------------
// Verificação de subscription na Google Play API v3
// ---------------------------------------------------------------------------
async function verifySubscription(purchaseToken: string, productId: string) {
  const accessToken = await getAccessToken();
  const pkg = encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME);
  const token = encodeURIComponent(purchaseToken);

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${token}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Google Play verificação falhou: ${res.status} ${await res.text()}`);

  const data = await res.json();

  if (data.subscriptionState !== "SUBSCRIPTION_STATE_ACTIVE") {
    throw new Error(`Subscription não está ativa: ${data.subscriptionState}`);
  }

  const lineItem = (data.lineItems ?? []).find((item: any) => item.productId === productId) ?? data.lineItems?.[0];
  if (!lineItem?.productId) throw new Error("Google Play não retornou productId na subscription");

  // Acknowledge server-side (não-fatal — benefício já foi dado, client também acknowledge)
  // URL correta: /purchases/subscriptions/{productId}/tokens/{token}:acknowledge
  try {
    const ackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${token}:acknowledge`;
    await fetch(ackUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch { /* não-fatal */ }

  return {
    productId: lineItem.productId as string,
    purchaseToken,
    status: "active" as const,
    storeEnvironment: data.testPurchase ? "sandbox" : "production" as "sandbox" | "production",
    startedAt: data.startTime ?? null,
    expiresAt: lineItem.expiryTime ?? null,
    autoRenewing: Boolean(lineItem.autoRenewingPlan),
    willRenew: Boolean(lineItem.autoRenewingPlan),
    orderId: lineItem.latestSuccessfulOrderId ?? null,
    rawPayload: data,
  };
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    // 1. Auth — JWT do usuário
    const authHeader = req.headers.get("Authorization") ?? "";
    const userJwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!userJwt) throw new Error("AUTH_REQUIRED");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(userJwt);
    if (userErr || !userData.user) throw new Error("AUTH_INVALID");
    const userId = userData.user.id;

    // 2. Parse do body
    const body = await req.json() as {
      productId?: string;
      purchaseToken?: string;
      packageName?: string;
    };

    if (!body.purchaseToken) throw new Error("purchaseToken é obrigatório");
    if (!body.productId)     throw new Error("productId é obrigatório");

    // 3. Validação de catálogo server-side
    const catalog = KNOWN_PRODUCTS[body.productId];
    if (!catalog) throw new Error(`Produto desconhecido: ${body.productId}`);

    // 4. packageName tem que bater
    if (body.packageName && body.packageName !== GOOGLE_PLAY_PACKAGE_NAME) {
      throw new Error("PACKAGE_MISMATCH");
    }

    // 5. Verifica na Google Play API
    const verified = await verifySubscription(body.purchaseToken, body.productId);

    // 6. Salva com RPC idempotente (FOR UPDATE lock)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("grant_kw_entitlement", {
      p_user_id:           userId,
      p_provider:          "google_play",
      p_product_id:        verified.productId,
      p_purchase_token:    verified.purchaseToken,
      p_order_id:          verified.orderId,
      p_status:            verified.status,
      p_store_environment: verified.storeEnvironment,
      p_started_at:        verified.startedAt,
      p_expires_at:        verified.expiresAt,
      p_auto_renewing:     verified.autoRenewing,
      p_will_renew:        verified.willRenew,
      p_raw_payload:       verified.rawPayload,
    });

    if (rpcErr) throw new Error(`RPC falhou: ${rpcErr.message}`);

    return json({
      success: true,
      premiumActive: true,
      duplicate: rpcData?.duplicate ?? false,
      entitlementId: rpcData?.id ?? null,
      status: rpcData?.status ?? "active",
      expiresAt: rpcData?.expires_at ?? verified.expiresAt,
    }, 200, origin);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verify-google-play-purchase]", msg);
    const status = msg === "AUTH_REQUIRED" || msg === "AUTH_INVALID" ? 401 : 400;
    return json({ success: false, error: msg }, status, origin);
  }
});
