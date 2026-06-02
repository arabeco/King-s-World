# Design: Ações Importantes Não Ficam Escondidas (vocação, herói, conselho)

Data: 2026-06-02
Status: aprovado (design) — aguardando spec review
Relacionado: `2026-06-01-progressao-fluida-design.md` (rebalance multi-pilar — item 1 ficou pendente)

## Problema

Ações importantes ficam **passivas e fáceis de não notar** — o jogador pode jogar a run
inteira sem perceber que podia agir:

- **Vocação da cidade:** nasce `neutral`, especializar é um botão no header que cicla pelas
  classes. O rebalance multi-pilar (cada build defende por um pilar) **só importa se o
  jogador escolher uma vocação** — e muitos ficam `neutral` sem saber que havia escolha.
- **Contratar herói:** o slot fica enterrado na visão da cidade; nada chama atenção quando
  o jogador já pode contratar.
- **Conselho/Senado:** uma reunião ativa (`senate.activeMeeting`) espera decisão, mas fica
  no painel do Império sem destaque forte.
- **Inconsistência:** fundação em ruína (`frontier_ruins`) nasce com classe **travada**
  semeada pelo jogo, enquanto as outras nascem `neutral`.

## Solução (decisão do dono)

**Sem modal, sem badge global, sem sistema novo.** Cada ação ganha um **destaque visual
local** — no próprio lugar onde ela já está — que pulsa/chama atenção **quando há algo a
decidir**, e some quando resolvido. O jogador vê a oportunidade no instante em que abre a
tela onde ela mora.

## Estado atual (auditado em 2026-06-02)

- **Desenvolvimento** 0–100: `calculateVillageDevelopment` soma 5 setores, cada `nível×2`
  cap 20. (`core/GameBalance.ts`)
- **Vocação** (`cityClass`): `neutral` | `metropole` | `posto_avancado` | `bastiao` |
  `celeiro`. O seletor está no header da visão da cidade (`components/Header.tsx`):
  `cycleCityClass` cicla, `saveMeta` salva, `cityClassLocked` trava. Editável enquanto não
  travada.
- Fundação em `frontier_ruins` auto-trava classe (`StrategicMap.tsx` ~787-820,
  `seededClass`/`shouldLockClass`).

## Mudanças

### 1. Seletor de vocação destacado quando a cidade amadurece
- Quando a cidade ativa é `neutral` **e** desenvolvimento ≥ **35/100**, o seletor de
  vocação no header entra em estado **"precisa decidir"**: animação de pulso/glow + um rótulo
  curto tipo *"Escolha a vocação"*.
- O destaque some assim que o jogador escolhe e trava.
- Abaixo de 35 ou já travada: seletor normal (como hoje).
- **Escolha fixa pra sempre** (a diferença mecânica é leve; não justifica re-especialização).
- Toca: `components/Header.tsx` (estado visual do seletor), usa
  `calculateVillageDevelopment` da village ativa.

### 2. Toda cidade nasce neutral (remover auto-lock)
- Fundação em `frontier_ruins` **deixa de auto-travar** classe semeada. Toda cidade —
  fundada, anexada, ruína — nasce `neutral` e o jogador decide via o seletor destacado.
- Toca: `StrategicMap.tsx` (~787-820, remover `seededClass`/`shouldLockClass`,
  `cityClassByVillage`/`cityClassLockedByVillage` no momento da fundação).

### 3. Herói: destaque no slot quando pode contratar
- Na visão da cidade, o slot/botão de herói **pulsa** quando `canHireHero` é true
  (`assignedHero === "none" && governmentLevel >= 4 && hiredHeroCount < limite && tem
  recursos`). O jogador vê "dá pra contratar herói aqui" sem caçar.
- Some quando contrata ou quando deixa de poder (sem recursos / limite atingido).
- Toca: `components/base/VillageScene.tsx` (estado visual do slot, usa `canHireHero` que já
  existe na linha ~882).

### 4. Conselho: destaque quando há reunião ativa
- Quando `senate.activeMeeting` existe, o painel/entrada do conselho (tab Império) ganha
  **destaque de pendência** (pulso + rótulo "Decisão do conselho"). Some ao resolver.
- Toca: `components/base/KingdomOverviewPanel.tsx` (estado visual quando
  `imperialState.senate.activeMeeting` está presente).

### 5. Clareza do trade-off (leve)
- Ao destacar/abrir o seletor de vocação, mostrar de forma curta o que cada vocação
  **defende por** (reusa os pilares já feitos): Metrópole→maravilhas+heróis, Posto→tropas,
  Bastião→muralha, Celeiro→suprimento. Tooltip/legenda mínima, não um painel.

## Critérios de sucesso

- Abrir uma cidade `neutral` madura (≥35) mostra o seletor de vocação a pulsar.
- O slot de herói pulsa quando dá pra contratar; some ao contratar.
- O conselho destaca quando há reunião ativa; some ao resolver.
- Escolher vocação trava pra sempre; fundação em ruína não auto-trava mais.
- Sem regressão no smoke/typecheck.

## Fora de escopo (ciclos próprios)

- **Cidades abandonadas de tamanhos variados** (porte pequeno/médio/fortaleza, defesa
  proporcional, fortaleza só por combate) — é design de mapa, merece o seu próprio spec.
- Re-especialização paga / trocar capital / mover rei (continuam pendentes).
- Badge de decisões na navegação / unificar herói+conselho+vocação num hub (ideia maior,
  adiada — o dono preferiu a solução local na visão da cidade).

## Pontos abertos de tuning

- Limiar exato (proposta: 35/100 — cedo pra decidir antes de investir pesado, tarde o
  suficiente pra ter contexto).
- Forma do destaque (pulso de borda, glow, badge "!" no seletor) — definir na implementação.
