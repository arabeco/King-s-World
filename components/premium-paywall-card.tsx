"use client";

import { Crown, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { UserEntitlementRecord } from "@/lib/entitlements";
import {
  acknowledgePremiumTransaction,
  isNativeAndroidBillingAvailable,
  loadPremiumProductOffer,
  purchasePremiumProduct,
  restorePremiumTransactions,
  type PremiumProductOffer,
} from "@/lib/native-purchases-client";
import { PLAY_PACKAGE_NAME, PLAY_PREMIUM_PRODUCT_ID } from "@/lib/premium-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type PremiumEntitlementsResponse = {
  premium?: {
    active?: boolean;
    entitlement?: UserEntitlementRecord | null;
  };
};

export function PremiumPaywallCard() {
  const [offer, setOffer] = useState<PremiumProductOffer | null>(null);
  const [premiumActive, setPremiumActive] = useState(false);
  const [entitlement, setEntitlement] = useState<UserEntitlementRecord | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshEntitlement() {
    const response = await fetch("/api/me/entitlements", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Não foi possível carregar o premium.");
    }
    const data = (await response.json()) as PremiumEntitlementsResponse;
    setPremiumActive(Boolean(data.premium?.active));
    setEntitlement(data.premium?.entitlement ?? null);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoadingOffer(true);
        setError(null);
        await refreshEntitlement();

        if (isNativeAndroidBillingAvailable()) {
          const nextOffer = await loadPremiumProductOffer();
          if (active) {
            setOffer(nextOffer);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Falha ao carregar premium.");
        }
      } finally {
        if (active) {
          setLoadingOffer(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function verifyTransaction(purchaseToken: string, productId: string) {
    const supabase = getSupabaseBrowserClient();

    const { data: payload, error } = await supabase.functions.invoke(
      "verify-google-play-purchase",
      { body: { purchaseToken, productId, packageName: PLAY_PACKAGE_NAME } },
    );

    if (error) throw new Error(error.message ?? "Falha ao validar compra.");
    if (!payload?.success) throw new Error(payload?.error ?? "Validação server falhou.");

    setPremiumActive(Boolean(payload.premiumActive));
    setEntitlement(
      payload.entitlementId
        ? { id: payload.entitlementId, status: payload.status, expires_at: payload.expiresAt ?? null } as any
        : null,
    );
  }

  async function handlePurchase() {
    try {
      setBusy("purchase");
      setError(null);
      setMessage(null);
      const transaction = await purchasePremiumProduct();
      if (!transaction.purchaseToken) {
        throw new Error("A compra não retornou purchaseToken.");
      }

      await verifyTransaction(transaction.purchaseToken, transaction.productIdentifier || PLAY_PREMIUM_PRODUCT_ID);
      await acknowledgePremiumTransaction(transaction);
      setMessage("Premium ativado e sincronizado com sua conta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a compra.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    try {
      setBusy("restore");
      setError(null);
      setMessage(null);
      const transactions = await restorePremiumTransactions();
      if (!transactions.length) {
        setMessage("Nenhuma assinatura ativa foi encontrada para restaurar.");
        return;
      }

      for (const transaction of transactions) {
        if (!transaction.purchaseToken) continue;
        await verifyTransaction(transaction.purchaseToken, transaction.productIdentifier || PLAY_PREMIUM_PRODUCT_ID);
        await acknowledgePremiumTransaction(transaction);
      }

      setMessage("Assinatura restaurada e sincronizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao restaurar compras.");
    } finally {
      setBusy(null);
    }
  }

  const platformLabel = isNativeAndroidBillingAvailable() ? "Android nativo" : "Web/desktop";

  return (
    <div className="kw-premium-panel">
      <div className="kw-premium-panel__inner">
        <div>
          <p className="eyebrow" style={{ color: "rgba(255,242,184,0.82)" }}>Premium Android</p>
          <h2 className="kw-gold-text" style={{ margin: "0.2rem 0 0.4rem", fontSize: "clamp(2rem, 7vw, 3.4rem)", lineHeight: 0.95 }}>
            Coroa Premium
          </h2>
          <p style={{ maxWidth: 520, color: "rgba(248,250,252,0.82)", lineHeight: 1.55 }}>
            Assinatura nativa da Play Store, sincronizada com sua conta global e pronta para liberar benefícios permanentes.
          </p>
        </div>

        <div className="kw-premium-strip">
          <div className="metric-grid">
            <div>
              <span>Status</span>
              <strong><ShieldCheck aria-hidden="true" size={18} /> {premiumActive ? "Premium ativo" : "Sem premium"}</strong>
            </div>
            <div>
              <span>Produto</span>
              <strong><Crown aria-hidden="true" size={18} /> {offer?.title ?? PLAY_PREMIUM_PRODUCT_ID}</strong>
            </div>
            <div>
              <span>Preço</span>
              <strong><Sparkles aria-hidden="true" size={18} /> {loadingOffer ? "Carregando" : offer?.priceString ?? "Play Store"}</strong>
            </div>
            <div>
              <span>Plataforma</span>
              <strong>{platformLabel}</strong>
            </div>
          </div>

          {entitlement?.expires_at ? (
            <p className="list-meta" style={{ color: "rgba(226,232,240,0.78)" }}>
              Expira em {new Date(entitlement.expires_at).toLocaleString("pt-BR")}
            </p>
          ) : null}

          <div className="inline-actions">
            <button className="primary-button" type="button" disabled={!isNativeAndroidBillingAvailable() || busy !== null || premiumActive} onClick={handlePurchase}>
              {busy === "purchase" ? "Comprando..." : premiumActive ? "Premium ativo" : "Assinar premium"}
            </button>
            <button className="secondary-button" type="button" disabled={!isNativeAndroidBillingAvailable() || busy !== null} onClick={handleRestore}>
              <RotateCcw aria-hidden="true" size={16} />
              {busy === "restore" ? "Restaurando..." : "Restaurar"}
            </button>
            <Link className="ghost-link" href="/lobby">
              Lobby
            </Link>
          </div>
        </div>

        {!isNativeAndroidBillingAvailable() ? (
          <p style={{ color: "rgba(226,232,240,0.76)" }}>
            Compra real só aparece no app Android instalado pela trilha de teste da Play Store.
          </p>
        ) : null}

        {message ? <p>{message}</p> : null}
        {error ? <p role="alert" style={{ color: "#fecaca" }}>{error}</p> : null}
      </div>
    </div>
  );
}
