import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { entitlementIsPremium, type UserEntitlementRecord } from "@/lib/entitlements";
import { hasGooglePlayBillingEnv, verifyGooglePlaySubscriptionPurchase } from "@/lib/google-play-billing";
import { supabaseInsertReturning } from "@/lib/supabase-rest";

type VerifyPayload = {
  productId?: string | null;
  purchaseToken?: string | null;
  packageName?: string | null;
};

export async function POST(request: Request) {
  try {
    if (!hasGooglePlayBillingEnv()) {
      return NextResponse.json(
        { error: "Google Play billing is not configured. Set GOOGLE_PLAY_PACKAGE_NAME and service account credentials." },
        { status: 503 },
      );
    }

    const appUser = await requireAuthenticatedAppUser();
    const body = (await request.json()) as VerifyPayload;
    if (!body.purchaseToken) {
      return NextResponse.json({ error: "purchaseToken is required." }, { status: 400 });
    }

    const verified = await verifyGooglePlaySubscriptionPurchase({
      purchaseToken: body.purchaseToken,
      productId: body.productId,
      packageName: body.packageName,
    });

    const rows = await supabaseInsertReturning<
      UserEntitlementRecord,
      UserEntitlementRecord
    >(
      "user_entitlements",
      {
        user_id: appUser.id,
        provider: "google_play",
        product_id: verified.productId,
        purchase_token: verified.purchaseToken,
        order_id: verified.orderId,
        status: verified.status,
        store_environment: verified.storeEnvironment,
        started_at: verified.startedAt,
        expires_at: verified.expiresAt,
        auto_renewing: verified.autoRenewing,
        will_renew: verified.willRenew,
        last_verified_at: new Date().toISOString(),
        raw_payload: verified.rawPayload,
      },
      "provider,purchase_token",
    );

    const entitlement = rows[0] ?? null;
    return NextResponse.json({
      premiumActive: entitlement ? entitlementIsPremium(entitlement.status, entitlement.expires_at) : false,
      entitlement,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify Google Play purchase.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
