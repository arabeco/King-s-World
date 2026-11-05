# Perda, danos e território — estado de implementação

## Implementado localmente no Cozy

Cada hexágono anexado pertence a uma cidade do império. Na anexação de uma reserva, novos terrenos e o acesso à reserva são vinculados à cidade mais próxima do destino; empate usa ID estável. Terrenos anteriores sem vínculo recebem uma atribuição determinística. Fundar outra cidade não transfere automaticamente regiões existentes.

Perder uma colônia por horda ou separação libera a cidade e os terrenos vinculados a ela. Não libera terrenos de outras cidades, aliados ou terceiros. Remove o acesso próprio às reservas vinculadas, preservando acesso de aliados, estoque restante, levantamentos e caravanas já despachadas. O herói retorna; obras futuras pagas e não iniciadas são reembolsadas uma vez. Obras em andamento são perdidas.

O terreno perdido continua conhecido, sem virar crédito de exploração ou novos levantamentos. Na reconquista, níveis, tipo, nome e histórico de renomeação são conservados. Apenas terrenos ainda livres retornam. Cidades, território ou reservas assumidos por outro império, bem como distritos de torre, não são sobrescritos. O estoque de recursos nunca é recriado.

A cidade mostra a quantidade de hexágonos de sua região no resumo. Leituras de temporadas encerradas calculam o vínculo legado sem regravar o snapshot.

## Dano sem perda da cidade

Derrota contra horda mantém a redução de 25 pontos de integridade e as baixas atuais. Acrescenta perda de 1–3 níveis construídos conforme a diferença proporcional entre ataque e defesa: teto(3 × déficit / ataque), limitado a 1–3. Distribui um nível por setor, começando pelos mais desenvolvidos; empate: Defesa, Economia, Recrutamento, Administração, Sociedade. Setores zerados não recebem níveis negativos. Vitória não destrói edifícios.

Essa é calibração inicial de severidade, ainda sujeita ao balanceamento. O dano altera os níveis reais: Infraestrutura da cidade e do reino, produção, capacidade/custos e demais efeitos passam pelas mesmas fórmulas existentes. Não existe desconto separado de influência por integridade; evita penalizar duas vezes o mesmo nível. A pontuação agregada pode ter arredondamentos, pesos e tetos. Ataques que não destroem níveis não recebem uma perda artificial de pontos.

A fila paga preserva custo e horários; os níveis previstos são rebaseados após o dano. Duas obras pagas sobre nível 4, reduzido para 3 pelo ataque, terminam em 5, não em 6. Não cobra de novo, não duplica reembolso nem recria níveis destruídos.

Reparo por decisão recupera integridade e eficiência. Níveis destruídos exigem reconstrução pelos setores. Os relatos registram setores e níveis antes/depois, além da perda real de influência de Infraestrutura. Histórico de defesa da aliança acompanha os mesmos valores.

## Limite atual

No Cozy, a capital original e a última cidade continuam protegidas contra perda. Derrota extrema pode matar o rei, preservando a recuperação e a sucessão. O mapa atual não permite PvP.

A integração competitiva foi implementada localmente na rodada seguinte, conforme seção abaixo. A migração 74 foi aplicada em 04/11/2026: os três mundos remotos anteriores permanecem Cozy. Não apresentar PvP como publicado ou validado em aparelho real.

## Validação

Testes locais: domínio por cidade, duas causas de perda, anexação/reconquista real no motor, estoque/acesso, proteção de terceiros, filas e reembolsos, integridade versus reconstrução, produção/influência/capacidade, relatório com delta real e equivalência offline. Integração HTTP com banco PostgreSQL/PGlite confirma dano e posse depois de recarregar; 35 cenários completos passaram antes do acréscimo do delta numérico ao relato. Nova suíte funcional, TypeScript e build verificam o delta adicional.

Código local, sem publicação do app, migração de banco, ativação de PvP ou AAB nesta rodada.

## Núcleo competitivo de transferência — implementação local isolada

