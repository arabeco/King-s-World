# Auditoria de Influencia e Recursos

Data: 2026-04-21

## Regra oficial consolidada

- Influencia e `score soberano vivo`, nao moeda operacional.
- Influencia nao deve ser gasta em construir, mover, espionar, transferir capital ou contratar.
- O objetivo real do fim de jogo e chegar ao Centro/Portal com `1500+`.
- O teto teorico e `2500`, mas ele deve ser raro, improvavel e dependente de posicao, sorte e execucao excepcional.
- Mundo de referencia: `50 jogadores`.
- Meta observada/esperada: cerca de `20 sobreviventes` chegando ao objetivo final com `1500+`.

## O que esta alinhado

- [core/GameBalance.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/core/GameBalance.ts:25) ja trava `SOVEREIGNTY_SCORE_MAX = 2500`.
- [core/GameBalance.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/core/GameBalance.ts:26) ja trava `SOVEREIGNTY_PORTAL_CUT = 1500`.
- Varios textos de portal/gate ja usam 1500 como corte de acesso.
- Parte da documentacao ja fala em influencia fixa, teto 2500 e gate 1500.

## Onde a regra ainda esta quebrada

### 1. Influencia ainda esta modelada como recurso persistido

- [lib/imperial-state.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/lib/imperial-state.ts:22)
- [lib/world-data.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/lib/world-data.ts:77)
- [app/api/worlds/[worldId]/imperial-state/route.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/app/world/[worldId]/imperial-state/route.ts:11)

Hoje `ImperialResources` ainda contem:

- `materials`
- `supplies`
- `influence`

E o backend ainda persiste:

- `materials_stock`
- `supplies_stock`
- `energy_stock`
- `influence_stock`

Isso significa que o modelo atual ainda trata influencia como estoque mutavel, nao como score derivado.

### 2. Influencia ainda e gasta diretamente

#### Capital

- [components/base/KingdomOverviewPanel.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/base/KingdomOverviewPanel.tsx:363)
- [components/base/KingdomOverviewPanel.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/base/KingdomOverviewPanel.tsx:517)

Hoje mover capital exige e desconta `CAPITAL_TRANSFER_COST.influence`.

#### Comando local

- [components/base/VillageCommandPanel.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/base/VillageCommandPanel.tsx:280)
- [components/base/VillageCommandPanel.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/base/VillageCommandPanel.tsx:308)

Hoje existem custos operacionais com `cost.influence`.

#### Mapa

- [components/board/StrategicMap.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/board/StrategicMap.tsx:2505)
- [components/board/StrategicMap.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/board/StrategicMap.tsx:2528)
- [components/board/StrategicMap.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/board/StrategicMap.tsx:2913)
- [components/board/StrategicMap.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/board/StrategicMap.tsx:2927)

Hoje mapa ainda:

- cobra influencia para `build`
- cobra influencia para `spy`
- desconta influencia do estado

Isso contradiz diretamente a regra oficial.

### 3. Building costs ainda carregam influencia como custo

- [lib/buildings.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/lib/buildings.ts:239)
- [core/GameBalance.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/core/GameBalance.ts:2070)
- [core/GameBalance.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/core/GameBalance.ts:714)

O sistema de custo de obra ainda usa `baseCost.influence` e `requiredInfluence`.

Isso e resto estrutural do jogo antigo.

### 4. Simulacao e sandbox ainda somam influencia como se fosse saldo de recurso

- [core/GameBalance.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/core/GameBalance.ts:1651)
- [core/GameBalance.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/core/GameBalance.ts:2108)
- [components/sandbox/SandboxProgressEngine.tsx](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/components/sandbox/SandboxProgressEngine.tsx:283)
- [lib/sandbox-day-resolution.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/lib/sandbox-day-resolution.ts:84)

Hoje sandbox ainda opera como:

- resolve ganhos/perdas em `resources.influence`
- aplica teto/capacidade
- mostra preview diario como saldo de recurso

Para a regra nova, isso deveria virar:

- `score delta`
- `score atual`
- `fonte do score`

### 5. Energy ainda aparece no backend e alguns fluxos, mas ja nao parece central

- [lib/world-data.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/lib/world-data.ts:76)
- [app/api/worlds/[worldId]/imperial-state/route.ts](/C:/Users/Afonso/Downloads/King-s-World-main/King-s-World-main/app/world/[worldId]/imperial-state/route.ts:10)

`energy_stock` ainda existe no schema de leitura/escrita, mas no jogo atual o eixo operacional visivel principal esta muito mais em:

- materiais
- suprimentos
- populacao
- tropas
- tempo

Energy parece legado parcial.

## Recursos reais que hoje fazem sentido

### Recursos operacionais reais

- `Materiais`
- `Suprimentos`
- `Populacao`
- `Tropas`
- `Tempo/ETA`
- `Slots/limites` como diplomatas, herois e capacidade

### Score soberano

- `Influencia`

Influencia deve nascer de:

- predios / desenvolvimento
- governo / herois
- militar
- sociedade
- legado
- quests
- maravilhas
- tribo

Mas nao deve entrar como moeda de acao.

## Sobras claras do jogo antigo

- `influence_stock`
- `influence_capacity`
- `baseCost.influence`
- `spyCost.influence`
- `buildCost.influence`
- `CAPITAL_TRANSFER_COST.influence`
- varios checks `resources.influence >= custo`
- varios descontos `resources.influence - custo`

Esses pontos sao os alvos certos da refatoracao.

## Conclusao honesta

Hoje o projeto esta em estado hibrido:

- a regra de score final ja aponta para a verdade nova
- mas a malha operacional ainda carrega influencia como recurso gastavel

Ou seja:

**a ideia central ja mudou, mas o motor ainda nao foi completamente migrado.**

## Ordem recomendada de limpeza

1. Tirar influencia de todos os custos operacionais visiveis.
2. Separar `score soberano` de `recursos`.
3. Parar de persistir `influence_stock` como se fosse saldo de moeda.
4. Fazer sandbox e relatios falarem em `score` e `delta de score`.
5. So depois disso recalibrar exploracao, espionar, construir e eventos novos.
