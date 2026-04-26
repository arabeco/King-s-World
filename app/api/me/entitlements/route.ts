import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { entitlementIsPremium, pickBestPremiumEntitlement, type UserEntitlementRecord } from "@/lib/entitlements";
import { supabaseSelect } from "@/lib/supabase-rest";

export async function GET() {
  try {
    const appUser = await requireAuthenticatedAppUser();
    const params = new URLSearchParams();
    params.set(
      "select",
      "id,user_id,provider,product_id,purchase_token,order_id,status,store_environment,started_at,expires_at,auto_renewing,will_renew,last_verified_at,raw_payload,created_at,updated_at",
    );
    params.set("user_id", `eq.${appUser.id}`);
    const entitlements = await supabaseSelect<UserEntitlementRecord>("user_entitlements", params);
    const premiumEntitlement = pickBestPremiumEntitlement(entitlements);

    return NextResponse.json({
      userId: appUser.id,
      premium: {
        active: Boolean(premiumEntitlement && entitlementIsPremium(premiumEntitlement.status, premiumEntitlement.expires_at)),
        entitlement: premiumEntitlement,
      },
      entitlements,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load entitlements.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
