# King's World: regras do jogo

Documento para quem não conhece o jogo, inclusive IA. Os números foram conferidos no código em 28/10/2026 (`core/GameBalance.ts`, `components/board/`, `lib/empire-systems.ts`, `lib/cities.ts`). Os docs de design antigos (março e abril) não foram usados como fonte: estão defasados. Se uma regra não estiver aqui, não invente. Diga que ela não está documentada. A seção 8 lista o que o código ainda não cumpre. A seção 9 descreve a direção nova do jogo (Outubro/2026), ainda não implementada: onde ela contradiz as seções 1 a 8, ela é o alvo.

## 1. Resumo

Você comanda um reino em uma temporada. Ganha **Influência** (um placar de 0 a 2500) cuidando de **cinco áreas**, expande explorando o **mapa** e disputa com outros jogadores e com NPCs ("jogadores IA"). O clímax é entrar no **Portal Central** na **Fase 4**, com 1500 ou mais de Influência.

## 2. Termos

- **Temporada**: uma partida. Clássica (120 dias) ou expressa (30 dias).
- **Dia de jogo**: no clássico, 24 h reais. No expresso (velocidade ×4), 6 h reais.
- **Capital**: sua primeira cidade.
- **Colônia**: cidade fundada ou conquistada. Limite de 10 cidades por jogador.
- **Setor**: cada cidade tem 5 setores (Coroa, Economia, Sociedade, Recrutamento e Defesa), cada um de nível 0 a 10 (seção 4).
- **Portal Central**: o trono, no centro do mapa (coordenada 0,0).
- **Expedição**: equipe de tropas que sai de uma cidade para explorar ou atacar.
- **Senado**: reuniões que pedem decisões. A satisfação do Senado conta na área Sociedade.
- **Rei**: escolhido no começo. Dá bônus e penalidades pequenas em algumas áreas.
- **Especialista**: herói designado a uma cidade (seção 4).
- **Diplomata**: agente que anexa cidades vazias.

## 3. Influência: as 5 áreas

Influência é a soma das cinco áreas. Máximo 2500. O Portal exige 1500 ou mais.

| Área | Máx. | O que é | Como ganha pontos |
|---|---|---|---|
| **Infraestrutura** | 1000 | A economia do reino. Os prédios produzem materiais e suprimentos. | Soma dos níveis de todos os setores de até 10 cidades, × 2. |
| **Governo** | 500 | Os heróis que governam. | 50 por especialista designado a uma cidade (até 10). |
| **Militar** ("Força militar") | 400 | Exército e defesa. Decide ataques e defesas. | Poder das tropas (até 200) e da defesa (até 200), ambos × 0,8; níveis de Recrutamento (× 1,4); níveis de Defesa (× 1,2); 12 por doutrina militar; +30 se o dragão foi escolhido. |
| **Sociedade** | 300 | O povo: moradia, emprego, estabilidade e Senado. | Satisfação do Senado (até 130) + população em relação à moradia (até 90) + empregados (até 80) + cidades sem ataque (até 50). A soma vai até 350, mas a área para em 300. |
| **Legado** | 300 | Marcos de longo prazo. | Até 3 missões de era (100 no total) + maravilhas (50 cada, até 2) + lealdade da tribo (até 100). |

- Influência não se gasta. Ela sobe e desce conforme as áreas.
- Cidade sob ataque derruba a área Sociedade.

## 4. Cidades, setores e especialistas

**Setores e prédios** (cada setor vai de nível 0 a 10):
- **Coroa**: Palácio, Senado.
- **Economia**: Minas, Fazendas, Estradas.
- **Sociedade**: Habitação, Centro de Pesquisa.
- **Recrutamento**: Quartel, Arsenal.
- **Defesa**: Muralha.

