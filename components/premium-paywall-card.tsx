"use client";

import { Crown, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import styles from "./profile/cosmetics.module.css";
import { PREMIUM_SALES_ENABLED } from "@/lib/premium-config";
import { useEffect, useState } from "react";

import type { PublicPremiumEntitlement } from "@/lib/entitlements";
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
    entitlement?: PublicPremiumEntitlement | null;
  };
};

export function PremiumPaywallCard() {
  const [offer, setOffer] = useState<PremiumProductOffer | null>(null);
  const [premiumActive, setPremiumActive] = useState(false);
  const [entitlement, setEntitlement] = useState<PublicPremiumEntitlement | null>(null);
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
    if(payload.premiumActive!==true)throw new Error("Esta assinatura não está ativa. Confira sua assinatura na Google Play.");

    setPremiumActive(Boolean(payload.premiumActive));
    setEntitlement(
      payload.entitlementId
        ? { id: payload.entitlementId, status: payload.status, expires_at: payload.expiresAt ?? null } as any
        : null,
    );
  }

  async function handlePurchase() {
    if (!PREMIUM_SALES_ENABLED || !offer || loadingOffer || busy || premiumActive) return;
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
      await refreshEntitlement();
      setMessage("Compra verificada. Status atualizado.");
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

      await refreshEntitlement();
      setMessage("Restauração verificada. Status atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao restaurar compras.");
    } finally {
      setBusy(null);
    }
  }

  return <section id="premium-plan" className={styles.premium}>
    <header className={styles.heading}><Link href="/profile" aria-label="Voltar ao perfil">‹</Link><h1>Coroa Premium</h1><Crown aria-hidden="true"/></header>
    <img className={styles.crest} src="/icons/premium.png" alt=""/>
    <p className={styles.subtitle}>Sua identidade em todos os reinos</p>
    <div className={styles.status} role="status"><ShieldCheck size={18}/>{loadingOffer?"Consultando assinatura…":premiumActive?"Premium ativo":"Coleção em preparação"}</div>
    
    <div className={styles.features}>
      <div><Crown/><span>Até cinco mundos ativos<small>Conta gratuita: um mundo ativo</small></span></div>
      <div><Sparkles/><span>Sem propaganda<small>Mundos com senha e visual exclusivo</small></span></div>
    </div>
    <details className={styles.info}><summary>Como vai funcionar</summary><p>Premium reúne cinco mundos simultâneos, remoção de anúncios, criação de mundos com senha e acesso ao visual exclusivo.</p><p>A assinatura será disponibilizada quando os benefícios e a validação Android estiverem concluídos. Gemas e reis comprados pertencem à coleção da conta.</p></details>
    {entitlement?.expires_at&&<p className={styles.subtitle}>{Math.max(0,Math.ceil((Date.parse(entitlement.expires_at)-Date.now())/86_400_000))} dias restantes · até {new Date(entitlement.expires_at).toLocaleDateString("pt-BR")}{entitlement.status==='canceled'?' · renovação cancelada':''}</p>}
    <button className="primary-button" type="button" disabled={!PREMIUM_SALES_ENABLED || !offer || loadingOffer || !isNativeAndroidBillingAvailable() || busy!==null || premiumActive} onClick={handlePurchase}>{busy==="purchase"?"Verificando…":premiumActive?"Premium ativo":PREMIUM_SALES_ENABLED?`Assinar · ${offer?.priceString??"Indisponível"}`:"Em preparação"}</button>
    <button className={styles.restore} type="button" disabled={!isNativeAndroidBillingAvailable() || loadingOffer || busy!==null} onClick={handleRestore}><RotateCcw size={16}/>{busy==="restore"?"Restaurando…":"Restaurar assinatura"}</button>
    {!isNativeAndroidBillingAvailable()&&<small className={styles.subtitle}>Restauração disponível no app Android.</small>}
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
