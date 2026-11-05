# Revisão integrada — 5 novembro 2026

## Decisões desta rodada

- Manter as cinco curvas de influência atuais. Corrigir primeiro as limitações dos bots: antes não ocupavam NPC hostil, não escolhiam tipos de cidade, limitavam Infraestrutura a seis cidades e contratavam heróis sem adequação ao foco. O bot de Infraestrutura agora escolhe obras pelo ganho marginal real e custo já pago/planejado. Não injeta recursos nem pontos.
- Cada foco deve ter retorno próprio, com renúncia em outras áreas. Não igualar resultados de todas as sementes nem conceder influência automática para compensar escolhas ruins.
- Manter bases gratuitas dos reis, soma 15, evolução até 24 e teto de 10% por stat; três itens e os pequenos bônus atuais. Não vender distribuição mais forte que as iniciais. XP pertence ao rei, sem nível de conta, com stats congelados por reinado.
- Manter cooperação e torre opcionais, com teto conjunto de 15% no mesmo efeito. Torres não dão influência diretamente nem são requisito de vitória. Mérito de ajuda tem teto e depende de evento útil.
- **Ajuste real do combate:** novas investidas PvP incluem 12h de preparação além do deslocamento de ida e volta. Distância mantém custo e prazo, baixas mantêm atrito e a defesa mantém fortificações. Nenhuma seleção de tropas, aposta separada ou novo escudo. Bônus reduzem só deslocamento. UI e servidor usam a mesma função, incluindo limite de término da temporada; ordens antigas conservam horários.
- Manter parâmetros NPC distintos, conforme as regras atuais. O ensaio econômico Cozy não é prova de temporada PvP equilibrada.

## Economia com o motor real

94 mundos/470 trajetórias de bots em configurações pareadas, incluindo Expresso e dois mundos Normal. Recursos de início/produção/ações reais, com decisões, filas, tipos, recrutamento, alianças, torres e hordas. São repetições controladas, não 470 pessoas independentes. O maior total observado foi 2329. O consolidado exige total igual à soma das cinco áreas, cada área ≤500, recursos não negativos e selo quando o total final é ≥1500.

Focos: três sementes, inicial/veterano, seis trajetórias por linha; mesmas visitas e contexto por par. O delta é na área escolhida contra o equilibrado correspondente.

| Foco | Total médio | Faixa final | Ganho médio na própria área |
|---|---:|---:|---:|
| Equilibrado | 1587 | 1481–1753 | — |
| Infraestrutura | 1531 | 1389–1748 | +29 |
| Governo | 1614 | 1430–1936 | +18 |
| Militar | 1577 | 1436–1817 | +176 |
| Conselho | 1598 | 1478–1818 | +94 |
| Conquistas | 1620 | 1400–1821 | +48 |

O intervalo entre médias de foco foi 89 pontos (cerca de 5,6% do equilibrado). Infraestrutura ficou 56 abaixo do equilibrado (3,5%), mas subiu na própria área em todos os seis pares. Militar ganhou bastante na própria área e cedeu nas outras. Governo não superou seu par em toda semente. Isso não justifica outro buff global neste momento; continua sendo uma amostra pequena de políticas de bot.

Comportamentos comparados nas mesmas sementes 55/88, rei inicial e foco equilibrado:

| Perfil programado | Visitas médias em 30 dias | Influência final média | Faixa |
|---|---:|---:|---:|
| Casual competente | 14,5 | 1502 | 1481–1523 |
| Diário competente | 27,5 | 2027 | 1993–2061 |
| Frequente, decisões piores e cuidados omitidos | 26 | 1539 | 1493–1584 |
| Ausente | 8,5 | 646 | 634–657 |

O frequente descuidado ainda pode vencer: frequência e ajuda compensam algumas escolhas. Não manipular resultados para obrigar esse bot a ficar abaixo de 1400. Faltam pessoas reais para definir competência, frequência e proporções da população. A meta de 60–65% não está comprovada por esses pares.

## Reis, equipamentos e cooperação

32 mundos adicionais no conjunto: oito configurações, duas sementes e dois lugares de nascimento. Contra o inicial equilibrado, as configurações veteranas ficaram entre +0,05% e +1,22% de ganho médio; melhor par individual de veterano: +4,91%. Uma base gratuita de Exploração teve +9,76% em um par. Limiares e caminhos afetam o resultado; não se trata de vantagem percentual fixa ou prova de ausência de meta.