**Regras das cidades**
- **Desenvolvimento**: soma dos cinco setores, cada um contando até 20 (nível 10 = 20). Máximo 100. Uma **maravilha** exige cidade com desenvolvimento 100.
- **População máxima**: nível de Sociedade × 10 (máximo 100).
- **Tropas do Quartel**: Milícia no nível 1 de Recrutamento, Atiradores no 3, Batedores no 5, Maquinaria no 7.
- **Defesas da Muralha**: Guardas no nível 1 de Defesa, Arqueiros no 4, Balistas no 7.
- **Classe** (especialização): Neutra (sem especialização); Metrópole (economia e pesquisa); Posto Avançado (fronteira e resposta militar); Bastião (muralha e defesa sob horda); Celeiro (suprimentos e campanhas longas).
- **Terreno** e classe recomendada: Coração da Coroa → Metrópole; Várzea dos Rios → Celeiro; Passagem de Fronteira → Posto Avançado; Escarpa de Ferro → Bastião; Campos de Cinza → Neutra.
- **Humor social** (colapso, pressão, estável, alta, radiante): cada cidade tem o seu. Humor alto dá mais produção e defesa. Moradia cheia, falta de emprego, ataque e falta de recursos derrubam o humor.

**Especialistas** (heróis designados às cidades; contam para Governo):
- **Engenheiro**: acelera obras.
- **General**: melhora ataque, moral e combate. Obrigatório para conquistar cidade de outro jogador (seção 7).
- **Explorador**: revela o mapa, abre rotas e reduz o tempo de deslocamento.
- **Administrador**: organiza suprimentos, comboios e fluxo interno.
- **Sábio**: acelera pesquisa, doutrina e legado.

**Diplomatas**: contratados na aba Heróis, liberados em cidades com desenvolvimento 60 ou mais. Até 9 para cidades e 2 para enviados tribais. Anexar uma cidade vazia exige um diplomata livre.

## 5. Mapa e explorar território

**O mapa** é uma grade hexagonal de 81 × 81. O Portal fica no centro. A distância do centro define a zona: **núcleo**, **médio** e **externo** (borda).

**Território desconhecido** começa escondido. Antes de construir, atacar ou anexar um ponto, você precisa conhecê-lo.

**Explorar**
- Escolha um ponto desconhecido. A expedição sai da cidade que você está gerindo.
- **Custo em suprimentos** = 40 + 12 por hexágono do caminho + taxa da zona (núcleo 12, médio 26, externo 44) + taxa do terreno (Passagem de Fronteira 18, Escarpa de Ferro 24, Campos de Cinza 12, outros 0).
- **Tempo** = 45 min por hexágono sem estrada, ou 15 min com estrada. Terreno e modificadores do rei ajustam.
- A equipe de tropas fica ocupada durante a viagem. Sem suprimentos suficientes, a expedição não sai.

**O que a expedição encontra**
- **Território conhecido**: vazio e sem ameaça. É o mais comum.
- **Oportunidade**: bom lugar para fundar cidade (bônus de fundação).
- **Ruínas antigas**: fundação possível, risco leve.
- **Ameaça**: saqueadores (risco médio) ou presença demoníaca (risco alto). Vira alvo militar.
- **Dragão**: evento raro, risco extremo. Escolher fogo ou gelo dá +30 em Militar.
- **Cidade inimiga**: aparece no caminho e mostra presença hostil.
- **Cidade vazia**: sem dono ativo. Não é conquista automática. Dá para anexar com diplomata.
- **Pontos especiais**: Oásis, Ruínas e Mina Rara.

**Depois de conhecer o ponto**
- **Fundar cidade**: só em terreno vazio, ponto especial livre ou ruína instável, e ligado à **Malha Viária** (rede de estradas) do seu reino.
- **Atacar**: cidade inimiga ou cidade vazia, ambas conhecidas.
- **Anexar**: só cidade vazia, com diplomata livre.
- **Estradas**: ligam as cidades e reduzem o tempo de marcha.

## 6. Calendário, fases e Portal (clássico, 120 dias)

