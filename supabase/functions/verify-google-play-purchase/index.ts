// KingsWorld — Edge Function: verify-google-play-purchase
// Deploy: npx supabase functions deploy verify-google-play-purchase --project-ref wdmrdovkkrgzalnpqdxe
// Configure Play package and service-account secrets through the Supabase secret store.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";
import {parsePlaySubscription,playAccountId} from "../_shared/play-subscription.ts";
import {PLAY_GEM_PRODUCTS,parsePlayGemPurchase} from "../_shared/play-gems.ts";

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
const KNOWN_PRODUCTS: Record<string, { kind: "subscription"|"gems" }> = {
  premium_monthly: { kind: "subscription" },
  ...Object.fromEntries(Object.keys(PLAY_GEM_PRODUCTS).map(id=>[id,{kind:"gems" as const}])),
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  SUPABASE_URL,
  "https://king-s-world.vercel.app",
  "https://king-s-world-three.vercel.app",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "http://localhost:3000",
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary":"Origin",
  };
}

function json(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control":"no-store", ...corsHeaders(origin) },
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

  if (!res.ok) throw new Error("PLAY_AUTH_UNAVAILABLE");
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

  if (!res.ok) throw new Error("PLAY_VERIFICATION_UNAVAILABLE");

  const data = await res.json();

  return {...parsePlaySubscription(data,productId),purchaseToken,rawPayload:data};
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if(origin&&!ALLOWED_ORIGINS.includes(origin))return json({success:false,error:"ORIGIN_NOT_ALLOWED"},403);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    if(!GOOGLE_PLAY_PACKAGE_NAME||!GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)throw Error("PLAY_NOT_CONFIGURED");
    // 1. Auth — JWT do usuário
    const authHeader = req.headers.get("Authorization") ?? "";
    const userJwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!userJwt) throw new Error("AUTH_REQUIRED");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(userJwt);
    if (userErr || !userData.user) throw new Error("AUTH_INVALID");
    const authUserId = userData.user.id;
    const {data:appUser,error:appError}=await supabase.from("users").select("id,account_status,deletion_requested_at").eq("auth_user_id",authUserId).maybeSingle();
    if(appError||!appUser||(appUser.account_status??"active")!=="active"||appUser.deletion_requested_at)throw Error("APP_USER_REQUIRED");
    const userId=appUser.id;

    // 2. Parse do body
    const body = await req.json() as {
      productId?: string;
      purchaseToken?: string;
      packageName?: string;
    };

    if(typeof body.purchaseToken!=="string"||!body.purchaseToken.trim()||body.purchaseToken.length>8192)throw Error("INVALID_PURCHASE_TOKEN");
    if(typeof body.productId!=="string"||!Object.hasOwn(KNOWN_PRODUCTS,body.productId))throw Error("UNKNOWN_PRODUCT");

    // 3. Validação de catálogo server-side
    const catalog = KNOWN_PRODUCTS[body.productId];
    if (!catalog) throw new Error(`Produto desconhecido: ${body.productId}`);

    // 4. packageName tem que bater
    if (body.packageName && body.packageName !== GOOGLE_PLAY_PACKAGE_NAME) {
      throw new Error("PACKAGE_MISMATCH");
    }

    if(catalog.kind==='gems'){
      const {data:binding,error:bindingError}=await supabase.from('kw_play_gem_purchases').select('user_id,product_id,status').eq('purchase_token',body.purchaseToken).maybeSingle();
      if(bindingError)throw Error('PURCHASE_LOOKUP_UNAVAILABLE');
      if(binding&&binding.user_id!==userId)throw Error('PURCHASE_ACCOUNT_MISMATCH');
      if(binding&&binding.product_id!==body.productId)throw Error('PRODUCT_MISMATCH');
      if(binding?.status==='refunded')throw Error('PURCHASE_REVOKED');
      const accessToken=await getAccessToken();
      const productUrl=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}/purchases/products/${encodeURIComponent(body.productId)}/tokens/${encodeURIComponent(body.purchaseToken)}`;
      const response=await fetch(productUrl,{headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json'}});
      if(!response.ok)throw Error('PLAY_VERIFICATION_UNAVAILABLE');
      const purchaseData=await response.json();
      if(purchaseData?.purchaseState===1&&binding){
        const {error:refundError}=await supabase.rpc('kw_refund_play_gems',{p_purchase_token:body.purchaseToken});
        if(refundError)throw Error('REFUND_SAVE_UNAVAILABLE');
        throw Error('PURCHASE_NOT_COMPLETED');
      }
      const verified=parsePlayGemPurchase(purchaseData,body.productId);
      if(verified.accountId!==await playAccountId(authUserId))throw Error('PURCHASE_ACCOUNT_MISMATCH');
      if(verified.consumed&&!binding)throw Error('CONSUMED_PURCHASE_NOT_REGISTERED');
      const {data:credit,error:saveError}=await supabase.rpc('kw_grant_play_gems',{
        p_user_id:userId,p_product_id:body.productId,p_purchase_token:body.purchaseToken,p_order_id:verified.orderId,p_store_environment:verified.storeEnvironment,
      });
      if(saveError){
        if(['PURCHASE_ACCOUNT_MISMATCH','PURCHASE_REVOKED','PURCHASE_CONFLICT'].includes(saveError.message))throw Error(saveError.message);
        throw Error('GEM_CREDIT_UNAVAILABLE');
      }
      let consumptionPending=false;
      if(!verified.consumed){
        try{
          const consumed=await fetch(productUrl+':consume',{method:'POST',headers:{Authorization:`Bearer ${await getAccessToken()}`}});
          consumptionPending=!consumed.ok;
        }catch{consumptionPending=true;}
      }
      return json({success:true,kind:'gems',duplicate:credit.duplicate,credited:credit.credited,gems:credit.gems,gemDebt:credit.gemDebt,refundOffset:credit.refundOffset??0,consumptionPending},200,origin);
    }
    const {data:binding,error:bindingError}=await supabase.from("user_entitlements").select("user_id").eq("provider","google_play").eq("purchase_token",body.purchaseToken).maybeSingle();
    if(bindingError)throw Error("PURCHASE_LOOKUP_UNAVAILABLE");
    if(binding&&binding.user_id!==userId)throw Error("PURCHASE_ACCOUNT_MISMATCH");
    // 5. Verifica na Google Play API
    const verified = await verifySubscription(body.purchaseToken, body.productId);
    const expectedAccount=await playAccountId(authUserId);
    if(verified.accountId?verified.accountId!==expectedAccount:binding?.user_id!==userId)throw Error("PURCHASE_ACCOUNT_MISMATCH");

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

    if (rpcErr) throw new Error("ENTITLEMENT_SAVE_FAILED");
    // Acknowledge only AFTER durable credit. A retry can safely repeat both steps.
    if(verified.shouldAcknowledge){
      try{
        const ackToken=await getAccessToken();
        const result=await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(verified.productId)}/tokens/${encodeURIComponent(verified.purchaseToken)}:acknowledge`,{method:"POST",headers:{Authorization:`Bearer ${ackToken}`,"Content-Type":"application/json"},body:"{}"});
        if(!result.ok)console.warn("[play] acknowledgement pending",result.status);
      }catch{console.warn("[play] acknowledgement pending");}
    }

    return json({
      success: true,
      premiumActive: verified.active,
      duplicate: rpcData?.duplicate ?? false,
      entitlementId: rpcData?.id ?? null,
      status: rpcData?.status ?? "active",
      expiresAt: rpcData?.expires_at ?? verified.expiresAt,
    }, 200, origin);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const unauthorized=msg==="AUTH_REQUIRED"||msg==="AUTH_INVALID";
    const forbidden=["PURCHASE_ACCOUNT_MISMATCH","APP_USER_REQUIRED","PACKAGE_MISMATCH"].includes(msg);
    const unavailable=/UNAVAILABLE|PLAY_NOT_CONFIGURED|ENTITLEMENT_SAVE_FAILED/.test(msg);
    console.error("[verify-google-play-purchase]",unauthorized?"auth":forbidden?"account":unavailable?"service":"invalid_purchase");
    return json({success:false,error:unauthorized?"Entre na sua conta para restaurar a compra.":forbidden?"Esta compra não pertence a esta conta.":unavailable?"A verificação está indisponível. Tente novamente.":msg==='PURCHASE_PENDING'?"O pagamento ainda está pendente.":"Não foi possível validar esta compra."},unauthorized?401:forbidden?403:unavailable?503:400,origin);
  }
});
