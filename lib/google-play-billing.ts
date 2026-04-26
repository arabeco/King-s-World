import "server-only";

import { JWT } from "google-auth-library";

import type { EntitlementStatus } from "@/lib/entitlements";

const GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

const GOOGLE_PLAY_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? "";
const GOOGLE_PLAY_SERVICE_ACCOUNT_CLIENT_EMAIL = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_CLIENT_EMAIL ?? "";
const GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

type GooglePlaySubscriptionLineItem = {
  productId?: string;
  expiryTime?: string;
  latestSuccessfulOrderId?: string;
  autoRenewingPlan?: Record<string, unknown>;
};

type GooglePlaySubscriptionPurchase = {
  subscriptionState?: string;
  startTime?: string;
  lineItems?: GooglePlaySubscriptionLineItem[];
  testPurchase?: Record<string, unknown>;
  acknowledgementState?: string;
  canceledStateContext?: Record<string, unknown>;
};

export type GooglePlayVerifiedEntitlement = {
  provider: "google_play";
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  status: EntitlementStatus;
  storeEnvironment: "sandbox" | "production";
  startedAt: string | null;
  expiresAt: string | null;
  autoRenewing: boolean;
  willRenew: boolean;
  rawPayload: Record<string, unknown>;
};

export function hasGooglePlayBillingEnv(): boolean {
  return Boolean(
    GOOGLE_PLAY_PACKAGE_NAME &&
      GOOGLE_PLAY_SERVICE_ACCOUNT_CLIENT_EMAIL &&
      GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

function mapSubscriptionState(state: string | undefined): EntitlementStatus {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "grace_period";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "on_hold";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "paused";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "canceled";
    case "SUBSCRIPTION_STATE_PENDING":
      return "pending";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    case "SUBSCRIPTION_STATE_REVOKED":
      return "revoked";
    default:
      return "expired";
  }
}

async function getGoogleAccessToken(): Promise<string> {
  if (!hasGooglePlayBillingEnv()) {
    throw new Error("Google Play billing environment is not configured.");
  }

  const auth = new JWT({
    email: GOOGLE_PLAY_SERVICE_ACCOUNT_CLIENT_EMAIL,
    key: GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
    scopes: [GOOGLE_PLAY_SCOPE],
  });

  const tokenResponse = await auth.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error("Unable to fetch Google Play access token.");
  }

  return token;
}

export async function verifyGooglePlaySubscriptionPurchase(input: {
  purchaseToken: string;
  productId?: string | null;
  packageName?: string | null;
}): Promise<GooglePlayVerifiedEntitlement> {
  const packageName = input.packageName?.trim() || GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) {
    throw new Error("Missing Google Play package name.");
  }

  const purchaseToken = input.purchaseToken.trim();
  if (!purchaseToken) {
    throw new Error("Missing purchase token.");
  }

  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Google Play subscription verification failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as GooglePlaySubscriptionPurchase;
  const lineItems = payload.lineItems ?? [];
  const matchedLine =
    lineItems.find((entry) => entry.productId === input.productId) ??
    lineItems[0];
  const productId = matchedLine?.productId ?? input.productId ?? "";
  if (!productId) {
    throw new Error("Google Play verification did not return a product id.");
  }

  const status = mapSubscriptionState(payload.subscriptionState);
  const orderId = matchedLine?.latestSuccessfulOrderId ?? null;
  const expiresAt = matchedLine?.expiryTime ?? null;
  const autoRenewing = Boolean(matchedLine?.autoRenewingPlan);
  const willRenew = autoRenewing && (status === "active" || status === "grace_period");

  return {
    provider: "google_play",
    productId,
    purchaseToken,
    orderId,
    status,
    storeEnvironment: payload.testPurchase ? "sandbox" : "production",
    startedAt: payload.startTime ?? null,
    expiresAt,
    autoRenewing,
    willRenew,
    rawPayload: payload as unknown as Record<string, unknown>,
  };
}