**Fases**
- Dia 0: preparação.
- **Fase 1, Consolidação**: dias 1 a 20.
- **Fase 2, Expansão**: dias 21 a 60.
- **Fase 3, Fortificação**: dias 61 a 90.
- **Fase 4, Êxodo**: dias 91 a 120.

**Marcos**
- Dia 30: Pacto da tribo.
- Dia 60: Câmara da tribo.
- Dia 65: mandato do Portal.
- Dia 70: pressão do Portal.
- Dia 91: começa a Fase 4. O Portal libera e "Reagrupar Império" fica disponível.
- Dias 20, 40, 60, 80, 98 e 110: ondas de ataque de NPCs (calendário de ameaças). O dia 110 é o pico da horda.

**Portal (Fase 4)**
- Requisito: 1500 de Influência ou mais, e Fase 4.
- Para marchar, ative **Reagrupar Império**. Com ela, a marcha fica 5 vezes mais rápida.
- Se a Influência cair abaixo de 1500 até a expedição chegar, a entrada falha.
- Não se constrói, ataca nem anexa no Portal.

## 7. Tribo, eliminação e fim de temporada

**Tribo** (lealdade de 0 a 100, conta no Legado). São cinco degraus de 20:
1. Primeiro enviado tribal.
2. Dia 30 (Pacto), com enviado.
3. Dia 60 (Câmara).
4. Dia 91 (Fase 4).
5. Dia 91 com dois enviados.

Se o rei morre, a lealdade vai a 0.

**Eliminação**
- Você é eliminado se perder a Capital. Isso acontece quando outro jogador a conquista com um ataque que inclui um General.
- Para conquistar uma cidade de jogador, o ataque precisa ter um General e sobreviventes de pelo menos 2 vezes o tamanho da cidade (soma dos níveis dos setores).
- A cidade conquistada vira Colônia do atacante.

**Fim de temporada**
- Pelo código de resultado, quem fica em 1º no ranking final vence. Os demais que sobreviveram ficam como "sobreviveu".
- O fim não é automático (seção 8).

## 8. O que o código ainda não cumpre

Não trate estes itens como regra confirmada.
- **Expresso**: a temporada tem 30 dias, mas o Portal só abre no dia 91, e a Câmara é no dia 60. Pelo código, o Portal nunca abre no expresso. "Reagrupar Império" já aparece no dia 23 nesse modo, mas a marcha ao Portal exige o dia 91.
- **Entrar no Portal** aparece na tela, mas o servidor não registra. Por isso o resultado de vitória não depende disso.
- **Fim automático**: nada no código finaliza o mundo no dia 120. Só a rota de teste faz isso.
- **Tribo**: o texto do jogo fala em 200 pontos da Tribo, mas o cálculo dá no máximo 100.
- **Ataque**: o ataque real chega em 2 minutos (tempo fixo no servidor), mas a tela mostra tempo de marcha de 45 ou 15 minutos por hexágono.
- **Descobertas**: o que aparece num ponto explorado é calculado na tela. O servidor só registra que a expedição chegou.
- **Início do mundo**: "agendar para meia-noite" pode não ativar no banco. Ver `docs/ARQUITETURA_ATUAL.md`, ponto 3.

## 9. Novo estilo de jogo: Cozy Strategy, Coop e reestruturação do core (Outubro/2026)

Para eliminar a complexidade excessiva das planilhas, o microgerenciamento logístico e o estresse do PvP tradicional, o King's World foi reestruturado para um formato focado em experiência cozy, coop PvE e imersão narrativa.

Esta seção é o alvo. Ainda não está implementada: a tabela 9.4 mostra o que já existe no código.

### 9.1 Pilares

