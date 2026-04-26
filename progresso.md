# KingsWorld: Progresso De Maturidade

Base: Blueprint de Maturidade Beco's Lab adaptado para KingsWorld.

Status atual: Nivel 6 fechado. Nivel 7 tecnicamente aprovado por smoke; falta teste humano visual.

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

Status: Em validacao.

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

### O Que Falta

- Fazer teste humano completo no localhost/celular.
- Validar perfil, mundo escolhido, rei escolhido e cidade depois de F5.
- Confirmar progresso multi-dispositivo.
- Conferir que Alpha Expressa continua legivel no loop real de jogo.

### Gate

App conectado, seguro e pronto para receber usuarios na nuvem.

Resultado: aprovado tecnicamente. Falta teste humano visual para fechar o gate com seguranca de UX.

## Nivel 8: Refino

Status: Pendente.

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

### Gate

Produto de prateleira sem pontas soltas ou bugs visiveis.

Resultado: pendente.

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
