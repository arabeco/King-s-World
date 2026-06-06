# Login Google nativo no app Android (KingsWorld) — Design

> **Data**: 2026-06-06
> **Contexto**: o APK do KingsWorld é um shell Capacitor que carrega o jogo
> remotamente de `https://king-s-world-three.vercel.app`. O login do Google é o
> método principal (quase todos os usuários usam Google). Dentro da WebView do
> Capacitor, o Google **bloqueia** o consentimento OAuth (`disallowed_useragent`),
> então o botão "Continuar com Google" não funciona no app sem tratamento nativo.

## Diferença pros outros 3 apps (Elite50/Glyph/MindPractice)

Os outros apps empacotam a web no APK e usam `@supabase/supabase-js` (`createClient`).
O KingsWorld é diferente: usa `@supabase/ssr` (que **já força `flowType: 'pkce'`**,
verificado em `node_modules/@supabase/ssr/src/createBrowserClient.ts:139`) e carrega
a web remotamente. Portanto **o bug PKCE do doc dos outros apps não existe aqui** —
o problema real é o bloqueio de WebView do Google. O fix abaixo é específico do KingsWorld.

## Objetivo

No app Android, "Continuar com Google" abre o Google no navegador do sistema
(Custom Tab), o usuário loga/cria conta, e volta pro app já autenticado. No web
(navegador normal) nada muda.

## Arquitetura

Detecção de plataforma decide o caminho. A lógica nativa fica isolada em um módulo
e um componente bridge; o resto do app não muda.

### Componentes

1. **`lib/native-auth.ts`** (novo) — lógica nativa isolada:
   - `isNativeApp()` → `Capacitor.isNativePlatform()` (try/catch → false no SSR/web)
   - `NATIVE_AUTH_SCHEME = "com.kingsworld.app"`, `NATIVE_AUTH_REDIRECT = "<scheme>://auth/callback"`
   - `isNativeAuthCallbackUrl(url)` → bate o prefixo do deep link
   - `parseAuthCallback(url)` → extrai `code` (`?code=`, PKCE esperado), `accessToken`/`refreshToken`
     (`#access_token=`, fallback implicit), `error`, `errorDescription`, `next`
   - `startNativeGoogleSignIn(supabase, nextPath)` → `signInWithOAuth({ provider:'google',
     options:{ redirectTo:'<scheme>://auth/callback?next=…', skipBrowserRedirect:true } })`
     e abre `data.url` no Custom Tab (`Browser.open`, import dinâmico)

2. **`components/native-auth-bridge.tsx`** (novo, client) — montado no `layout.tsx` raiz.
   No `useEffect`, só no nativo, registra **uma vez** `App.addListener('appUrlOpen')`:
   fecha o Custom Tab, processa `code` via `exchangeCodeForSession` (ou `setSession` com
   tokens implicit), navega pro `next`/`/lobby` e `router.refresh()`. Imports de
   `@capacitor/app`/`@capacitor/browser` são dinâmicos (web não carrega).

3. **`app/login/page.tsx`** — `handleSocialLogin`: se `provider==='google' && isNativeApp()`
   → `startNativeGoogleSignIn`; senão fluxo web atual (`${origin}/auth/callback`), intacto.

4. **`app/layout.tsx`** — monta `<NativeAuthBridge />`.

### Camada nativa (vai no AAB)
- `package.json`: + `@capacitor/app`, `@capacitor/browser` (Capacitor 8)
- `AndroidManifest.xml`: intent-filter no MainActivity (`singleTask`) com
  `VIEW` + `BROWSABLE` + `<data android:scheme="com.kingsworld.app"/>`
- `cap sync` instala os plugins no projeto Android

## Fluxo de dados (nativo)

1. Usuário toca "Continuar com Google" → `startNativeGoogleSignIn`
2. `signInWithOAuth(skipBrowserRedirect)` gera o `code_verifier` (PKCE) e guarda no
   storage do client SSR na WebView; retorna a URL do Google
3. Custom Tab abre a URL → usuário loga → Google → Supabase → redirect pro deep link
   `com.kingsworld.app://auth/callback?code=…&next=…`
4. Android (scheme + singleTask) entrega ao MainActivity → Capacitor dispara `appUrlOpen`
5. Bridge fecha o Custom Tab, `exchangeCodeForSession(code)` na **mesma WebView**
   (o `code_verifier` está disponível) → sessão grava cookies no domínio do Vercel
6. `router.replace(next)` + `refresh` → middleware lê os cookies → usuário autenticado

## Tratamento de erro (defensivo)
- `startNativeGoogleSignIn` em try/catch → mensagem "não foi possível abrir o Google,
  tente email/senha" em vez de travar mudo
- `parseAuthCallback` cobre PKCE **e** implicit (cinto e suspensório)
- `error=` no callback → volta pra `/login?error=…`
- Plugin ausente / Custom Tab falha → capturado, sem crash

## Dois deploys (andam juntos)
- **Vercel** (git push → auto-deploy): `lib/native-auth.ts`, `components/native-auth-bridge.tsx`,
  `app/login/page.tsx`, `app/layout.tsx`, `package.json`
- **AAB** (build local): plugins via `cap sync` + `AndroidManifest.xml` + versionCode
- Subir só o AAB sem deploy do Vercel = Google continua quebrado.

## Pré-requisitos de painel (já feitos)
- Supabase → Redirect URLs: `com.kingsworld.app://auth/callback` ✓ (confirmado no print)
- Supabase → Redirect URLs: `https://king-s-world-three.vercel.app/**` ✓
- Google Cloud OAuth → `https://<project>.supabase.co/auth/v1/callback` ✓ (já necessário pro web)

## Fora de escopo
- Apple (botão "em breve", iOS não empacotado)
- Replicar nos outros 3 apps (arquitetura deles é diferente; doc próprio)

## Verificação
- `npm run typecheck` limpo
- `npm run build` (next) sem erro
- `cap sync android` instala 3 plugins (purchases + app + browser)
- AAB assinado gerado
- Manual no device: Google → volta logado; reabre → continua logado; signOut → volta pro login