Nas sementes 55/88 e duas configurações pareadas de stats/equipamentos: aliança+torre 1505 de média; aliança sem torre 1454; solo 1433. Um solo chegou a 1554. Mostra que selo solo existe nesse ensaio e que cooperação ajuda, mas quatro casos não comprovam facilidade equivalente. Dois mundos Normal deram 1795/1803 no focal; isso é verificação de compatibilidade de duração, não calibração completa do Normal.

Premium permite mais reinados simultâneos, portanto pode acelerar XP/Gemas da coleção por calendário. Não altera a recompensa ou força de uma mesma ação/mundo; congelar o reinado impede aplicar evolução no meio da temporada. Esta vantagem de volume existe e não deve ser descrita como ausente. As bases mais especializadas já estão entre os quatro gratuitos, e os bônus veteranos/itens permanecem limitados.

## Combate e limites da evidência

72 fixtures de meio de jogo com tropas/níveis pré-montados, estoque inicial legal e produção/recrutamento/reparos reais por sete dias. Nenhuma captura nas 24 respostas de 24h ou nas 24 de 48h; oito capturas nas 24 respostas de 72h, a primeira após 55h. Isso testa ritmo, não viabilidade econômica de montar os exércitos nem ataques coordenados de múltiplos rivais.

Stress de distância 1/5/15, exército/estoque pré-financiados, janela 72h: 5/4/2 investidas completas, 38/70/150 suprimentos por envio e 267/220/117 milícias perdidas. O ataque próximo tem mais frequência, mas não é gratuito e não se repete de hora em hora.

Ainda falta playtest humano de Expresso completo, amostra maior de solo/Normal e conflitos multiatacante. Não declarar equilíbrio final, taxa real de vitória ou experiência em aparelho comprovados por esses ensaios. Sem Supabase remoto, publicação, pagamentos ou AAB nesta rodada.

## Reprodução e evidências

- `simulations/balance-royal-equipment.mjs`: opções `META_VARIANTS`, `META_FOCUS`, `META_SEEDS`, `META_SEAT`, `META_PROFILE`, `META_COOP`, `META_TOWERS`, `BOT_POLICY`. Execução padrão antiga preservada; revisão usa `review2`. Exemplo PowerShell para repetir um par: `$env:BOT_POLICY='review2'; $env:META_SIZE='5'; $env:META_SEEDS='55'; $env:META_LABEL='repro'; node simulations/balance-royal-equipment.mjs`. As outras opções ficam com os padrões do script.
- `simulations/summarize-integrated-balance.mjs`: consolida os arquivos `royal-equipment-review*.json` produzidos nesta rodada; revalida invariantes, sem recalibrar para forçar uma taxa.
- `reports/cozy/integrated-balance-review.json`: métricas/escopo do conjunto revisado.
- `simulations/balance-player-campaign.mjs` e `reports/cozy/player-campaign-balance.json`: resposta defensiva.
- `simulations/test-pvp-distance-cost.mjs` e `reports/cozy/pvp-distance-cost.json`: custo, distância, baixas e dano real.
- Testes de exército único, ida/retorno, perda da capital, território, estruturas e finalização permanecem na suíte `test:cozy`. O teste de exército único também verifica preparação constante com bônus máximos de viagem e igualdade do orçamento real com a cotação.

## Validação final desta rodada

PASS: suíte local `npm run test:cozy`, teste adicional de preparação com todos os redutores de viagem, TypeScript e build de produção. PASS: 40 cenários integrados via HTTP, motor real e PostgreSQL/PGlite local, incluindo toque em 320/390 px, ameaça recebida, dano persistido, captura, sucessão de capital, exploração e recompensas finais idempotentes. Os cenários de chegada usam relógio controlado/adiantamento de ordens; a duração real é conferida nos testes específicos. Não é prova de 30 dias em aparelho físico nem de Supabase remoto.

Logs: `reports/cozy/review-final-suite.txt`, `review-final-typecheck.txt`, `review-final-build.txt`, `review-final-http.txt`; resumo em `reports/cozy/integration.json`. Revisão visual do print de ameaça em 390 px confirma destinatário/ETA e botão de cuidado; não representa aprovação estética de todo o aplicativo.