`conquerPlayerCity` reúne a transferência atômica dos dois estados e do estado compartilhado, depois de um combate resolvido com margem de ocupação de 25%. Exige mundo competitivo explícito, prazo válido, dono atual, ausência de aliança entre os envolvidos, herói livre e vaga no limite de dez cidades. Trabalha com cópias e recusa chamadas repetidas, fora do prazo e no Cozy. Não resolve deslocamento, dano ou baixas de combate por si só.

A cidade capturada conserva níveis, integridade, maravilha, tipo, nome e histórico de renomeação. Não transporta o herói do defensor. A região transferida segue o vínculo por cidade; reservas conservam estoque e respeitam direitos de terceiros. Obras ainda não iniciadas voltam ao antigo dono, sem creditar recursos ao conquistador.

Quando a capital cai com outras cidades disponíveis, a cidade mais íntegra (depois mais desenvolvida e ID) assume provisoriamente, com marca de escolha pendente. A escolha definitiva pelo jogador ainda não tem comando/UI. A última cidade registra derrota e cancela ordens para impedir renascimento por viagem antiga, mas não finaliza a temporada nem concede prêmios antecipados.

Essa etapa isolada foi substituída pela integração local descrita abaixo. Teste específico do núcleo: `npm run test:conquest`.

## Integração competitiva local — envio, chegada e derrota

Migração 74 prepara `worlds.combat_mode`, com padrão Cozy para todos os mundos existentes. Um RPC exclusivo do servidor cria mundo competitivo; o modo não muda depois do início, da primeira gravação de estado ou entrada de outro participante. A API recusa modo inválido e não converte silenciosamente um pedido competitivo em Cozy quando o RPC não existe. Aplicada e verificada remotamente em 04/11/2026.

O lobby distingue duração (Normal/Expresso) de confronto (Cozy/competitivo). Busca mostra a regra do mundo. No competitivo, uma cidade estrangeira reconhecida oferece ataque a estruturas e tentativa de ocupação; o card mostra suprimentos, chegada e retorno e exige herói para ocupar. Aliados e vagas NPC reservadas não oferecem ataque PvP. Reconhecer uma cidade estrangeira não gera ouro de NPC. A exploração por caminho está descrita abaixo.

O servidor registra a ordem com dono/ID da cidade e resolve os dois impérios juntos na chegada. Uma investida por vez; suprimentos são pagos no envio. Existe um único exército do império, sem seleção de quantidade ou destacamentos. Enviar a investida não retira tropas da defesa nem reduz influência. A investida ocupa apenas o direito de iniciar outro ataque até terminar a ida e a volta. As baixas são aplicadas ao exército real uma única vez na chegada. Poder e defesa reais são calculados na chegada, com stats e bônus. A força vencedora causa 25 de integridade e 1–3 níveis de dano, pelas regras estruturais existentes. Baixas: atacante 6%/20% e defensor 12%/2,5% quando o ataque vence/perde, arredondadas para cima por tipo com unidades presentes. Assim nem uma tropa pode combater indefinidamente sem baixas. Valores ainda sujeitos a calibração.

O vencedor recebe 4% do estoque de ouro e materiais do perdedor, limitado a 30 ouro e 120 materiais por combate; nunca há estoque negativo nem recursos gerados. Vitória do atacante deixa esse saque na expedição até o retorno; vitória defensiva credita no reino. Em novas investidas, a chegada inclui 12 horas de preparação mais o deslocamento; o retorno leva apenas o tempo do deslocamento. Rei, itens e pesquisa reduzem o deslocamento, sem reduzir as 12 horas. A ordem guarda os prazos; ordens antigas não são recalculadas. Recrutamento continua alterando o único exército. O retorno não soma tropas novamente; apenas conclui a investida e entrega a carga. O servidor recusa novo ataque antes da volta e envios sem tempo para ida e volta antes do fim da temporada. Ordens mostram fase, carga e chegada/retorno; o mapa distingue o caminho de volta. Relatos registram saque, baixas, integridade, níveis e perda real de influência de Infraestrutura.

Ocupar exige vitória, margem pré-baixas de 25%, integridade zero, herói ainda livre e capacidade de cidade. Assim uma cidade intacta normalmente precisa de várias investidas. O marco de chegada processa obras, hordas e eventos locais antes do PvP; investidas simultâneas usam horário de envio e ID estável, nunca a ordem dos jogadores na consulta. A posse é revalidada: alvo mudado, aliança formada durante a viagem ou império derrotado encerram a investida sem novo combate.

