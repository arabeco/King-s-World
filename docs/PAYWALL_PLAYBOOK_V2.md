# Paywall — Google Play Billing + Supabase (v2 Hardened)

> Playbook canônico para implementar compras nativas Android em qualquer app com Capacitor + Supabase.
> Baseado em código testado em produção. Use do zero em apps novos.

---

## Índice

1. [Travar IDs antes de codar](#1-travar-ids-antes-de-codar)
2. [Stack obrigatório](#2-stack-obrigatório)
3. [Capacitor — setup](#3-capacitor--setup)
4. [Plugin nativo Android (StoreBilling)](#4-plugin-nativo-android-storebilling)
5. [JS Bridge (TypeScript)](#5-js-bridge-typescript)
6. [Catálogo de billing](#6-catálogo-de-billing)
7. [BillingCheckoutGate — UI](#7-billingcheckoutgate--ui)
8. [SQL — tabelas e RPCs](#8-sql--tabelas-e-rpcs)
9. [Edge Function verify-google-play-purchase](#9-edge-function-verify-google-play-purchase)
10. [Secrets Supabase](#10-secrets-supabase)
11. [Google Auth via Supabase](#11-google-auth-via-supabase)
12. [Play Console — sequência de setup](#12-play-console--sequência-de-setup)
13. [Service Account Google Cloud](#13-service-account-google-cloud)
14. [Testes (smoke real)](#14-testes-smoke-real)
15. [Patterns defensivos](#15-patterns-defensivos)
16. [Auditoria SQL pré-launch](#16-auditoria-sql-pré-launch)
17. [Checklist replicável](#17-checklist-replicável)
18. [Gates de release](#18-gates-de-release)
19. [O que NÃO fazer](#19-o-que-não-fazer)

---

## 1. Travar IDs antes de codar

Não comece nada sem definir estas variáveis. Anote aqui antes de abrir o editor:

```
APP_NAME=
PACKAGE_NAME=              # formato com.empresa.app — único nas lojas
SUPABASE_PROJECT_REF=      # do dashboard Supabase
SUPABASE_URL=              # https://<REF>.supabase.co
GOOGLE_PLAY_PACKAGE_NAME=  # igual ao PACKAGE_NAME
```

### Tipos de produto — escolha antes de codar

| Tipo | Quando usar | Comportamento no app |
|------|-------------|----------------------|
| `INAPP consumable` | Packs de moeda virtual (ouro, fichas) | Cliente "consome" após crédito; pode comprar de novo |
| `INAPP entitlement` | Founder vitalício, passe permanente | Não consome; perdura para sempre |
| `SUBS subscription` | Mensalidade Pro | Renovação gerenciada pelo Google |

> **Regra:** se vai ter mensalidade gerenciada (período, renovação, cancelamento) → `SUBS`. Senão → `INAPP`.

### Naming convention (use sempre o mesmo padrão)

```
{appprefix}_{tipo}_{detalhe}
ex: myapp_gold_100
ex: myapp_pro_monthly
ex: myapp_founder_lifetime
```

---

## 2. Stack obrigatório

```
@capacitor/core@^7
@capacitor/android@^7
@capacitor/cli@^7          (dev)
+ Java 17 JDK (vem com Android Studio)
+ Android Studio (latest)
+ Plugin custom Java        (NÃO usar @capgo/native-purchases nem @revenuecat/*)
```

**Por que plugin custom em vez de abstração:**
- Controle granular de `:consume` (consumable) vs `:acknowledge` (entitlement/subscription)
- Cache de `ProductDetails` — preço local em tempo real
- Queue de `pendingConnectionActions` — retry automático se `BillingClient` cair
- Restore via `queryPurchasesAsync`

---

## 3. Capacitor — setup

**`capacitor.config.ts`:**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.empresa.app',
  appName: 'NomeDoApp',
  webDir: 'out',
};

export default config;
```

**Sequência de comandos:**

```bash
npm run build           # gera web bundle
npx cap add android     # cria pasta android/
npx cap sync android    # copia bundle + plugins
```

**`android/app/build.gradle` — adicionar dependência:**

```gradle
dependencies {
    implementation 'com.android.billingclient:billing:6.1.0'
}
```

---

## 4. Plugin nativo Android (StoreBilling)

**Localização:**
```
android/app/src/main/java/com/empresa/app/billing/StoreBillingPlugin.java
```

### 4.1 Métodos expostos (mínimo 4)

```java
@CapacitorPlugin(name = "StoreBilling")
public class StoreBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    @PluginMethod
    public void getStatus(PluginCall call) { ... }
    // retorna: { available, connected, canMakePayments, reason, responseCode }

    @PluginMethod
    public void getProduct(PluginCall call) { ... }
    // input:   { productId, kind: 'consumable'|'entitlement'|'subscription' }
    // retorna: { productId, title, description, formattedPrice, offerTokenAvailable }

    @PluginMethod
    public void purchaseProduct(PluginCall call) { ... }
    // input:   { productId, kind }
    // retorna: { purchaseState, orderId, purchaseToken, packageName, products[], needsServerReconciliation: true }

    @PluginMethod
    public void getActivePurchases(PluginCall call) { ... }
    // retorna: { purchases: [...] }  ← usado para restore
}
```

### 4.2 Patterns defensivos obrigatórios

| Pattern | Implementação |
|---------|--------------|
| `ensureConnection(onReady, onError)` | Todo método espera `BillingClient` conectar. Se desconectado, enfileira em `pendingConnectionActions`, reconecta, drena queue |
| `cachedProductDetails: Map<String, ProductDetails>` | Evita query repetida pro Google |
| `pendingPurchaseCall` | `purchaseProduct` é assíncrono — resposta vem via `onPurchasesUpdated`. Salva `PluginCall` para resolver/rejeitar no callback |
| Tipo dinâmico | Método aceita `kind` e usa `BillingClient.ProductType.INAPP` ou `SUBS`. **Não hardcode.** |
| `needsServerReconciliation: true` | Sempre retornar no payload — sinaliza ao cliente que validação server-side é obrigatória |

### 4.3 Registrar no MainActivity

```java
@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(StoreBillingPlugin.class);
    super.onCreate(savedInstanceState);
}
```

---

## 5. JS Bridge (TypeScript)

**`src/lib/nativeBilling.ts`:**

```typescript
import { Capacitor, registerPlugin } from '@capacitor/core';

export type BillingMonetizationKind = 'consumable' | 'entitlement' | 'subscription';

export interface NativeStoreBillingPurchaseResult {
    platform: 'android';
    purchaseState: 'pending' | 'purchased';
    orderId: string;
    purchaseToken: string;
    acknowledged: boolean;
    consumed: boolean;
    packageName: string;
    products: string[];
    needsServerReconciliation: boolean;
}

interface StoreBillingPlugin {
    getStatus(): Promise<NativeStoreBillingStatus>;
    getProduct(options: { productId: string; kind: BillingMonetizationKind }): Promise<NativeStoreBillingProduct>;
    purchaseProduct(options: { productId: string; kind: BillingMonetizationKind }): Promise<NativeStoreBillingPurchaseResult>;
    getActivePurchases(): Promise<{ purchases: NativeStoreBillingPurchaseResult[] }>;
}

const StoreBilling = registerPlugin<StoreBillingPlugin>('StoreBilling');

export const canUseNativeStoreBilling = (): boolean =>
    Capacitor.isNativePlatform?.() === true &&
    String(Capacitor.getPlatform?.() || '').toLowerCase() === 'android';

const normalizePluginError = (err: unknown): Error => {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    if (err && typeof err === 'object' && 'message' in err)
        return new Error(String((err as any).message));
    return new Error('Native billing indisponível');
};

export const purchaseNativeProduct = async (
    productId: string,
    kind: BillingMonetizationKind,
): Promise<NativeStoreBillingPurchaseResult> => {
    if (!canUseNativeStoreBilling()) throw new Error('Disponível apenas no app');
    try {
        return await StoreBilling.purchaseProduct({ productId, kind });
    } catch (err) {
        throw normalizePluginError(err);
    }
};
```

---

## 6. Catálogo de billing

**`src/constants/billingCatalog.ts`:**

```typescript
export type BillingMonetizationKind = 'consumable' | 'entitlement' | 'subscription';

export interface BillingProduct {
    code: string;
    googlePlayProductId: string;
    appStoreProductId: string;
    kind: BillingMonetizationKind;
    priceBrl: number;
    benefit: {
        kind: 'gold' | 'tier' | 'pass';
        amount?: number;
        tier?: string;
        durationDays?: number;
    };
}

export const BILLING_CATALOG: Record<string, BillingProduct> = {
    // --- CONSUMABLE (moeda virtual) ---
    pack_gold_100: {
        code: 'pack_gold_100',
        googlePlayProductId: 'myapp_gold_100',   // ← troque pelo productId real da Play Console
        appStoreProductId: 'com.empresa.app.gold.pack100',
        kind: 'consumable',
        priceBrl: 5,
        benefit: { kind: 'gold', amount: 100 },
    },

    // --- SUBSCRIPTION (mensalidade) ---
    pro_monthly: {
        code: 'pro_monthly',
        googlePlayProductId: 'myapp_pro_monthly', // ← troque
        appStoreProductId: 'com.empresa.app.subscription.pro',
        kind: 'subscription',
        priceBrl: 14.9,
        benefit: { kind: 'tier', tier: 'pro', durationDays: 30 },
    },

    // --- ENTITLEMENT (vitalício) ---
    founder_lifetime: {
        code: 'founder_lifetime',
        googlePlayProductId: 'myapp_founder_lifetime', // ← troque
        appStoreProductId: 'com.empresa.app.founder.lifetime',
        kind: 'entitlement',
        priceBrl: 89,
        benefit: { kind: 'tier', tier: 'founder' },
    },
};
```

> **Regra:** o catálogo client-side **nunca** é autoridade. A Edge Function tem o próprio e valida o match.

---

## 7. BillingCheckoutGate — UI

**`src/components/BillingCheckoutGate.tsx`** — decide o que renderizar:

- Se `!canUseNativeStoreBilling()` → mostra "Disponível apenas no app" + link para a loja
- Se `!logado` → mostra "Faça login para comprar"
- Senão → renderiza `children` (botões de compra reais)

### Fluxo do botão de compra

```typescript
const handlePurchase = async (productCode: string) => {
    const product = BILLING_CATALOG[productCode];
    setSubmitting(productCode);
    try {
        // 1. Compra nativa
        const result = await purchaseNativeProduct(
            product.googlePlayProductId,
            product.kind,
        );
        if (result.purchaseState !== 'purchased') {
            throw new Error('Compra não confirmada pelo Google');
        }

        // 2. Validação server-side OBRIGATÓRIA
        const verify = await callEdgeFunction('verify-google-play-purchase', {
            productCode: product.code,
            productId: result.products[0] ?? product.googlePlayProductId,
            purchaseToken: result.purchaseToken,
            orderId: result.orderId,
            packageName: result.packageName,
            platform: 'android',
            kind: product.kind,
        });
        if (!verify.success) throw new Error(verify.error ?? 'Validação server falhou');

        // 3. Refetch estado local
        await refreshSnapshot();
        toast.success('Compra confirmada');
    } catch (err) {
        if (err.message?.includes('cancel')) return;
        toast.error(err.message);
    } finally {
        setSubmitting(null);
    }
};
```

> **Regra de ouro:** nunca libere saldo/tier só porque o cliente disse que comprou. **Sempre** valide o token no servidor.

---

## 8. SQL — tabelas e RPCs

### 8.1 Tabela `mobile_purchases` (audit log)

```sql
create table if not exists public.mobile_purchases (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  product_code    text not null,
  product_id      text not null,
  purchase_token  text not null unique,      -- UNIQUE = idempotência
  order_id        text,
  package_name    text not null,
  platform        text not null check (platform in ('android','ios')),
  purchase_state  int,
  acknowledged    boolean default false,
  consumed        boolean default false,
  benefit_kind    text,
  benefit_amount  numeric,
  benefit_tier    text,
  metadata        jsonb default '{}'::jsonb, -- snapshot do estado Google
  created_at      timestamptz not null default now(),
  validated_at    timestamptz
);

create index mobile_purchases_user_idx  on public.mobile_purchases(user_id, created_at desc);
create index mobile_purchases_token_idx on public.mobile_purchases(purchase_token);

alter table public.mobile_purchases enable row level security;

-- Leitura própria apenas
create policy mobile_purchases_read_own on public.mobile_purchases
  for select using (auth.uid() = user_id);

-- Insert/update: apenas service role via Edge Function (sem policy de write)
```

### 8.2 RPC `grant_mobile_purchase` (security definer, idempotente)

```sql
create or replace function public.grant_mobile_purchase(
    p_user_id       uuid,
    p_product_code  text,
    p_product_id    text,
    p_purchase_token text,
    p_order_id      text,
    p_package_name  text,
    p_platform      text    default 'android',
    p_benefit_kind  text    default null,
    p_benefit_amount numeric default null,
    p_benefit_tier  text    default null,
    p_metadata      jsonb   default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
    v_existing public.mobile_purchases%rowtype;
    v_purchase_id bigint;
begin
    -- Validações básicas
    if p_user_id is null then raise exception 'USER_REQUIRED'; end if;
    if nullif(trim(p_purchase_token), '') is null then raise exception 'TOKEN_REQUIRED'; end if;
    if nullif(trim(p_product_code), '') is null then raise exception 'PRODUCT_CODE_REQUIRED'; end if;
    if nullif(trim(p_product_id), '') is null then raise exception 'PRODUCT_ID_REQUIRED'; end if;

    -- Idempotência via purchase_token UNIQUE + lock (previne race em retries)
    select * into v_existing
    from public.mobile_purchases
    where purchase_token = p_purchase_token
    for update;

    if found then
        if v_existing.user_id <> p_user_id then
            raise exception 'TOKEN_ALREADY_USED';
        end if;
        return jsonb_build_object(
            'success', true,
            'duplicate', true,
            'purchase_id', v_existing.id
        );
    end if;

    -- Audit log
    insert into public.mobile_purchases (
        user_id, product_code, product_id, purchase_token,
        order_id, package_name, platform,
        benefit_kind, benefit_amount, benefit_tier,
        metadata, validated_at
    ) values (
        p_user_id, p_product_code, p_product_id, p_purchase_token,
        p_order_id, p_package_name, p_platform,
        p_benefit_kind, p_benefit_amount, p_benefit_tier,
        p_metadata, now()
    )
    returning id into v_purchase_id;

    -- Aplica benefício
    case p_benefit_kind
        when 'gold' then
            update public.user_profiles
            set gold       = coalesce(gold, 0) + p_benefit_amount,
                updated_at = now()
            where id = p_user_id;

        when 'tier' then
            insert into public.subscriptions (
                user_id, tier, status, current_period_end, updated_at
            ) values (
                p_user_id,
                p_benefit_tier,
                'active',
                case
                    when p_metadata->>'duration_days' is not null
                    then now() + (p_metadata->>'duration_days')::int * interval '1 day'
                    else null
                end,
                now()
            )
            on conflict (user_id) do update
            set tier               = excluded.tier,
                status             = 'active',
                current_period_end = excluded.current_period_end,
                updated_at         = now();

        else null;
    end case;

    return jsonb_build_object(
        'success',        true,
        'duplicate',      false,
        'purchase_id',    v_purchase_id,
        'benefit_kind',   p_benefit_kind,
        'benefit_amount', p_benefit_amount,
        'benefit_tier',   p_benefit_tier
    );
end;
$$;

-- Segurança: apenas service_role chama
revoke all on function public.grant_mobile_purchase from public, authenticated, anon;
grant execute on function public.grant_mobile_purchase to service_role;
```

**Patterns defensivos do RPC:**
- `security definer` + `search_path` fixo → previne schema spoofing
- `for update` lock → previne race em retries concorrentes
- `revoke from public` → só service_role chama
- Idempotência por `purchase_token UNIQUE`
- Dispatcher de benefício centralizado no RPC

---

## 9. Edge Function verify-google-play-purchase

**`supabase/functions/verify-google-play-purchase/index.ts`**

### 9.1 Imports e env vars

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";

const SUPABASE_URL                    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_PLAY_PACKAGE_NAME        = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME")!;
const GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "";
// Alternativa OAuth (se não tiver service account JSON):
const GOOGLE_PLAY_OAUTH_CLIENT_ID     = Deno.env.get("GOOGLE_PLAY_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_PLAY_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_PLAY_OAUTH_CLIENT_SECRET") ?? "";
const GOOGLE_PLAY_REFRESH_TOKEN       = Deno.env.get("GOOGLE_PLAY_REFRESH_TOKEN") ?? "";

const ANDROIDPUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Cache de access token (1h)
let cachedGoogleAccessToken: { token: string; expiresAt: number } | null = null;

const ALLOWED_ORIGINS = [
    `${SUPABASE_URL}`,
    "https://seuapp.com",          // ← troque pelo domínio real
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
];

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### 9.2 Catálogo espelhado server-side

```typescript
// IMPORTANTE: este catálogo é a autoridade — cliente nunca é.
// Mantenha sincronizado com billingCatalog.ts

type ProductCatalog = {
    productId: string;
    kind: 'consumable' | 'entitlement' | 'subscription';
    benefit: { kind: string; amount?: number; tier?: string; durationDays?: number };
};

const CATALOG: Record<string, ProductCatalog> = {
    pack_gold_100:    { productId: 'myapp_gold_100',          kind: 'consumable',    benefit: { kind: 'gold',  amount: 100 } },
    pro_monthly:      { productId: 'myapp_pro_monthly',       kind: 'subscription',  benefit: { kind: 'tier',  tier: 'pro', durationDays: 30 } },
    founder_lifetime: { productId: 'myapp_founder_lifetime',  kind: 'entitlement',   benefit: { kind: 'tier',  tier: 'founder' } },
};
```

### 9.3 Access token com cache (economiza latência e quota)

```typescript
const getGooglePlayAccessToken = async (): Promise<string> => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (cachedGoogleAccessToken && cachedGoogleAccessToken.expiresAt > nowSeconds + 60) {
        return cachedGoogleAccessToken.token;
    }

    let tokenResponse: Response;

    if (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
        // Path 1: Service Account JSON (preferido)
        const parsed = JSON.parse(GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
        const privateKey = await importPKCS8(parsed.private_key.replace(/\\n/g, "\n"), "RS256");
        const assertion = await new SignJWT({ scope: ANDROIDPUBLISHER_SCOPE })
            .setProtectedHeader({ alg: "RS256", typ: "JWT" })
            .setIssuer(parsed.client_email)
            .setSubject(parsed.client_email)
            .setAudience(GOOGLE_OAUTH_TOKEN_URL)
            .setIssuedAt(nowSeconds)
            .setExpirationTime(nowSeconds + 3600)
            .sign(privateKey);
        tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion,
            }),
        });
    } else if (GOOGLE_PLAY_OAUTH_CLIENT_ID && GOOGLE_PLAY_REFRESH_TOKEN) {
        // Path 2: OAuth refresh token (fallback)
        tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                client_id: GOOGLE_PLAY_OAUTH_CLIENT_ID,
                client_secret: GOOGLE_PLAY_OAUTH_CLIENT_SECRET,
                refresh_token: GOOGLE_PLAY_REFRESH_TOKEN,
            }),
        });
    } else {
        throw new Error("GOOGLE_PLAY_AUTH_NOT_CONFIGURED");
    }

    if (!tokenResponse.ok) throw new Error(`GOOGLE_PLAY_AUTH_FAILED:${tokenResponse.status}`);
    const payload = await tokenResponse.json();
    cachedGoogleAccessToken = {
        token: payload.access_token,
        expiresAt: nowSeconds + (payload.expires_in ?? 3600),
    };
    return payload.access_token;
};
```

### 9.4 URLs da Google API (separados por tipo — crítico)

```typescript
// Consumable + Entitlement → products endpoint
const productUrl = (packageName: string, productId: string, token: string, suffix = "") =>
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}${suffix}`;

// Subscription → subscriptionsv2 endpoint (diferente!)
const subscriptionV2Url = (packageName: string, token: string) =>
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
```

### 9.5 Handlers por tipo (lógica resumida)

**Consumable / Entitlement:**
1. `GET productUrl(...)` → valida `purchaseState === 0`
2. Chama RPC `grant_mobile_purchase`
3. `try/catch POST productUrl(..., ':consume')` (consumable) ou `':acknowledge'` (entitlement)
4. ⚠️ Falha em `:consume`/`:acknowledge` **não** derruba o crédito já feito

**Subscription:**
1. `GET subscriptionV2Url(...)` → valida `subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE'`
2. Verifica que `lineItems[].productId` bate com o catálogo
3. Chama RPC `grant_mobile_purchase` com `durationDays`
4. `try/catch POST subscriptionV2Url + ':acknowledge'`

### 9.6 Handler principal

```typescript
serve(async (req) => {
    const origin = req.headers.get('origin') || '';
    const corsHeaders = makeCorsHeaders(origin);       // ALLOWED_ORIGINS check aqui

    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);

    try {
        // 1. Auth
        const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
        if (!token) throw new Error('AUTH_REQUIRED');
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) throw new Error('AUTH_INVALID');
        const userId = userData.user.id;

        // 2. Parse e validações
        const body = await req.json();
        const catalog = CATALOG[body.productCode];
        if (!catalog) throw new Error('UNKNOWN_PRODUCT_CODE');
        if (body.productId !== catalog.productId) throw new Error('PRODUCT_ID_MISMATCH');
        if (body.packageName !== GOOGLE_PLAY_PACKAGE_NAME) throw new Error('PACKAGE_MISMATCH');

        // 3. Google access token
        const accessToken = await getGooglePlayAccessToken();

        // 4. Handler por tipo
        let result;
        if (catalog.kind === 'subscription') {
            result = await handleSubscription(body, userId, accessToken, catalog);
        } else {
            result = await handleConsumableOrEntitlement(body, userId, accessToken, catalog);
        }

        return jsonResponse(result, 200, corsHeaders);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[verify-google-play-purchase]', msg);
        return jsonResponse({ success: false, error: msg }, 400, corsHeaders);
    }
});
```

### 9.7 Deploy

```bash
npx supabase functions deploy verify-google-play-purchase --project-ref SEU_PROJECT_REF
```

---

## 10. Secrets Supabase

```bash
npx supabase secrets set GOOGLE_PLAY_PACKAGE_NAME="com.empresa.app" --project-ref REF
npx supabase secrets set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(cat service-account.json)" --project-ref REF
```

> ⚠️ **Nunca** cole o JSON da service account em chat ou terminal compartilhado. Use `--from-file` ou cole direto no dashboard Supabase.

---

## 11. Google Auth via Supabase

**No app:**

```typescript
await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/home` },
});
```

**Google Cloud Console:**
1. Criar OAuth Client (Web application)
2. Authorized redirect URI: `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

**Supabase Dashboard:**
- Authentication → Providers → Google → enable + Client ID + Secret

---

## 12. Play Console — sequência de setup

1. Criar app: nome, package, tipo (Game/App), Free com IAP
2. Subir AAB em **Internal testing** (não vai para produção ainda)
3. Monetize → Products → **In-app products** → criar com os `productIds` exatos do catálogo
4. Para subscriptions → criar **Subscription** separado com Base plan (período, preço, trial opcional)
5. Settings → **License testing** → adicionar emails dos testers

---

## 13. Service Account Google Cloud

1. Cloud Console → APIs & Services → Enable: **Google Play Android Developer API**
2. IAM → Service Accounts → Create
3. Generate JSON key → baixar → tratar como senha
4. Play Console → Setup → API access → Link service account
5. Permissões: **View financial data** + **Manage orders and subscriptions**

---

## 14. Testes (smoke real)

Após uma compra de teste, validar no banco:

```sql
-- Audit pós-compra
select * from public.mobile_purchases
where user_id = '<test_user_id>'
order by created_at desc
limit 10;

-- Benefício aplicado
select user_id, tier, status, current_period_end
from public.subscriptions
where user_id = '<test_user_id>';

-- Ou gold:
select id, gold from public.user_profiles
where id = '<test_user_id>';
```

---

## 15. Patterns defensivos

| Pattern | Por quê |
|---------|---------|
| Cache access token Google por 1h | Evita 200-400ms de latência por compra + reduz risco de quota |
| `subscriptionsv2` pra subscription | Subscription tem `subscriptionState`, não `purchaseState` |
| Validação tripla no servidor (productCode, productId, packageName) | Defesa em profundidade |
| `for update` lock no token check | Previne race condition em retries simultâneos |
| `try/catch` no `:consume`/`:acknowledge` | Falha aqui **não** pode reverter crédito já feito |
| `ALLOWED_ORIGINS` específico | CORS rigoroso bloqueia chamadas de origens não-app |
| 2 paths de auth (Service Account ou OAuth refresh) | Resiliência |
| `revoke from public/authenticated/anon` no RPC | Apenas service_role chama |
| `metadata jsonb` na `mobile_purchases` | Snapshot do estado Google no momento da compra |
| `ProductDetails` cache no plugin nativo | Evita re-query do Google |
| `pendingConnectionActions` queue | Reconexão automática se BillingClient cair |
| `needsServerReconciliation: true` no return | Sinaliza ao cliente que validação server-side é obrigatória |

---

## 16. Auditoria SQL pré-launch

```sql
-- 1. Tabelas existem?
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('mobile_purchases', 'subscriptions', 'user_profiles');

-- 2. Constraint UNIQUE no purchase_token?
select indexname from pg_indexes
where schemaname = 'public'
  and tablename = 'mobile_purchases'
  and indexname like '%token%';

-- 3. RPC existe?
select proname, pronargs from pg_proc
where proname = 'grant_mobile_purchase'
  and pronamespace = 'public'::regnamespace;

-- 4. Permissões corretas?
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_name = 'grant_mobile_purchase';
-- Esperado: apenas service_role com EXECUTE

-- 5. RLS habilitado?
select relname, relrowsecurity from pg_class
where relname in ('mobile_purchases', 'subscriptions')
  and relnamespace = 'public'::regnamespace;
```

---

## 17. Checklist replicável

Preencha para cada app novo:

```
[ ] APP_NAME =
[ ] PACKAGE_NAME =
[ ] SUPABASE_PROJECT_REF =
[ ] SUPABASE_URL =

CÓDIGO
[ ] capacitor.config.ts configurado
[ ] android/ criado (npx cap add android)
[ ] Plugin StoreBilling Java implementado
[ ] MainActivity registra o plugin
[ ] nativeBilling.ts criado
[ ] BILLING_CATALOG criado e sincronizado
[ ] BillingCheckoutGate criado
[ ] Tela de compra usa BillingCheckoutGate

BANCO
[ ] Tabela mobile_purchases criada
[ ] RPC grant_mobile_purchase criada
[ ] Permissões: revoke public, grant service_role
[ ] RLS habilitado em mobile_purchases

EDGE FUNCTION
[ ] verify-google-play-purchase criada
[ ] Catálogo server-side sincronizado com billingCatalog.ts
[ ] ALLOWED_ORIGINS atualizado com domínio real
[ ] Edge Function deployada

SECRETS
[ ] GOOGLE_PLAY_PACKAGE_NAME setado
[ ] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON setado

GOOGLE AUTH
[ ] OAuth Client criado no Google Cloud
[ ] Redirect URI configurado no Cloud Console
[ ] Google provider habilitado no Supabase

PLAY CONSOLE
[ ] App criado (nome, package, tipo)
[ ] AAB assinada gerada (npx cap sync + Android Studio)
[ ] AAB subida em Internal testing
[ ] Produtos criados com os productIds exatos do catálogo
[ ] Service Account criada e linkada com permissões corretas
[ ] License testers adicionados (emails de teste)

VALIDAÇÃO FINAL
[ ] Compra real testada ponta-a-ponta
[ ] Audit SQL pós-compra confirma benefit aplicado
[ ] mobile_purchases.purchase_token UNIQUE confirmada
[ ] Restore via getActivePurchases testado
```

---

## 18. Gates de release

| Gate | Critério |
|------|---------|
| **Gate 8 — Código** | Capacitor + Plugin Java + Bridge TS + Catálogo + Edge Function + RPC + SQL + secrets |
| **Gate 9 — Loja** | Play Console: app criado, AAB em Internal, produtos cadastrados, service account linkada, license testers, Google Auth |
| **Gate 10 — Validação real** | 1 compra real ponta-a-ponta validada + audit SQL confirma + restore via `getActivePurchases` testado |

---

## 19. O que NÃO fazer

| ❌ | Por quê |
|----|---------|
| Usar `@capgo/native-purchases` ou `@revenuecat/*` | Perde controle granular de consume/acknowledge |
| Dispensar a Edge Function | Cliente nunca é autoridade de validação |
| Escrever tier/gold direto do cliente no Supabase | Mesmo com RLS, é falsificável |
| Chamar Google API sem cache de access token | Quota e latência ruins |
| Usar o mesmo endpoint pra consumable e subscription | São endpoints diferentes na API do Google |
| `throw` no `:consume`/`:acknowledge` | Crédito já foi feito — falha aqui é não-fatal |
| Colar service account JSON em chat ou bash | Vaza no histórico |

---

## Histórico

| Versão | Data | Mudanças |
|--------|------|---------|
| v2 hardened | 2026-05-24 | Cache de access token, endpoint subscription separado, validação tripla no RPC, try/catch no consume/acknowledge, ALLOWED_ORIGINS específico, 2 paths de auth |
| v1 | 2026-04 | Versão inicial — conceitualmente correta, faltavam defesas operacionais |