---

## Registro anterior, preservado para comparação

Os números abaixo pertencem à rodada anterior, com bots e escopo diferentes. Não substituir o consolidado acima nem somar como população independente.

# Rodada local de balanceamento — 4 novembro 2026

## Decisões implementadas

- Todos os 22 reis começam com soma 15, limite de 10% por stat. Nível máximo 10 concede nove pontos adicionais, orçamento final 24. Não existe nível de conta.
- Quatro iniciais: 5/5/5, 8/4/3, 3/8/4, 4/3/8. Todas as especializações máximas de base já existem gratuitamente. Colecionáveis oferecem outras distribuições e visuais.
- Os quinze itens têm 455 combinações de três itens diferentes. Máximos por efeito: 4% materiais, 4% suprimentos, 4,5% defesa ou 4,5% redução de viagem. Estes máximos não são simultaneamente atingíveis pelo mesmo conjunto. Nenhum concede influência diretamente.
- XP pela maior influência já atingida no mundo: um por cinco pontos no Expresso e quatro no Normal. Perder e recuperar não gera XP; sucessão não reinicia o marco. O crédito é do rei escolhido e os stats do mundo permanecem congelados.
- Curva: nível = mínimo(10, 1 + piso(raiz(XP/25))). Primeiro avanço com 25 XP; nível 10 com 2.025 XP. Um Expresso com marca de 1.500–2.200 fornece 300–440 XP: cinco a sete temporadas desse rendimento para chegar ao teto. Normal fornece quatro vezes o XP em quatro vezes a duração. Esta é calibração inicial, não retenção comprovada.
- Novos pactos de torre complementam um projeto de aliança do mesmo efeito: 10% isolado, até 15% juntos. Pactos antigos mantêm a regra anterior, sem alteração retroativa.
- Ocupação de aldeia usa a força na chegada antes das baixas do combate, respeitando a margem exibida. As baixas continuam existindo.

## Evidência

56 mundos locais completos: 20 comparações de configurações no Normal/Expresso, 24 com focos diferentes e uma validação separada de 12 Expressos com cinco participantes. Motor real, recursos produzidos, alianças, torres e decisões estocásticas. A última rodada utiliza as novas regras de torre; as duas anteriores são referências anteriores à mudança, não devem ser misturadas como uma única população.

Validação separada, semente 33, pontuação do bot casual alvo:

| Foco | Inicial | Veterano equilibrado |
|---|---:|---:|
| Equilibrado | 1855 | 1838 |
| Infraestrutura | 1906 | 1906 |
| Governo | 1785 | 1675 |
| Militar | 1777 | 1829 |
| Conselho | 1875 | 1882 |
| Conquistas | 1894 | 1904 |

Especialistas militares e do conselho atingiram 500 na área nesta semente. Infraestrutura e Governo não chegaram ao teto. Governo continua candidato a investigar: foco aumenta pouco sua própria área e sacrifica outros ganhos; não foi concedido um bônus artificial para esconder isso. Veteranismo não melhorou todas as partidas: decisões e gargalos mudam o caminho do bot. Isso não prova ausência de estratégia dominante nem estima os 60–65% de vitoriosos pretendidos.

Rodada adicional de Governo: 12 Expressos, cinco participantes, sementes 33/44/55. O bot especialista passou a priorizar pesquisas antes de novas anexações. Média total inicial: equilibrado 1.758,7 e Governo 1.733,3; veterano: equilibrado 1.727,7 e Governo 1.798,3. Na semente 33 o especialista concluiu as vinte pesquisas, enquanto o equilibrado concluiu treze; manteve cinco cidades contra seis. Ainda existe uma troca real entre pesquisa e expansão, sem um aumento artificial de influência. Relatório: `royal-equipment-government-v3.json`.

Prêmios locais da migração 70: cinco Gemas por participação com 500+ pontos, mais dez por vitória; bônus de colocação 3/2/1 entre pelo menos cinco humanos participantes. Gemas multiplicadas por quatro no Normal. Equipamento **não** recebe esse multiplicador: até um por vitória em qualquer duração; a colocação define a raridade conforme EQUIPAMENTOS-SOBERANO.md. Tier completo converte o prêmio em duas Gemas. Os limites de preço/recompensa continuam provisórios.

