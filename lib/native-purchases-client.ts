"use client";

import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from "@capgo/native-purchases";

import { PLAY_PREMIUM_BASE_PLAN_ID, PLAY_PREMIUM_PRODUCT_ID } from "@/lib/premium-config";

export type PremiumProductOffer = {
  id: string;
  title: string;
  description: string;
  priceString: string;
  currencyCode: string;
  productIdentifier: string;
  planIdentifier?: string;
};

export function isNativeAndroidBillingAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function ensureBillingSupported(): Promise<boolean> {
  if (!isNativeAndroidBillingAvailable()) {
    return false;
  }

  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  return isBillingSupported;
}

function mapPremiumProduct(product: Product): PremiumProductOffer {
  return {
    id: product.identifier,
    title: product.title,
    description: product.description,
    priceString: product.priceString,
    currencyCode: product.currencyCode,
    productIdentifier: product.planIdentifier ?? PLAY_PREMIUM_PRODUCT_ID,
    planIdentifier: product.identifier,
  };
}

export async function loadPremiumProductOffer(): Promise<PremiumProductOffer | null> {
  if (!(await ensureBillingSupported())) {
    return null;
  }

  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [PLAY_PREMIUM_PRODUCT_ID],
    productType: PURCHASE_TYPE.SUBS,
  });

  const preferred =
    products.find((product) => product.planIdentifier === PLAY_PREMIUM_PRODUCT_ID && product.identifier === PLAY_PREMIUM_BASE_PLAN_ID) ??
    products.find((product) => product.planIdentifier === PLAY_PREMIUM_PRODUCT_ID) ??
    products[0];

  return preferred ? mapPremiumProduct(preferred) : null;
}

export async function purchasePremiumProduct(): Promise<Transaction> {
  return NativePurchases.purchaseProduct({
    productIdentifier: PLAY_PREMIUM_PRODUCT_ID,
    planIdentifier: PLAY_PREMIUM_BASE_PLAN_ID,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
    autoAcknowledgePurchases: false,
  });
}

export async function restorePremiumTransactions(): Promise<Transaction[]> {
  await NativePurchases.restorePurchases();
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    onlyCurrentEntitlements: true,
  });

  return purchases.filter((purchase) => purchase.productIdentifier === PLAY_PREMIUM_PRODUCT_ID);
}

export async function acknowledgePremiumTransaction(transaction: Transaction): Promise<void> {
  if (!transaction.purchaseToken) {
    return;
  }

  await NativePurchases.acknowledgePurchase({
    purchaseToken: transaction.purchaseToken,
  });
}
