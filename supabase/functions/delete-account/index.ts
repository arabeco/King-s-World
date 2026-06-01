// KingsWorld — Edge Function: delete-account
// Deploy: npx supabase functions deploy delete-account --project-ref wdmrdovkkrgzalnpqdxe
// Secrets: usa apenas os auto-injetados pelo Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    // 1. Autentica o usuário pelo JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const userJwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!userJwt) throw new Error("AUTH_REQUIRED");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await supabase.auth.getUser(userJwt);
    if (userErr || !userData.user) throw new Error("AUTH_INVALID");

    const authUserId = userData.user.id;

    // 2. Apaga public.users → cascata limpa toda a game data
    const { error: deletePublicErr } = await supabase
      .from("users")
      .delete()
      .eq("auth_user_id", authUserId);

    if (deletePublicErr) {
      console.error("[delete-account] delete public.users falhou:", deletePublicErr.message);
      throw new Error("Falha ao apagar dados do perfil.");
    }

    // 3. Apaga auth.users — remove o login
    const { error: deleteAuthErr } = await supabase.auth.admin.deleteUser(authUserId);
    if (deleteAuthErr) {
      // Dados já apagados — não há como reverter. Loga e segue.
      console.error("[delete-account] auth.deleteUser falhou:", deleteAuthErr.message);
    }

    return json({ ok: true }, 200, origin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[delete-account]", msg);
    const status = msg === "AUTH_REQUIRED" || msg === "AUTH_INVALID" ? 401 : 500;
    return json({ ok: false, error: msg }, status, origin);
  }
});
