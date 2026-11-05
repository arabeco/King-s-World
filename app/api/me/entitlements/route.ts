import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { pickBestPremiumEntitlement, type UserEntitlementRecord } from "@/lib/entitlements";
import { supabaseSelect,supabaseRpc } from "@/lib/supabase-rest";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

export async function GET() {
  try {
    const appUser = await requireAuthenticatedAppUser();
    const params = new URLSearchParams();
    params.set(
      "select",
      "user_id,provider,product_id,status,store_environment,expires_at,auto_renewing,will_renew,last_verified_at",
    );
    params.set("user_id", `eq.${appUser.id}`);
    const entitlements = await supabaseSelect<UserEntitlementRecord>("user_entitlements", params);
    const premiumEntitlement = pickBestPremiumEntitlement(entitlements);
    const benefits=await supabaseRpc<{active:boolean;worldLimit:number;activeWorlds:number;canCreate:boolean;canPasswordWorld:boolean;adFree:boolean}>("kw_premium_benefits",{p_user_id:appUser.id});
    const publicEntitlement=premiumEntitlement?{
      product_id:premiumEntitlement.product_id,status:premiumEntitlement.status,expires_at:premiumEntitlement.expires_at,
      auto_renewing:premiumEntitlement.auto_renewing,will_renew:premiumEntitlement.will_renew,store_environment:premiumEntitlement.store_environment,
    }:null;

    return NextResponse.json({
      userId: appUser.id,
      premium: {
        active: benefits.active,
        entitlement: publicEntitlement,
      },
      benefits,
    },{headers});
  } catch (error) {
    const unauthorized=error instanceof Error&&error.message==="Unauthorized";
    return NextResponse.json({ error: unauthorized?"Entre na sua conta para continuar.":"Não foi possível consultar seu Premium. Tente novamente." }, { status: unauthorized ? 401 : 503,headers });
  }
}