A captura mantém níveis/danos/estoque e troca a região vinculada. Capital sucessora provisória pode ser confirmada pela interface da cidade; não se realocam stats nem níveis. Última cidade perdida registra derrota, dispersa tropas, cancela viagens, deixa a aliança e permite acompanhar relatos. Não há produção, nova coroação, exploração pendente ou reentrada que recrie o império. A influência atual passa a zero; o selo já registrado permanece, conforme a regra geral. Temporada e prêmios só fecham no calendário natural, sem prêmio antecipado por eliminação.

A aba Defesa recebe uma projeção dos ataques destinados ao próprio jogador: remetente, cidade e chegada; não expõe exércitos nem rotas de terceiros. Decisões de reparo/recrutamento existentes podem preparar o defensor durante a viagem. Por decisão do usuário, não existe aposta separada de influência nem um novo sistema de cards de guerra nesta entrega. O risco é o custo, as baixas, a ausência do exército, o tempo e os danos reais; o benefício é saque e eventual conquista.

## Exploração por caminho

O jogador pode selecionar diretamente um destino na névoa. O servidor traça uma linha contínua de hexágonos a partir da cidade própria mais próxima e cobra o custo e o tempo pela distância, com os bônus existentes. Na chegada, revela o caminho e um hexágono ao redor. A interface antecipa o traçado e a faixa antes do envio. Não exige clicar em cada hexágono.

Essa descoberta pertence ao jogador e persiste ao recarregar. A faixa não anexa terras, não coleta recursos e não concede levantamentos ou prêmios por todos os pontos atravessados: o destino recebe o reconhecimento/levantamento normal. Torres continuam usando sua ação própria. Nenhuma posse de terceiro muda por reconhecimento.

## Resultado visual do combate

Novos relatos PvP guardam um retrato numérico do combate: força de ataque/defesa, baixas próprias, recursos ganhos/perdidos, entrega prevista, integridade, influência de Infraestrutura do defensor e níveis atingidos. O relato mostra números e barras antes/depois; o parágrafo fica em Detalhes. O retrato não é recalculado pelo estado atual, não duplica o saque e permanece igual depois do retorno. Relatos antigos continuam legíveis sem inventar números retroativos.

O atalho abre a coordenada registrada da batalha. Ordens e mapa usam os mesmos rótulos de fase para diferenciar NPC, jogador, guardiões e retorno. Verificação local em larguras de 320/390 px e toque em navegador mobile: `competitive-result-320.png`, `competitive-result-390.png`, `exploration-corridor-preview-390.png` e `exploration-corridor-discovered-320.png`, em `reports/cozy`. Não equivale a teste em aparelho físico.

## Recuperação e fechamento de viagens

Se a cidade de partida cair durante a ida ou a volta, o marcador de retorno passa à capital própria restante. Permanecem o tempo reservado, as baixas, a carga e o dono do exército; a conquista da cidade não transfere o exército global do antigo dono. Se a última cidade cair, as ordens são canceladas e não recriam o império nem entregam carga depois da derrota. Um retorno exatamente no fim da temporada entrega a carga antes de fixar o resultado, sem repetição; um envio que ultrapassaria esse prazo é recusado antes da cobrança.

A leitura automática de relatos usa confirmação silenciosa separada. Erro, atraso ou timeout dessa confirmação não bloqueia recrutamento, não cria um recibo de gasto pendente e não substitui erro ou confirmação de um comando real. A tela tenta novamente com limite de três tentativas; voltar à tela ou recuperar a conexão permite nova tentativa. Respostas antigas continuam sujeitas ao controle de revisão. Recibos antigos que eram apenas de leitura são descartados ao entrar; recibos de gastos reais mantêm a recuperação obrigatória com o mesmo ID.

Provas locais adicionais: `test-expedition-city-loss.mjs`, 20 cenários de sincronização React/navegador em `test-cozy-sync.mjs` e cenário HTTP/mobile de falha e atraso de leitura com recrutamento real. Nenhuma regra de preço, recompensa ou curva de influência mudou nesta rodada.

