# KingsWorld: Progresso De Maturidade

Base: Blueprint de Maturidade Beco's Lab adaptado para KingsWorld.

Status atual: Nivel 7 conquistado. Nivel 8 em andamento; ja passou no smoke criador + participante, mas ainda falta teste humano/mobile/paywall para fechar o gate 8 completo.

## Checklist Oficial De Maturidade

### Nivel 1: Ideia
- [x] Manifesto do projeto e definicao do superpoder escrito.
- [x] Fluxograma logico de decisoes e caminhos do usuario desenhado.
- [x] Stack tecnica (Next.js, Supabase, Capacitor) definida e validada.
- [x] GATE: Blueprint completo e visao de escopo travada sem furos graves.

### Nivel 2: Infraestrutura
- [x] Primeiro commit, projeto criado, Tailwind/design system e repo configurados.
- [x] Instancia do Supabase ativa com tabelas, Auth e base de politicas configuradas.
- [x] Ambiente de nuvem/deploy encaminhado para validacao de teste.
- [x] GATE: Ambiente de desenvolvimento e nuvem em harmonia para desenvolvimento.

### Nivel 3: Design
- [x] Paleta KingsWorld e direcao visual implementadas no codigo.
- [x] Componentes base criados: glassmorphism, botoes, cards e modais.
- [x] Estrutura de menus com bottom tabs/sidebar funcional e padronizada.
- [x] GATE: Interface soberana e estetica premium consolidada como base.

### Nivel 4: Fluxo
- [x] Roteamento completo entre as telas principais do app funcionando.
- [x] Fluxo de onboarding/entrada no mundo e escolha de rei implementado.
- [x] GATE: Caminho do jogador mapeado e navegavel.

### Nivel 5: Engine
- [x] Tipos e regras centrais em TypeScript estruturados e sem erro de typecheck.
- [x] Algoritmos de score, economia, cidade, temporada e exploracao implementados.
- [x] Validacao das regras de negocio e limites do sistema testada por smoke.
- [x] GATE: Cerebro do app estavel e aprovado tecnicamente.

### Nivel 6: Persistencia
- [x] Estado global integrado no runtime do mundo.
- [x] Persistencia local/banco configurada para progresso principal.
- [x] Hydration validada: app nao reseta no reload e mantem estado no Supabase.
- [x] GATE: Memoria local/banco conquistada sem verdade escondida em snapshot legado.

### Nivel 7: Conexao
- [x] Login dev/autenticacao de teste funcionando no fluxo real.
- [x] Sincronizacao entre app e Supabase validada por smoke e SQL.
- [x] Backup de progresso, perfil, rei, cidade, estruturas e exploracao validado no banco.
- [x] Teste completo no localhost validado por smoke criador + participante.
- [x] GATE: App conectado, seguro tecnicamente e pronto para avancar ao refino.

### Nivel 8: Refino
- [x] Sistema global de toasts e feedbacks visuais de erro/sucesso.
- [ ] Otimizacao de performance (Lighthouse 90+) e carregamento.
- [ ] Build mobile (Capacitor) gerado e testado em dispositivo fisico.
- [ ] Logica de paywall e area premium validada como fluxo real.
- [ ] GATE: Produto de prateleira sem pontas soltas ou bugs visiveis.

### Nivel 9: Marketing E Testes
- [ ] Setup completo na Google Play Console e App Store Connect.
- [ ] Redes sociais e landing page de pre-cadastro.
- [ ] Closed beta com 20 testadores por 14 dias.
- [ ] Material visual, videos de uso e build in public.
- [ ] GATE: Validacao externa concluida e tracao inicial de comunidade.

### Nivel 10: Produto Vivo
- [ ] Lancamento oficial para o publico geral.
- [ ] Gateways de pagamento e planos Plus/Pro ativos.
- [ ] ASO final com keywords e screenshots profissionais.
- [ ] Monitoramento de metricas e inicio de trafego pago.
- [ ] GATE: Produto vivo com receita e escala ativa.

## Nivel 1: Ideia

Status: Fechado.

### Escopo

- Manifesto do projeto e definicao do superpoder.
- Fluxograma logico de decisoes e caminhos do usuario.
- Stack tecnica definida: Next.js, Supabase, Capacitor.

### Evidencia KingsWorld

- O jogo tem conceito central claro: estrategia sazonal, mundo persistente, cidades, exploracao, influencia e fechamento de temporada.
- A proposta se diferencia de Tribal Wars ao centralizar politica, score, herois e expansao sem microgerenciar tropa por aldeia em excesso.
- A stack do app ja esta ativa no projeto.

