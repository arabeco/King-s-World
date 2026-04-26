import "server-only";

export type EntitlementStatus =
  | "active"
  | "grace_period"
  | "on_hold"
  | "paused"
  | "expired"
  | "canceled"
  | "revoked"
  | "pending";

export type UserEntitlementRecord = {
  id?: string;
  user_id: string;
  provider: "google_play";
  product_id: string;
  purchase_token: string;
  order_id?: string | null;
  status: EntitlementStatus;
  store_environment: "sandbox" | "production";
  started_at?: string | null;
  expires_at?: string | null;
  auto_renewing: boolean;
  will_renew: boolean;
  last_verified_at: string;
  raw_payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export function entitlementIsPremium(status: EntitlementStatus, expiresAt?: string | null): boolean {
  if (status !== "active" && status !== "grace_period") {
    return false;
  }
  if (!expiresAt) {
    return true;
  }
  return Date.parse(expiresAt) > Date.now();
}

export function pickBestPremiumEntitlement(entitlements: UserEntitlementRecord[]): UserEntitlementRecord | null {
  return [...entitlements]
    .sort((left, right) => Date.parse(right.expires_at ?? right.last_verified_at) - Date.parse(left.expires_at ?? left.last_verified_at))
    .find((entry) => entitlementIsPremium(entry.status, entry.expires_at)) ?? null;
}
