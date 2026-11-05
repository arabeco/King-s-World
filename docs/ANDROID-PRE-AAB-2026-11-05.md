# Preparação Android — 05/11/2026

## Entregue

- Teste de quatro atacantes simultâneos em três ordens de leitura: cidade tem um só dono; captura/saque/baixas e retorno ocorrem uma vez, inclusive quando os outros ataques encontram um novo dono. Sem ajuste adicional de poder, escudo ou regras.
- Auditoria somente leitura no King's World: 16 comparações de corpos/permissões SQL e catálogo/PostgREST passaram. Definições até a 74 correspondem ao checkout; nenhuma migração precisou reaplicação. Diferenças CRLF/LF foram identificadas sem regravar funções. A fixture espelha os grants padrão do Supabase a service_role.
- O jogo Android continua conectado ao servidor HTTPS. O pacote local agora contém apenas `native-shell` e sua tela de reconexão. O AAB antigo incluía 195 arquivos web/71.049.250 bytes não comprimidos; o novo APK de debug tem três arquivos web/2.168 bytes. Não comparar diretamente o tamanho de um APK debug com um AAB release nem prometer jogo completo offline.
- A falha de conexão usa `server.errorPath`, com botão de nova tentativa. Browser isolado passou em 320/390/430 px, incluindo esquema de URL inválido.
- Encerramento do renderizador da WebView remove/destrói a instância e abre uma tela Android nativa. Não reinicia automaticamente. Toque cria nova atividade; encerramento do processo inteiro pelo sistema continua sujeito à restauração normal do app.
- Em 2 GB, foi observado LOW_MEMORY real no renderizador. Depois da correção, a tela nativa permaneceu no mesmo processo, aceitou toque e reabriu MainActivity. Isso comprova recuperação deste encerramento; não aprova desempenho do jogo em 2 GB. A bateria de reconexão/CDP completa em 2 GB ainda encontrou novos encerramentos do renderizador.
- Build APK debug e testes Gradle passaram. Build web otimizado e TypeScript passaram. Endpoint público `/api/release` expõe somente aplicação/identidade de código; verificação local otimizada confirmou a igualdade com o checkout e ausência de dados de ambiente/conta.

## Antes do AAB de teste

O servidor configurado ainda responde 404 em `/api/release`. Não comprova que ele tem o checkout atual. A preparação `npm run android:bundle` verifica essa identidade antes de chamar Gradle e deixa o relatório em `reports/cozy/android-release-gate.json`.

É necessário publicar o código web validado, conferir a identidade e então atualizar versão/gerar/verificar o AAB. Nenhum deploy web/Edge, AAB novo ou envio à Play foi executado nesta rodada. Produtos e lacunas de compras estão em [PRODUTOS-PLAY-MVP.md](PRODUTOS-PLAY-MVP.md).

## Evidências e reprodução

- `npm run test:pvp`; `reports/cozy/ready-pvp-tests.txt` e `multi-player-combat-tests.txt`.
- `simulations/verify-current-remote-audit.mjs` compara os snapshots somente leitura com PostgreSQL/PGlite; `current-remote-readiness.json` e `remote-collection-rest.json`.
- `npm run test:android-shell`; `native-shell-release-tests.txt` e `native-connection-390.png`.
- `native-shell-debug-build.txt`, `native-recovery-build.txt`, `ready-web-build.txt`, `ready-typecheck.txt`.
- `native-connection-exit-info.txt`: processo renderizador LOW_MEMORY antes da correção; `native-memory-recovery-2gb.json/.png`: atividade de recuperação e toque no mesmo processo depois da correção.
- `simulations/test-native-connection-android.cjs`: exclusivo do AVD `KingsWorld_Cozy_QA` na porta 5556. Usa APK debug, altera/restaura a rede só do emulador e não executa ações num mundo remoto.
- O tratamento segue o contrato de [onRenderProcessGone, Android Developers](https://developer.android.com/reference/android/webkit/WebViewClient#onRenderProcessGone(android.webkit.WebView,%20android.webkit.RenderProcessGoneDetail)): uma WebView cujo renderizador terminou não deve ser reutilizada.

Mudar apenas a memória temporária de um teste não altera a configuração permanente do AVD. Não apresentar emulador ou testes de falha controlada como prova em aparelho físico.


## Fechamento do teste nativo

PASS com 4 GB temporários: abrir sem rede chegou ao `errorPath` local, sem assets externos; após restabelecer a conexão, toque ADB no botão retornou ao HTTPS configurado na mesma atividade nativa. Viewport final 411 × 891. O teste passou a considerar os 128 pixels físicos de deslocamento da WebView abaixo da barra de status do Android 17; a primeira falha de toque era da automação. Evidência: `native-connection-android-4096.json/.txt`, `native-offline-android-4096.png`.

PASS em crash controlado do renderizador: `Page.crash` no debug abriu RecoveryActivity, manteve o PID, mostrou mensagem genérica de falha e aceitou retorno explícito para MainActivity. Não houve reinício automático. Evidência: `native-renderer-recovery.json/.txt/.png`; reprodução: `node simulations/test-native-renderer-recovery.cjs` depois do teste de conexão.

A prova observada em 2 GB (LOW_MEMORY real, tela nativa e retorno no mesmo PID) permanece separada. O teste completo de conexão com CDP em 2 GB não passou: houve encerramento do renderizador inclusive durante screenshot. Nenhuma aprovação de desempenho nessa memória é inferida da repetição em 4 GB. A configuração permanente do AVD continua 2048 MB.

A identidade de código da build otimizada foi confirmada por HTTP local (`release-identity-local.json`); o gate remoto permanece PENDING/404. Os emuladores/servidor iniciados para este teste são encerrados ao finalizar. Não houve geração de AAB, alteração de versão Android, deploy nem cobrança.
