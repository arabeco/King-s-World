# Arquitetura: Mundo Online com NPCs Ativos (visão + decomposição)

Data: 2026-06-01
Status: visão aprovada — sub-projetos a detalhar um a um

## Visão (decisão do dono)

Mundo **online compartilhado**. Jogadores reais convivem e se enfrentam. Se um jogador
começa/entra num mundo sem humanos suficientes, **NPCs preenchem e JOGAM de verdade**
(constroem, expandem, atacam) — não são figurantes de placar.

## Estado atual (auditado em 2026-06-01) — IMPORTANTE

O jogo jogável hoje é **solo / sandbox client-authoritative**:
- **Sem PvP no servidor.** Nenhuma resolução jogador-vs-jogador em `app/api`/`world-data`. O `combat-engine` só roda no cliente (`StrategicMap.tsx`); "atacar" = tomar **site NPC** do mapa, resolvido localmente contra o próprio `imperial_state`.
- **NPCs não agem.** `ai-fill` só insere linhas de "jogadores IA" (nomes de casas) na tabela `world_players`; eles não jogam.
- **Sem tick de mundo no servidor.** `runtime` route só atualiza `runtime_anchor_day` (contador de dia). Nada de NPC/horda/combate roda no servidor.
- **Combate/IA/horda profundos vivem só no simulador `.mjs`** (offline, pra balancear). → São **portáveis** pro runtime; não é do zero.

## Modelo de tick: HÍBRIDO (decidido)

- **Cron (tick lento do mundo):** job agendado (Supabase `pg_cron` / função agendada) avança o mundo — turnos de NPC, horda, eventos. Frequência a definir.
- **Ações do jogador resolvem na hora com ETA:** ataque/marcha/expansão são registrados e resolvidos com tempo de viagem (ETA), não esperam o cron.
- Fonte da verdade migra do cliente (`imperial_state` sandbox) → **servidor** (estado autoritativo compartilhado por mundo).

## Decomposição em sub-projetos (ordem de build)

1. **Servidor = fonte da verdade + tick híbrido** ← COMEÇAR AQUI
   - Migrar estado autoritativo pro servidor; definir loop do cron; ETA de ações.
   - Base de tudo; nada online funciona sem isso.
2. **Combate no servidor** — portar `combat-engine` pro backend. PvE primeiro (site/horda), depois PvP (jogador-vs-jogador) autoritativo.
3. **NPCs ativos** — portar a IA do `.mjs` pra um loop de NPC no tick; NPCs constroem/expandem/atacam.
4. **Fill do mundo / matchmaking** — começar solo → NPCs entram; humanos entram em mundos compartilhados; balancear humanos vs NPC.
5. **Rebalance de progressão** — aplicar o spec `2026-06-01-progressao-fluida-design.md` (defesa multi-pilar, trocar capital por preço, ataques NPC recorrentes, clareza) dentro do modelo online.

## Próximo passo

Detalhar o **sub-projeto #1** (servidor fonte da verdade + tick híbrido) no fluxo normal:
brainstorm → spec → plano → implementação. É a fundação; os outros dependem dele.

## Riscos / pontos a resolver no #1
- Onde roda o cron (Supabase pg_cron vs Vercel cron) e a frequência do tick.
- Determinismo e idempotência do tick (retries não podem duplicar efeitos).
- Migração do `imperial_state` (sandbox client) → estado autoritativo de servidor sem perder progresso.
- Concorrência: tick do cron vs ação do jogador no mesmo instante (locks, já usados na RPC de billing).