Testes locais passaram: suíte completa `test:cozy`, TypeScript, comparação legal de stats, limiar real de ocupação e auditoria das 455 combinações. Dois testes antigos presumiam cidade inicial no nível 1; fixtures foram corrigidas para o início atual em zero, preservando o objetivo dos testes.

Detalhes reproduzíveis: `reports/cozy/king-equipment-audit.json`, `royal-equipment-paired.json`, `royal-equipment-focus.json`, `royal-equipment-holdout-v2.json` e `balance-full-test.txt`.

## Ainda não fechado

1. Bônus de XP por colocação no encerramento está implementado e aplicado no Supabase pela migração 73: 10%/5% sobre o XP real por rei para melhores 25%/50%, com cinco humanos elegíveis. Regras completas em PREMIOS-TEMPORADA.md. O candidato de XP por ranking DURANTE a partida não foi ativado. A 73 passou em PostgreSQL/PostgREST reais; análise de mundos combinados continua pendente.
2. Validar mais sementes, automações de Governo, combinações de cinco jogadores e efeito de cinco mundos Premium no acúmulo da coleção.
3. Prêmios de Gemas/itens funcionam localmente, com recibos no inventário, idempotência e permissões testadas. Pagamentos, anúncios, aparelho e AAB continuam para etapas posteriores.
4. Migrações 67–70 não foram aplicadas remotamente nesta rodada. Nova tentativa de preflight read-only no projeto correto retornou 403 por falta de privilégio no endpoint. Os resultados acima são locais.

## Rodada local de expedições — 04/11/2026

Nova comparação: 24 Expressos de 30 dias, cinco bots por mundo, sementes 11/29, seis focos e configurações inicial/veterana. Usa motor real, recursos produzidos, alianças e torres compartilhadas. Os focos do bot são validados para impedir que um nome inválido passe silenciosamente por equilibrado. Resultados em `reports/cozy/roundtrip-balance-summary.json`; fontes `royal-equipment-roundtrip.json` (excluindo as linhas antigas de foco `legacy`) e `royal-equipment-roundtrip-conquests.json`.

| Foco do bot casual alvo | Inicial, sementes 11 / 29 | Veterano, sementes 11 / 29 |
|---|---:|---:|
| Equilibrado | 1683 / 1505 | 1630 / 1479 |
| Infraestrutura | 1446 / 1532 | 1491 / 1514 |
| Governo | 1766 / 1429 | 1766 / 1435 |
| Militar | 1705 / 1326 | 1766 / 1348 |
| Conselho | 1712 / 1505 | 1705 / 1505 |
| Conquistas | 1706 / 1417 | 1813 / 1471 |

Entre os 120 resultados, 75 tiveram selo; influência variou de 1199 a 2116. Esse 62,5% é apenas desta amostra pareada, não estimativa da população. As sementes mudam os gargalos e veteranos não vencem toda comparação. Infraestrutura e Governo continuam sensíveis à expansão e às escolhas do bot: esta rodada não demonstra igualdade das estratégias nem encerra o balanceamento. Nenhuma curva recebeu bônus artificial para aproximar os resultados.

PvP foi verificado separadamente, pois os bots cooperativos acima não atacam jogadores. Em um stress pré-financiado, 1000 milícias contra alvo fraco, sem reposição, com rei 5/5/5: distância 1 permite 25 viagens completas em 24h e perde 794 tropas; distância 5 permite cinco e perde 267; distância 15 permite uma e perde 60. Cada envio cobra respectivamente 38/70/150 suprimentos. A distância custa mais por envio, mas a frequência cai; o desgaste acumulado perto do alvo também importa. Esses números não provam viabilidade econômica nem proteção automática do fraco. Fonte: `reports/cozy/pvp-distance-cost.json`.

Regras atuais: exército único, sem retirada da defesa nem seleção de quantidade; ida/volta bloqueiam apenas nova investida; baixas descontadas uma vez na chegada, combate arredondando baixas para cima, saque de estoque existente limitado e transportado até voltar. Não há aposta adicional de influência. Derrota reduz níveis reais e recalcula Infraestrutura; não desconta pontos fictícios. Exploração revela caminho e faixa sem anexar ou conceder múltiplas recompensas.