Na derrota antes do prazo, o cabeçalho identifica o império derrotado e mantém o dia real da temporada. A Coroa não mostra panorama vazio, fronteiras em paz ou convite a evoluir uma cidade inexistente: oferece relatos, ranking e lobby. O ranking abre diretamente na aba correspondente. A leitura não produz recursos, novo rei ou encerramento antecipado; a API segue bloqueando recrutamento e coroação. Verificação em navegador mobile 320/390 px, com transferência pela função real de conquista e persistência na fixture PostgreSQL; não altera mundos remotos.

Testes locais cobrem envio, suprimentos/tempo, ataque não fatal, ocupação após múltiplos danos, capital, última cidade, privacidade dos avisos, repetição, aliança em trânsito, leitura de relatos, calendário e Cozy protegido. O teste HTTP de duas contas usa PostgreSQL/PGlite e transporte local; não é prova de multiplayer remoto/aparelho.

Validação conjunta concluída nesta rodada: `npm run test:cozy` passou, `npm run test:pvp` passou e integração completa passou em **36 cenários**, incluindo HTTP real entre duas contas da fixture, recibo de envio repetido, ameaça visível só ao destinatário, dano não fatal persistido, captura da capital e confirmação da sucessora pela UI a 390 px. TypeScript e build local passaram. Captura: `reports/cozy/competitive-capital-successor-390.png`. O banco da fixture é PostgreSQL/PGlite e o relógio de chegada é antecipado apenas nos dados descartáveis de teste. Nenhum mundo remoto foi convertido e nenhum pacote foi publicado.

Validação remota da 74: ensaio revertido, aplicação e smoke de criação/modo fixo passaram em PostgreSQL real. RPC público negado, novas colunas reconhecidas pelo PostgREST e modos dos três mundos anteriores continuam Cozy. Os dados de QA foram revertidos e os hashes anteriores preservados. Evidência: reports/cozy/competitive-remote-verification.json. Isso não publica o motor/UI nem substitui teste de uma partida remota entre usuários.

## Fórmula sem duplicação de poder

No PvP, ataque = piso(poder militar já calculado × (1 + Comando do rei)). O poder militar já inclui tropas, pesquisa e o limite de cinco generais designados, mesmo com dez heróis. Defesa usa o mesmo poder militar mais as fortificações e aplica Comando, apoio e equipamentos defensivos uma vez cada. Muralhas e bônus defensivos dão a vantagem de defesa; não há multiplicador adicional por Influência total. Distância entra em suprimentos e tempo, não multiplica novamente a força.

Viagens salvas no modelo antigo restauram suas tropas reservadas ao único exército uma vez e apagam a reserva. Carga, baixas já aplicadas e prazos permanecem. Teste: `test-single-army-combat.mjs`, incluindo ataques cruzados, dez generais, stats e conversão de ida/retorno sem recriar baixas.


## Calibração local de 05/11/2026

A preparação de 12h impede quatro ataques quase imediatos entre vizinhos, sem criar escudo ou seleção de tropas. Suprimentos continuam dependendo da distância; não houve aumento de poder. UI e servidor usam `player-campaign.ts`, inclusive para recusar envio sem tempo de retorno antes do fim.

Em 72 cenários determinísticos de meio de jogo, com dois impérios, níveis/exércitos já montados e recursos iniciais legais, defesa que reparou/recrutou a cada 24h ou 48h não perdeu cidade; reagindo a cada 72h, perdeu em 8 de 24 cenários. Primeira captura ocorreu após 55h. Não comprova segurança contra múltiplos atacantes, viabilidade de montar esses exércitos numa temporada nem equilíbrio populacional. Evidência: `reports/cozy/player-campaign-balance.json`.

O stress isolado de 72h mede distância 1/5/15: 5/4/2 ataques completos, custo de 38/70/150 suprimentos por envio e 267/220/117 milícias perdidas num exército inicial de 1000. O estoque e o exército desse stress são pré-financiados; isso mede atrito, não uma estratégia economicamente disponível. Evidência: `reports/cozy/pvp-distance-cost.json`.