- **Coop PvE e fim do PvP tóxico.** O PvP agressivo de arena foi removido. O foco passa a ser a cooperação entre clãs e a defesa contra hordas de NPCs e eventos do mundo.
- **Exército universal na Coroa.** O exército fica "flutuando" no Centro do Reino (a Coroa). Você compra e recruta tropas pelo **Card Militar**, em blocos. Não precisa abrir cidade por cidade para treinar soldados, nem mover frotas ou tropas separadas pelo mapa.
- **Infraestrutura limpa nas cidades.** Gerenciar uma cidade serve para subir o nível dela, sem microgerenciamento de ações complexas. Isso gera recursos e, no futuro, responde a cartas de decisão locais.
- **Defesa sem deslocamento.** Quando hordas de NPCs atacam uma área dominada do seu reino, a força global do exército responde automaticamente. Você recebe um relatório de combate com o resultado: se segurou, ou se a infraestrutura sofreu danos. Não precisa reagir em tempo real nem dividir tropas.
- **Mapa por áreas e cores.** A expansão é limpa e visual. O mapa hexagonal revela regiões e muda de cor: amarela ao anexar, verde ao dominar totalmente. A exploração é passiva: você clica em revelar e o tempo avança de forma transparente.
- **Pesquisas independentes.** A aba de pesquisas (tecnologias militares e evoluções) tem fluxo próprio, separado da gestão de heróis na Sala do Trono. Alocar um Sábio ali acelera o progresso.
- **Influência balanceada (0 a 2500).** O placar total é dividido em 5 áreas de 0 a 500 cada (seção 9.2).
- **Galeria de Reis e fim de temporada (O Êxodo).** Na Fase 4, os jogadores cooperam para chegar a 1500 ou mais de Influência e cruzar o Portal Central (seção 9.3).

### 9.2 Influência: as 5 áreas (0 a 500 cada)

**1. Infraestrutura (0 a 500)**
- Estrutura básica: até 10 cidades (1 Capital permanente e 9 colônias). Cada cidade tem 5 setores de nível 0 a 10 (Coroa, Economia, Sociedade, Recrutamento e Defesa).
- Fluxo sem microgerenciamento: entrar na cidade serve para subir os setores (ou não) e, no futuro, responder a eventos e decisões locais. Não há botões complexos por prédio.
- Pontuação: soma dos níveis dos setores, escalada para o limite de 500.
- Classes de cidade e produção: Metrópole, Celeiro, Posto Avançado e Bastião definem o foco produtivo dos recursos essenciais (**Ouro**, **Alimento/Suprimentos** e **Materiais de Construção**), sem rotas nem frotas de transporte.
- Customização visual: skins de castelo, decorações e cosméticos desbloqueados nas temporadas.

**2. Governo (0 a 500)**
- Sala do Trono e especialistas: painel com 10 slots (General, Engenheiro, Administrador, Explorador e Sábio).
- Pontuação: cada especialista designado a uma cidade vale 50 pontos de Influência (10 slots = 500).
- Aba de pesquisas: as pesquisas tecnológicas e militares têm aba própria no menu de Governo, independente dos heróis.
- Papel do Sábio: com um Sábio designado no conselho, as pesquisas aceleram. Sem Sábio, seguem no ritmo padrão.
- Diplomatas: agentes contratados à parte (liberados com desenvolvimento 60 na cidade) para anexar territórios vazios no mapa.

**3. Militar (0 a 500)**
- Exército universal, centralizado na Coroa: as tropas não ficam presas nas cidades nem andam pelo mapa. O recrutamento é feito pelo Card Militar, na tela principal ("flutuando na Coroa"), em lotes: [+1], [+5] e [Máximo].
- Combate e hordas simplificados: áreas dominadas mudam de cor (amarela ou verde). Quando uma horda NPC ataca, você não move tropas. O sistema calcula a batalha contra o poder global do exército e gera um relatório com os estragos ou a vitória.
- Composição: ataque e apoio (Milícia, Atiradores, Batedores e Maquinaria); defesa de muralha (Guardas, Arqueiros e Balistas).
- Pontuação: poder de combate total do exército, mais as defesas da muralha, mais bônus de doutrinas e eventos raros (o Dragão soma +30).

