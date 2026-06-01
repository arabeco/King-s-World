# Design: Progressão Fluida e Rebalanceamento do Late Game

Data: 2026-06-01
Status: aprovado (design) — aguardando spec review

## Problema (evidência da super-simulação 120d, 400 trajetórias)

- **Injustiça entre builds:** entrada no Portal por arquétipo — bastião **41.6%**, posto 30%, metrópole 29.3%, celeiro **28%**.
- **Metrópole front-load e colapsa:** maior influência no D90 (1663) mas despenca até D120 (1428). Bastião faz o oposto (1394 → 1508).
- **Late game é atrição:** influência média cai D90→D120 (1536 → 1412, abaixo do corte de 1500); aldeias caem 7.92 → 5.36.
- **Causa raiz (código):** em `lib/kingdom-survival.ts` a defesa = `muralha×7 + palácio×3`. Sobreviver à horda é **quase 100% muralha**. Só bastião passa. O pico de horda é no **D110** (`hordeSpikeDay` em `core/GameBalance.ts`) e a "resiliência de horda" (pilar de score, peso 200) é defesa-pesada.
- **Lock-in:** a classe da **capital** define o arquétipo do jogador (`cityClassToArchetype`), e **a capital não pode ser trocada** (não há ação no código). O jogador fica preso à build escolhida no início.

## Princípio de design

**Progressão fluida guiada pelo jogador, não por arquétipo fixo.** O jogador adapta ao que quer / ao que a situação pede no momento, e qualquer linha razoável é viável. A justiça vem da flexibilidade, não de balancear 4 caixinhas fixas. A tensão do late game continua alta (~32% de Portal), mas o jogador falha por **ler mal a situação**, não por ter "nascido na build errada".

## Decisão de balanceamento

Manter a dificuldade total (~32% de Portal), mas fazer os 4 arquétipos **convergirem para ~30-35% cada** (hoje 28%–41.6%).

## Mudanças

### 1. Trocar / re-especializar a capital — por um preço
- Nova ação: promover outra aldeia a capital **ou** re-especializar a capital atual (mudar `cityClass`).
- **Custo** de recurso (e provável **cooldown**) — não é de graça, é uma decisão estratégica.
- Mover o rei p/ nova capital tem **risco** (rei desprotegido em trânsito — ver item 5).
- Toca: `royalCapitalVillageId`/`current_capital_site_id` (`lib/world-data.ts`), `cityClassByVillage`/`cityClassLockedByVillage`, `cityClassToArchetype` (`lib/cities.ts`).

### 2. Resiliência de horda multi-pilar + ataques recorrentes
- **Defesa deixa de ser só muralha.** O score de defesa passa a somar/combinar pilares, cada build com o seu caminho:
  - 🧱 muralha + palácio (bastião) — como hoje
  - ⚔️ tropas estacionadas na capital (posto/militar)
  - 🏛️ maravilhas controladas + heróis de conselho (metrópole)
  - 🌾 excedente de suprimento convertível em defesa emergencial (celeiro/logístico)
- **Resposta no momento:** quando a horda/ataque chega, o jogador escolhe COMO reagir com o que tem (convocar exército, gastar suprimento em muralha emergencial, ativar aura de maravilha, recuar heróis).
- **Ataques NPC ao longo do jogo todo:** além do pico do D110, eventos de ataque NPC **recorrentes** distribuídos pelos 120 dias (intensidade crescente), pra forçar adaptação contínua — não só no fim. (Exploração continua sendo descoberta territorial à parte.)
- Toca: `lib/kingdom-survival.ts` (fórmula de defesa), `lib/combat-engine.ts` + simulador (resolução real da horda/ataque), `core/GameBalance.ts` (`hordeSpikeDay`, `hordeResilience`, calendário de ataques).

### 3. Manter "neutra → trava depois"
- Aldeia nasce `neutral` e o jogador trava a classe quando quiser (já existe). Aproveitar e deixar consistente com o item 1 (poder destravar/re-travar por um preço).

### 4. Clareza pro jogador
- Mostrar o rótulo de defesa (Frágil → Segurando → Fortaleza → Último Bastião), **de onde a defesa vem** (muralha/tropa/maravilha/suprimento) e **o que falta** pra subir de rótulo.
- Mostrar o calendário de ameaça (próximo ataque NPC, pico do D110) pra o jogador se preparar.

### 5. Rei = ponto único de falha (interação)
- Manter: `kingAlive=false` → game over (`lib/kingdom-survival.ts`).
- Mover capital/rei expõe o rei temporariamente (janela de risco) — é o trade-off do pivô do item 1.

## Critérios de sucesso

- Rodar a super-sim (`simulations/`) de novo. Alvo:
  - 4 arquétipos entre ~30-35% de Portal (gap atual 28%–41.6% fecha).
  - Total de Portal segue ~30-35% (tensão preservada).
  - Metrópole e celeiro param de colapsar D90→D120 (influência D120 não cai abaixo do D90 de forma sistemática).
- Pelo menos uma run mostrando um pivô de capital bem-sucedido (build que mudou de foco no meio e entrou no Portal).

## Fora de escopo (por enquanto)

- Sistema de dia / começar no dia 0 (frente separada que o usuário adiou).
- Rebalanceamento de economia inicial / ritmo do early game (concern "ritmo" foi descartado).
- Novos arquétipos ou novos heróis.

## Pontos abertos de tuning (resolver na implementação/sim)

- Custo e cooldown exatos de trocar capital.
- Pesos de cada pilar na nova fórmula de defesa.
- Frequência e intensidade dos ataques NPC recorrentes.
