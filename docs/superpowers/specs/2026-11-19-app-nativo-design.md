# App com as telas dentro do APK (estilo Elite 2050 / Glyph)

Data: 19/11/2026 · Pedido do dono: "faça ficar igual Elite e Glyph", sem jogo falso.

## Por quê

O app abria o site da Vercel dentro de uma WebView. Cada abertura baixava as telas, e cada clique esperava o servidor: Brasil → Vercel (Virginia, iad1) → Supabase (Oregon, us-west-2), umas 10 vezes por ação, com o botão travado enquanto isso. O Elite e o Glyph levam as telas dentro do APK e mudam a tela na hora do toque.

## O que mudou

1. **Telas dentro do APK** (`native-app/`, Vite). São as mesmas telas do site (`components/`, `app/login` e afins), com pequenos substitutos para `next/link`, `next/image`, `next/navigation` e o cliente Supabase (`native-app/shims/`). O Capacitor usa `webDir: native-app/dist` e não usa mais `server.url`. As artes são reduzidas ao tamanho em que aparecem (105 MB → 18 MB).
2. **Login por token.** No app, a sessão Supabase fica no armazenamento da WebView. Toda chamada `fetch("/api/...")` vai para `KW_APP_API_URL` com `Authorization: Bearer <token>` (`native-app/api-bridge.ts`). O servidor aceita o token em `getAuthenticatedUser` (`lib/supabase-server.ts`), o middleware libera CORS para `https://localhost` e `capacitor://localhost`, e a checagem de origem das ações passou para `lib/request-origin.ts` (pedido com token não tem risco de site cruzado).
3. **Clique instantâneo.** `components/cozy/useCozyWorld.ts` roda as mesmas regras do servidor (`lib/cozy/predict.ts` → `applyCozyAction`) sobre o último estado confirmado. A tela muda na hora e o servidor confirma por trás, em fila, na ordem dos toques. Se o servidor recusar, a ação (e as seguintes) é desfeita e aparece o aviso. Ações que dependem de dados que o celular não tem (escolha do rei, aliança, presentes, pactos, Ascensão, início do mundo) continuam esperando o servidor.
4. **Telas guardadas.** O lobby e o perfil mostram os últimos dados na hora e atualizam em seguida.
5. **Servidor perto do banco.** `vercel.json` com `regions: ["pdx1"]` (Oregon, junto do Supabase).
6. **Modos.** Só Clássico (120 dias) e Expresso (30 dias), Cozy. O PvP fica escondido (`NEXT_PUBLIC_KW_SHOW_PVP=1` / `KW_ENABLE_PVP=1`), e o mundo persistente também (`KW_COZY_PERSISTENT_PREVIEW=1`). Os testes que precisam deles ligam as chaves (ex.: `test-cozy-integration` liga `KW_ENABLE_PVP`).

## Como usar

- Desenvolver o app: `npm run app:dev` (aponte `KW_APP_API_URL` para a API; `KW_APP_DEV_AUTH=1` entra como usuário de teste no modo dev).
- Gerar: `npm run android:sync` (build do app + `cap sync`), depois `bundleRelease` com o JBR do Android Studio.
- Portão de release: `scripts/check-android-release.mjs` exige telas empacotadas, API HTTPS e o servidor já aceitando o app (CORS para `https://localhost`).
- Teste de ponta a ponta: `npm run test:app-shell`.

## Ordem para publicar

1. Publicar a API (Vercel) com estas mudanças: sem isso, o app instalado não consegue falar com o servidor.
2. Só depois subir o AAB (versionCode 18, 1.1.0).

## Fora deste passo

- Mover o banco para São Paulo (latência menor para jogadores no Brasil).
- Cortar as idas sequenciais ao banco em cada ação no servidor.
- Legado (arquivo de reinados) no app: só existe para mundos persistentes, que estão escondidos.