**4. Sociedade e Senado (0 a 500)**
- Mesa do Rei e avatares: a interface mostra a mesa de decisões, com o Rei ao centro e 2 a 3 avatares de conselheiros.
- Cartas de decisão humana: notificações abrem dilemas morais, sociais e econômicos do reino, com escolhas em formato de decretos.
- Efeito suspense: o impacto na Satisfação do Senado e no Humor Social (colapso, pressão, estável, alta, radiante) só é revelado depois que o jogador assina o decreto.
- Pontuação: ponderação entre a Satisfação do Senado, a taxa de moradia e emprego da população e a ausência de cidades sob ataque. Ataques de hordas reduzem essa pontuação temporariamente.

**5. Legado, Clã e Portal (0 a 500)**
- Marcos permanentes: painel com as Quests de Era (checklist de missões da temporada) e espaço para construir Maravilhas em cidades com Desenvolvimento 100.
- Cooperação e clã: lealdade e cooperação PvE entre aliados, para enviar suporte cooperativo contra ameaças e cumprir metas compartilhadas.

### 9.3 Fim de temporada: O Êxodo

- Na Fase 4 (dia 91, no clássico), abre-se o Portal Central (coordenada 0,0).
- Objetivo: acumular 1500 ou mais de Influência (soma das cinco áreas) para cruzar o Portal e garantir a evacuação do reino.
- Quem completa a jornada ganha o **Selo de Vitória**, troféus no **Hall da Fama** e cosméticos permanentes para a conta (skins de castelo, molduras e selos de cera), usáveis nas próximas temporadas.

### 9.4 Código hoje × novo modelo

Estado conferido no código em 28/10/2026 (busca por termos e leitura das regras).

| Tema | Código hoje | Novo modelo | Estado |
|---|---|---|---|
| PvP | Ataque a cidade de outro jogador, e raide de NPC contra jogador | Removido; coop PvE | a remover |
| Exército | Recrutamento pelo quartel de cada cidade; ataques saem da capital | Exército universal na Coroa, recrutado pelo Card Militar em lotes | não existe |
| Defesa contra hordas | Guarnição luta sozinha; ataque de NPC é ordem no servidor | Defesa automática pelo poder global, com relatório | parcial |
| Limites da Influência | 1000, 500, 400, 300 e 300 | 500 cada (total 2500) | diferente |
| Infraestrutura | Níveis × 2, até 1000 | Soma dos níveis escalada para 500 | diferente |
| Governo | 10 heróis × 50, até 500 | Igual | pronto |
| Militar | Cap 400 | Exército global, cap 500 | diferente |
| Recursos | Materiais e suprimentos | Ouro, alimento/suprimentos e materiais | Ouro não existe |
| Exploração | Expedição com equipe e suprimentos | Passiva: clica em revelar, o tempo avança | diferente |
| Cores do mapa | Cores de facção (inimigo e você) | Amarela (anexada) e verde (dominada) | não existe |
| Clã | A tela usa "Tribo" (e um rótulo diz "clã") | Clã, com lealdade e cooperação | parcial |
| Pesquisas | Pesquisa existe; aba própria no Governo não confirmada | Aba própria no Governo | não confirmado |
| Senado | Reuniões com decisões | Cartas com decretos e efeito suspense | parcial |
| Fim de temporada | Portal com 1500 na Fase 4 (só no cliente) | Igual, mais Selo, Hall da Fama e cosméticos | parcial |
| Cosméticos e Hall da Fama | Não existem; o lobby só menciona "cosméticos e reis desbloqueáveis" em texto | Skins, molduras, selos de cera e Hall da Fama | não existe |
| Sala do Trono | Não existe como tela | Painel de especialistas | não existe |
| Classe Neutra | Existe | Não aparece no texto novo | a confirmar |
