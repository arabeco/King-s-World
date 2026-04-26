# KingsWorld: Relatorio Operacional

Data: 25/04/2026

## Veredito Do Dia

O KingsWorld saiu da fase de "sistemas soltos" e entrou numa base bem mais confiavel de produto jogavel. A mudanca mais importante foi consolidar a influencia como score fixo do imperio, e nao como recurso gasto. Isso destrava o jogo como corrida de soberania: o jogador evolui cidade, herois, exercito, sociedade e legado para chegar ao corte final.

O app ainda nao esta pronto para beta externo, mas a base tecnica principal ficou muito mais forte. Pela regua atual, os niveis 1 a 6 estao fechados, e o nivel 7 entrou em validacao real: Supabase ja confirma mundo, player, rei, capital, estado imperial e campanha Alpha persistente.

## O Que Fechamos Hoje

### 1. Influencia Virou Score Oficial

A influencia agora e a soma viva dos blocos do imperio, com teto teorico de 2500 pontos:

- Infraestrutura: 1000
- Governo: 500
- Militar: 400
- Sociedade: 300
- Legado: 300

O objetivo final segue sendo chegar em 1500 de influencia segura para atravessar o Portal Central. O teto de 2500 existe, mas e improvavel e depende de desempenho, posicao e sorte.

### 2. Governo Ficou Coerente

Governo agora e simples e legivel:

- Cada heroi vivo no Governo vale 50 pontos.
- O limite e 10 herois.
- Governo maximo: 500 pontos.
- Se perder heroi, perde o slot vivo e a influencia cai naturalmente.

Isso remove o fantasma de formulas antigas e deixa o jogador entender de onde vem o poder politico.

### 3. Legado Foi Travado

Legado agora soma ate 300 pontos:

- Quests: ate 100
- Maravilhas: ate 2 maravilhas, 50 cada
- Tribo/pacto: ate 100

A regra da maravilha ficou clara: maravilha e coisa de cidade nivel 100, nao premio aleatorio no meio do jogo.

### 4. Energia E Influence Stock Foram Cortados Do Centro

Energia saiu do modelo central. Influence stock tambem nao deve mandar na economia, porque influencia nao e estoque.

O smoke de persistencia passou verificando que:

- Rotas centrais nao selecionam `influence_stock` ou `energy_stock`.
- A campanha nao usa `influenceStock` como verdade.
- A cidade nao exibe mais producao `I/d`.
- A influencia vem de formulas e blocos, nao de acumulador antigo.

### 5. Smokes De Engine E Persistencia Passaram

Comandos validados:

```bash
npm run smoke:balance
npm run smoke:level5
npm run smoke:level6
npm run smoke:level7
npm run smoke:world:create
npm run smoke:participant
npm run typecheck
npm run build
```

Resultado importante:

- Balance PASS
- Level 5 PASS
- Level 6 PASS
- Campanha chega ao fim como `victorious`
- Mundo finaliza como `finalized`
- Estado final fica `readOnly`
- Score final do smoke: 1680
- Gate 7 PASS no smoke estatico de conexao
- Criacao de mundo Alpha PASS no Supabase
- Fluxo de participante PASS: login dev, entrada no mundo, rei, upgrade de predio e consulta no Supabase

### 6. Supabase Real Confirmado

O fluxo novo deixou de ser apenas mock/local:

- `alpha-expresso` criado no Supabase.
- `alpha-teste` mantido como mundo classico.
- `world_players` registra jogador vivo.
- `world_player_imperial_states` salva recursos e estado imperial.
- `world_player_king_states` salva rei escolhido.
- `map_sites` guarda a capital ligada ao `current_capital_site_id`.
- `village_structure_states` confirmou upgrade real de Governo/Coroa.

A tabela antiga `villages` nao e a fonte principal desse fluxo. A capital real do Alpha foi confirmada em `map_sites`, o que evita confundir persistencia nova com tabela legada.

### 7. Rei Virou Decisao De Gameplay

A escolha de rei agora acontece antes de abrir o mundo. O jogo nao mostra o HUD primeiro para depois jogar o modal por cima.

Cada rei ganhou atributos pequenos, mas sem alterar o teto de influencia:

- Custo de predio.
- Producao de materiais/suprimentos/logistica.
- Satisfacao.
- Risco de crise.
- Bonus militar.
- Velocidade de exploracao/rota.

Importante: nenhum rei aumenta influencia maxima nem muda o corte de 1500. O rei muda o caminho, nao o teto.

### 8. Alpha Expressa Foi Criada

Foi criado o modo de temporada:

- `classic`: 120 dias, x1.
- `express`: 30 dias, x4.

O SQL `21_SQL_MODO_EXPRESSO_DO_MUNDO.sql` foi rodado e confirmado. O mundo `alpha-expresso` ficou com:

- `season_mode = express`
- `speed_multiplier = 4`
- movimento base 11 min/hex
- estrada 4 min/hex

O modo expresso acelera calendario, movimento, materiais, suprimentos e logistica. Ele nao multiplica influencia/score.

## Leitura De Maturidade

O projeto ja tem mais engine e persistencia do que a aparencia sugere. O gargalo agora nao e mais "sera que a regra funciona?", e sim "sera que um jogador entra, entende, joga e volta amanha sem precisar de nos explicando no chat?".

### Nivel Atual

Nivel 6 fechado. Nivel 7 tecnicamente aprovado por smoke de participante; falta teste humano visual para cravar o gate como fechado.

### Proximo Gate

Nivel 7: Conexao.

Para fechar de verdade, falta validar em teste humano curto:

- Login/lobby/Alpha Expressa.
- Escolha de rei uma unica vez.
- Upar predio, recarregar e manter estado.
- Mapa, perfil e cidade sem reset.
- Confirmar que a campanha continua igual depois de F5/reabrir app.

## Riscos Abertos

- O design ainda esta em evolucao, mesmo tendo melhorado muito nos modais e HUD.
- O mapa ficou mais leve, mas ainda precisa cuidado: nao mexer em pan/zoom sem teste visual.
- O fluxo de onboarding precisa explicar melhor o que fazer dia a dia.
- Paywall Play Store ainda nao foi validado como compra real.
- Componentes gigantes ainda existem e podem atrapalhar manutencao.
- Nivel 7 passou em smoke, mas ainda falta teste humano completo para virar gate fechado.

## Proxima Ordem Recomendada

1. Fazer o teste humano curto do Nivel 7 no Alpha Expressa.
2. Se passar, marcar Nivel 7 como fechado em `progresso.md`.
3. Depois atacar Nivel 8: feedbacks/toasts, performance, mobile, paywall Play Store e polimento final.