### Gate

Blueprint completo e visao de escopo travada sem furos graves.

Resultado: aprovado.

## Nivel 2: Infraestrutura

Status: Fechado.

### Escopo

- Projeto criado e repositorio configurado.
- Tailwind/design base e scripts do app configurados.
- Supabase ativo com Auth e tabelas principais.
- Deploy/ambiente de nuvem preparado ou encaminhado.

### Evidencia KingsWorld

- Projeto Next.js rodando com scripts de build, typecheck e smokes.
- Supabase configurado no app.
- Tabelas dedicadas existem para mundo, jogador, estado imperial, cidade, estruturas, rei, exploracao e tropas.
- O app ja usa dados persistentes em blocos centrais.

### Gate

Ambiente de desenvolvimento e nuvem em harmonia total.

Resultado: aprovado para desenvolvimento. Ainda precisa validacao final de deploy antes de beta externo.

## Nivel 3: Design

Status: Fechado como base, ainda em refino.

### Escopo

- Paleta e identidade visual implementadas no codigo.
- Componentes base criados: glassmorphism, botoes, cards, modais.
- Estrutura de menus funcional e padronizada.

### Evidencia KingsWorld

- HUD mobile com bottom tabs.
- Cards e modais com imagem de fundo e glassmorphism.
- Lobby, premium, cidade, mapa e perfil ja seguem uma direcao visual mais soberana.
- Icones premium/dourados comecaram a substituir simbolos genericos.

### Gate

Interface soberana e estetica de produto premium consolidada.

Resultado: aprovado como base. O refinamento visual continua no Nivel 8.

## Nivel 4: Fluxo

Status: Fechado.

### Escopo

- Roteamento completo entre telas.
- Onboarding e transicoes principais.
- Caminho do jogador mapeado e navegavel.

### Evidencia KingsWorld

- Fluxo principal existe: login/lobby, selecao de mundo, escolha de rei, entrada no mundo, abas de imperio, cidades, intel/mapa, mundo e perfil.
- Campanha por codigo passa do inicio ao fim.
- O app possui fim de temporada e estado final read-only.

### Gate

Caminho do jogador mapeado e navegavel.

Resultado: aprovado tecnicamente. Ainda precisa ficar mais obvio para jogador novo no Nivel 7/8.

## Nivel 5: Engine

Status: Fechado.

### Escopo

- Arquivo global de tipos e regras centrais em TypeScript.
- Algoritmos de score, economia, cidade, exploracao e temporada implementados.
- Validacao das regras de negocio e limites de sistema testados.

### Evidencia KingsWorld

- Influencia oficial:
  - Infraestrutura: 1000
  - Governo: 500
  - Militar: 400
  - Sociedade: 300
  - Legado: 300
  - Total maximo: 2500
  - Corte do portal: 1500
- Governo: 10 herois x 50 pontos.
- Legado: quests 100, maravilhas 100, tribo 100.
- Simulacao de temporada valida corte, sobreviventes, progressao e teto.
- `npm run smoke:level5` passou.

### Gate

Cerebro do app estavel, inteligente e a prova de falhas logicas.

Resultado: aprovado.

## Nivel 6: Persistencia

Status: Fechado.

### Escopo

- Estado global integrado.
- Persistencia local ou banco configurada.
- Hydration sem reset no F5.
- Supabase preservando progresso real.

### Evidencia KingsWorld

- `npm run smoke:level6` passou.
- Supabase esta configurado.
- O smoke valida tabelas dedicadas para cidade, estruturas, rei, exploracao e tropas.
- Snapshot antigo nao carrega mais rei, cidade, estruturas nem exploracao como verdade escondida.
- `influence_stock` e `energy_stock` nao mandam mais no fluxo central.
- Campanha finaliza como `victorious`, mundo `finalized`, estado `readOnly`.

### Gate

Memoria local e persistencia inicial engatilhadas sem reset estrutural.

Resultado: aprovado.

## Nivel 7: Conexao

Status: Conquistado.

### Escopo

- Login real funcionando 100%.
- Sincronizacao real entre app e Supabase.
- Backup de progresso e perfil multi-dispositivo.
- Teste humano completo no localhost.

### O Que Falta

### Evidencia KingsWorld

