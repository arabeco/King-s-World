"use client";

import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from "@capgo/native-purchases";

import { GEM_SALES_ENABLED, PLAY_PREMIUM_BASE_PLAN_ID, PLAY_PREMIUM_PRODUCT_ID } from "@/lib/premium-config";
import {PLAY_GEM_PRODUCTS} from '@/supabase/functions/_shared/play-gems';
import {playAccountId} from "@/supabase/functions/_shared/play-subscription";
import {getSupabaseBrowserClient} from "@/lib/supabase-browser";

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
  const {data,error}=await getSupabaseBrowserClient().auth.getUser();
  if(error||!data.user)throw new Error("Entre na sua conta antes de comprar.");
  return NativePurchases.purchaseProduct({
    productIdentifier: PLAY_PREMIUM_PRODUCT_ID,
    planIdentifier: PLAY_PREMIUM_BASE_PLAN_ID,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
    autoAcknowledgePurchases: false,
    appAccountToken:await playAccountId(data.user.id),
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

export async function loadGemProductOffers():Promise<PremiumProductOffer[]> {
  if(!(await ensureBillingSupported()))return [];
  const {products}=await NativePurchases.getProducts({productIdentifiers:Object.keys(PLAY_GEM_PRODUCTS),productType:PURCHASE_TYPE.INAPP});
  return products.filter(p=>Object.hasOwn(PLAY_GEM_PRODUCTS,p.identifier)).map(p=>({id:p.identifier,title:p.title,description:p.description,priceString:p.priceString,currencyCode:p.currencyCode,productIdentifier:p.identifier}));
}

export async function purchaseGemPack(productId:string):Promise<Transaction> {
  if(!GEM_SALES_ENABLED)throw Error('A compra de Gemas ainda está em preparação.');
  if(!Object.hasOwn(PLAY_GEM_PRODUCTS,productId))throw Error('Pacote de Gemas inválido.');
  if(!(await ensureBillingSupported()))throw Error('Esta compra está disponível no app Android.');
  const {data,error}=await getSupabaseBrowserClient().auth.getUser();
  if(error||!data.user)throw Error('Entre na sua conta antes de comprar.');
  return NativePurchases.purchaseProduct({productIdentifier:productId,productType:PURCHASE_TYPE.INAPP,quantity:1,
    autoAcknowledgePurchases:false,isConsumable:false,appAccountToken:await playAccountId(data.user.id)});
}

// Only outstanding, unconsumed checkouts remain queryable. Durable server receipts
// are the authority for consumed purchases; never mint from a client history.
export async function pendingGemTransactions():Promise<Transaction[]> {
  if(!(await ensureBillingSupported()))return [];
  const {purchases}=await NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP});
  return purchases.filter(p=>Object.hasOwn(PLAY_GEM_PRODUCTS,p.productIdentifier));
}
