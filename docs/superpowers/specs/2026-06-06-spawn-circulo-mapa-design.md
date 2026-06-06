# Spawn no círculo do mapa — inimigos e abandonadas (KingsWorld) — Design

> **Data**: 2026-06-06
> **Problema**: cidades abandonadas e capitais de NPC nascem amontoadas/coladas
> no jogador em vez de espalhadas pelo mapa. Reportado no mundo "Alpha Expresso".

## Causa raiz (confirmada no código)

Mapa cliente: raio **40** (`lib/world-map-config.ts:WORLD_HEX_RADIUS=40`), zonas
núcleo ≤13 / meio ≤26 / externa ≤40. Jogador renderizado sempre no centro (0,0)
(`components/board/strategic-map-model.ts`, `ZERO_AXIAL`).

- **Abandonadas (`42_SQL_CIDADES_ABANDONADAS.sql`)**: coord `q=2+(seed%14)*2`,
  `r=30+(seed/14)*2` → distâncias hex 32–58 num **único setor** (q,r positivos).
  Tudo > 40 é **clampado pra borda** (`clampAxialToRadius`) → colapsa num arco só
  → "coladas em você num canto". São só 6.
- **NPCs**: `28_SQL_NPC_PRESENCA_MAPA.sql` coloca numa faixa colada na origem
  (q 4–26, r 4+); `29_SQL_NPC_SPAWN_ANEL.sql` re-posiciona num anel correto
  (raio 18–30, polar). Se o 29 não rodou num mundo, os NPCs ficam colados.

Os SQL são rodados manualmente no Supabase, então o estado por mundo varia.

## Objetivo

Inimigos e abandonadas espalhados pelo **círculo inteiro do mapa**: todos os
ângulos, longe do núcleo (onde o jogador nasce), sem cluster e sem colar no
jogador. Consertar o mundo que já existe sem AAB nem deploy (só SQL).

## Solução: `49_SQL_SPAWN_CIRCULO.sql` (idempotente)

Generaliza o método polar do `29` (que já funciona) e aplica aos dois tipos.

**Bloco A — completar abandonadas até 12 por mundo (status running)**
- Alvo por porte: **6 pequena** (`neutral`), **4 média** (`posto_avancado`),
  **2 fortaleza** (`bastiao`) — conta o que existe e completa cada porte
- Reusa a infra/defesa por porte do `42` (slots por estrutura)
- Spawn em coord temporária livre (o Bloco B reposiciona)

**Bloco B — re-distribuir no círculo**
- Alvos: capitais de NPC (`is_ai`) + todas as abandonadas (owner null)
- Para cada, coordenada polar com tentativas:
  - ângulo aleatório 0–2π
  - raio polar 14–34; valida distância hex da origem em **[14, 37]**
    (longe do núcleo; dentro de 40 pra não clampar)
  - rejeita se distância hex < **5** de qualquer outro tile (inclui o capital do
    jogador → mantém afastado dele)
  - `update map_tiles set q,r`
- **Não move** o capital do jogador (não-AI). Ele fica no centro.
- Roda sobre worlds `running` → re-randomiza o mundo atual na hora.

## Por que SQL-only basta

O cliente renderiza as coords `q,r` do servidor relativo ao jogador em (0,0) e
clampa em 40. Mantendo tudo em distância hex ≤37, nada é clampado → aparece onde
foi colocado. Nenhuma mudança de cliente/AAB/Vercel necessária.

## Fora de escopo
- UX das ações do mapa (problema #1, próximo)
- Mudar o modelo egocêntrico do cliente (jogador no centro continua)

## Verificação
- Rodar o SQL no SQL Editor do Supabase (mundo Alpha Expresso)
- Query de conferência (no fim do arquivo): distância ao centro e ângulo variados,
  sem distância < 5 entre tiles
- No app: abandonadas/inimigos espalhados em volta, longe do centro, sem cluster