- `npm run smoke:level7` passou.
- `npm run smoke:world:create` passou.
- `npm run smoke:participant` passou.
- `npm run smoke:level8` passou usando criador + participante no mesmo mundo.
- Supabase confirmou `alpha-expresso` e `alpha-teste`.
- `alpha-expresso` esta como `season_mode = express` e `speed_multiplier = 4`.
- `alpha-teste` esta como `classic` e `speed_multiplier = 1`.
- `world_players` registra jogador vivo.
- `world_player_imperial_states` salva recursos e estado imperial.
- `world_player_king_states` salva rei escolhido.
- `map_sites` guarda a capital real ligada ao player.
- `village_structure_states` salva upgrade real de predio.
- A escolha do rei bloqueia o HUD ate o estado carregar.
- Rei escolhido nao deve ser pedido de novo se ja existe no Supabase.
- Lobby cria Alpha classica e Alpha expressa.
- Smoke de participante validou: sessao dev, entrada no mundo, rei `serenna`, Governo/Coroa +1, reload via API e leitura direta do Supabase.
- Smoke N8 validou: mundo com 50 participantes, runtime agendado para a proxima 00:00, participante vivo, rei dedicado, exploracao dedicada e movimento de mapa persistido.

### O Que Falta

- Validar perfil, mundo escolhido, rei escolhido e cidade depois de F5 em teste humano.
- Confirmar progresso multi-dispositivo em aparelho real.
- Conferir que Alpha Expressa continua legivel no loop real de jogo.

### Gate

App conectado, seguro e pronto para receber usuarios na nuvem.

Resultado: conquistado por smoke tecnico e prova SQL. Teste humano visual fica como risco de UX, nao como bloqueio do Nivel 7.

## Nivel 8: Refino

Status: Em andamento.

### Escopo

- Toasts e feedbacks globais.
- Performance mobile e carregamento.
- Build mobile com Capacitor em dispositivo fisico.
- Paywall Play Store e area premium validados.

### Preparacao Ja Feita

- Mapa ficou mais leve apos ajustes de zoom por camadas.
- Modo Alpha Expressa foi criado para acelerar teste de campanha.
- Rei tem atributos reais pequenos sem mexer no teto de influencia.
- Producao operacional no modo expresso acelera materiais, suprimentos e logistica.
- SQL `21_SQL_MODO_EXPRESSO_DO_MUNDO.sql` foi criado e rodado.
- `npm run smoke:level8` foi criado e passou.
- Sistema global de toasts foi criado e plugado no layout raiz.
- Fluxos de Coroa, preenchimento de IA e comando GM agora emitem sucesso/erro visual sem depender de texto inline.
- O smoke N8 clica no Perfil como criador, agenda inicio para a proxima 00:00, valida ranking com 50 participantes e faz o participante navegar por telas principais.
- O mesmo smoke grava rei, exploracao e marcha/rota no Supabase para conferencia por SQL.

### Evidencia N8

- Relatorio: `reports/smoke-level8-creator-participant.json`.
- Mundo: `alpha-expresso`.
- `world_players`: 50 participantes.
- `world_player_king_states`: participante com `king_profile_id = serenna` e `king_name = Smoke N8 Serenna`.
- `world_player_exploration_states`: coordenada `1:0` gravada como `opportunity`.
- `world_player_imperial_states.sandbox_snapshots_json.__runtimeMap.mapMovements`: movimento `smoke-n8-*` com `routeSteps`.
- `world_player_imperial_states.sandbox_snapshots_json.__clientState.exploredCoordKeys`: vazio/nulo, provando que exploracao nao ficou como verdade escondida no snapshot.

### Gate

Produto de prateleira sem pontas soltas ou bugs visiveis.

Resultado: aprovado como entrada tecnica no Nivel 8. Ainda pendente para fechar o gate completo: Lighthouse/performance, build mobile em dispositivo fisico, toasts globais e paywall real.

## Nivel 9: Marketing E Testes

Status: Pendente.

### Escopo

- Google Play Console e App Store Connect.
- Landing page e pre-cadastro.
- Closed beta com 20 testadores por 14 dias.
- Videos, prints e build in public.

### Gate

Validacao externa concluida e tracao inicial de comunidade.

Resultado: pendente.

## Nivel 10: Produto Vivo

Status: Pendente.

### Escopo

- Lancamento publico.
- Pagamentos e planos premium ativos.
- ASO final.
- Monitoramento de metricas e escala.

### Gate

Soberania digital atingida com receita e escala ativa.

Resultado: pendente.
