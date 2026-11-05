# King's World — regras vigentes do MVP

Referência única revisada em **05/11/2026**, conferida com o motor local. Números abaixo são os implementados; os ensaios de balanceamento ficam em [BALANCEAMENTO-REIS-ITENS-MVP.md](BALANCEAMENTO-REIS-ITENS-MVP.md). Uma proposta ou relatório antigo não substitui estas regras. A versão anterior está no [histórico](historico/REGRAS_DO_JOGO_ANTES_REVISAO_2026-11-05.md).

## 1. Temporada e vitória

- Normal: 120 dias reais. Expresso econômico: 30 dias reais, com produção/custos próprios. O relógio não corre quatro vezes mais rápido.
- Cinco áreas de 0 a 500: Infraestrutura, Governo, Militar, Conselho e Conquistas. Total até 2500; novas temporadas começam em zero.
- Alcançar 1500 durante a temporada registra o Selo de Vitória. Cair depois não apaga o selo; o ranking final usa a influência final.
- Torres, Maravilhas, posição no ranking e chegada ao centro não são requisitos do selo.
- Até 20 participantes e dez cidades por império. Cada aliança aceita até cinco.
- Cozy: não permite atacar jogadores e preserva a participação/capital. Competitivo: permite ataque e conquista entre jogadores; perder a última cidade encerra o império, mas não antecipa o fim do mundo nem seus prêmios.
- Não converter temporadas antigas para novas fórmulas: calendário, influência e parâmetros fixados no mundo permanecem.

## 2. Começo e cidades

Capital inicial com os cinco setores em nível zero, 25 milícias, 350 ouro, 1800 materiais e 500 suprimentos. A confiança inicial não concede pontos grátis de Conselho. A produção básica permite começar mesmo com setores zero.

| Setor, nível 0–10 | Efeito operacional |
|---|---|
| Administração | Mais produção de materiais; desenvolvimento e Infraestrutura |
| Economia | Mais materiais e suprimentos; sustenta obras, tropas e expedições |
| Sociedade | Atenua perdas de confiança; ajuda a evitar crise/separação |
| Recrutamento | +30 de capacidade por nível e desconto no custo de tropas |
| Defesa | Fortificações, afetadas pela integridade e pesquisa correspondente |

A capacidade começa em 200. O desconto agregado de Recrutamento é 0,4% por nível, limitado a 35%. Custos crescem com o nível da obra, não com o número de cidades. Desenvolver uma cidade significa somar os cinco níveis × 2: de 0 a 100 de desenvolvimento. Desenvolvimento, integridade e influência são medidas diferentes.

A capital já tem seu papel. Colônias começam sem especialização: Metrópole (+5% materiais), Celeiro (+5% suprimentos), Bastião (+5% fortificação local) ou Posto avançado (+10 capacidade). A escolha é permanente e sobrevive à conquista. Enquanto a cidade for capital, não recebe o bônus de colônia; seu tipo anterior permanece guardado.

Renomeação: uma por dono, preservada ao perder/retomar a cidade ou trocar de rei. Uma cidade capturada conserva nome, tipo, níveis, integridade remanescente e histórico de nomes.

## 3. Cinco fontes de influência

| Área | Fórmula nos novos Expressos |
|---|---|
| Infraestrutura | Cidades ordenadas pelos níveis reais. Pesos: 150, 100, 70, 50, 35, 25, 20, 20, 15, 15; cada parcela = piso(soma dos níveis / 50 × peso). Os pesos somam 500 |
| Governo | 30 por herói corretamente designado, até 300; quatro pesquisas com cinco níveis × 10 pontos, até 200 |
| Militar | Até 300 por preparo acima da força inicial: 1 ponto por 90 de força; até 200 pelas seis hordas vencidas. Tropas e fortificações entram no preparo |
| Conselho | Mérito administrativo × estabilidade real das cidades. Tetos de fonte: decretos 160, decisões locais 140, administração estável 200 |
| Conquistas | Seis missões × 50; duas Maravilhas × 60; cooperação útil até 80. Total 500 |

Infraestrutura e Governo reagem aos níveis, cidades e designações reais. Dano, perda de cidade, baixa militar ou crise podem reduzir influência. Recuperar o que foi perdido não gera XP repetido. Conquistas registra feitos uma vez: perder uma Maravilha já construída não apaga esse feito e reconquistá-la não o concede novamente.

O Conselho reconhece resultados úteis, não cliques. No Expresso, méritos-base 4/6/8 por decreto/cuidado/estabilidade usam o fator econômico 4; créditos locais são amortecidos pela raiz do número de cidades e pelos tetos de fonte. Confiança 35 ou menos não sustenta mérito; 70 sustenta a parcela integral. Uma administração saudável por seis dias também pode progredir. Criar uma crise e repará-la não fornece mérito novo ilimitado.

Sem mínimo obrigatório por área: o selo aceita combinações diferentes. Os tetos representam excelência; não se espera que toda temporada alcance cinco áreas máximas.

## 4. Produção, custos e filas

Materiais e suprimentos são produzidos; ouro vem de exploração, coletas e resultados do mundo. Não existe manutenção diária de tropas nem cobrança passiva de materiais por ausência.

- Produção por cidade usa Economia, Administração, pesquisa econômica, integridade, efeito local, Administrador, stat Administração do rei, itens e tipo da cidade. Suprimentos também recebem bônus de abastecimento válidos.
- No novo Expresso, produção-base é multiplicada por quatro; preços de heróis/pesquisas são 25% dos clássicos. Não aplicar o fator de novo na duração ou nas recompensas.
- Obra: aproximadamente 150 × 1,36^nível materiais, arredondados. Tempo: 0,04 + 0,014 × nível dias reais; Engenheiro local reduz em 25%.
- Pesquisa: aproximadamente 50 × 1,7^nível ouro no Expresso. Tempo: 0,25 + 0,1 × nível dias; Sábios designados reduzem 15% cada, até quatro.
- Herói no Expresso: 50 + 25 × quantidade já contratada ouro. Até dez contratados e um designado por cidade. Herói livre é necessário para ocupar outra cidade.
- Filas planejadas são pré-pagas. Limite de doze planos em espera por fila nos novos perfis; começam offline. Cancelar devolve apenas o que ainda não começou, uma vez.
- Dano não cobra uma obra novamente nem devolve o nível destruído: os planos pagos rebaseiam seu nível de resultado. Reparar integridade não reconstrói níveis.

Eficiência operacional altera rendimento; não substitui nível. As opções locais mostram efeitos/custos antes da confirmação. As decisões atuais têm resultado determinado; cards com chance de sucesso continuam fora do MVP.

## 5. Exploração e reservas

É explorar, não espiar. Escolher um destino revela, na chegada, o caminho da cidade própria mais próxima e uma faixa de um hexágono ao redor. Reconhecimento é particular, persiste e não dá posse. Apenas o destino recebe o levantamento/recompensa normal; cruzar vários pontos não multiplica prêmios.

Suprimentos = teto((30 + 8 × distância mínima 1) × (1 − 0,08 × pesquisa de exploração)). Viagem-base = meia hora por hexágono, reduzida pela pesquisa, stat Exploração, Exploradores designados (até quatro) e itens. Novo Expresso usa horas reais. Suprimentos e tempo mostrados usam as mesmas funções do servidor.

Reservas de ouro/materiais ocupam áreas com estoque único. Levantar uma área avança conhecimento até três etapas; não duplica o estoque. Anexação dá acesso a coleta; aliados podem compartilhar conforme a posse atual. Sair da aliança pode remover acesso, mas uma coleta já reservada permanece válida.

Ao esgotar, a reserva some como recurso e os territórios dos impérios permanecem. Conquista/perda de cidade altera apenas a região vinculada; não rouba terrenos independentes de outra cidade ou direitos de terceiros.

Entradas tardias usam vagas NPC reservadas até o prazo configurado do mundo, com capital nova e influência zero; não herdam o desenvolvimento do NPC. Não existe entrada tardia irrestrita.

## 6. Militar, hordas e derrota

Um exército único por império. O jogador decide atacar ou não; não seleciona quantidade nem administra destacamentos. Iniciar uma investida não retira tropas da defesa. Baixas reduzem o exército real, capacidade ocupada e influência correspondente.

Poder militar inclui as tropas, pesquisa militar e generais designados, limitado a cinco generais mesmo com dez heróis. Comando do rei atua uma vez na defesa e no ataque competitivo. Defesa soma fortificações afetadas pela integridade, pesquisa, Comando, bônus aliados/torres e equipamentos. Influência total nunca multiplica a força outra vez.

| Regra | NPC/aldeia | Jogador competitivo |
|---|---|---|
| Permissão | Hostil ou abandonada; sem cidade de jogador no comando NPC | Cidade estrangeira reconhecida; não aliada |
| Decisão | Saquear ou tentar ocupar com herói livre | Danificar estruturas ou tentar ocupar com herói livre |
| Custo atual | Reconhecimento é pago; a ocupação NPC não cobra fundação extra | Suprimentos pela distância, pagos no envio |
| Prazo | Uma investida até a chegada | 12h de preparação + ida + volta; uma investida por vez |
| Ocupação | Poder na chegada com margem de 25% | Vitória, margem de 25%, integridade zero, herói livre e vaga |

Esses parâmetros de alvo são distintos; não confundir essa diferença com escolha de quantidade ou bônus por influência. Regras completas de dano e retorno: [DERROTA-E-TERRITORIO.md](DERROTA-E-TERRITORIO.md).

As seis hordas do Expresso chegam nos dias 5/10/15/20/25/28, com forças 80/180/400/800/1400/2400. Defesa é automática. Vitória perde 2,5% das tropas; derrota perde 12% pelas regras PvE existentes e pode danificar estruturas. PvP usa atacante 6%/20% e defensor 12%/2,5% conforme o ataque vence/perde, arredondando baixas para cima. Não adicionar essas perdas duas vezes ao mesmo encontro.

Derrota pode remover 1–3 níveis reais e 25 de integridade. Uma colônia pode ser perdida; sua área é liberada/transferida conforme a causa. Sociedade em crise por sete dias de jogo pode separar uma colônia. Cozy preserva capital/última cidade; derrota extrema da capital pode matar o rei e abrir sucessão. Competitivo permite perder a capital, escolher outra e, por conquista da última cidade, ser derrotado.

No competitivo, saque transfere 4% do ouro/materiais existentes do perdedor, até 30 ouro e 120 materiais. O atacante recebe no retorno; o defensor vitorioso recebe no reino. Não cria recursos nem transfere influência artificialmente. A preparação é exclusiva do PvP e não recebe redução de rei, item ou pesquisa; esses bônus reduzem apenas o deslocamento. Novas ordens chegam em 12h + viagem e retornam em 12h + duas viagens. Ordens já salvas preservam seus horários. O novo ataque só abre após a volta. Eliminação cancela expedições; não recria o império nem paga prêmios antecipados.

## 7. Alianças e torres

Aliança: até cinco. Ajuda exige pedido e aceite antes da horda; um envio por dia de jogo, com oferta de 20% da defesa e mínimo 20. Não retira tropas, não cobra recursos e só reconhece a cooperação na resolução do encontro. Apoio não é automaticamente uma vitória.

Projetos: Bastião custa 600 materiais + 400 suprimentos; Rotas custa 500 materiais + 100 ouro. Bônus de 10% por sete dias de jogo. Contribuição útil dá mérito de cooperação dentro dos 80 de Conquistas, sem nova fonte ilimitada.

Seis torres externas e uma central. Reconhecimento e sintonia são opcionais, sem influência direta ou condição de vitória. Pactos solo/aliança custam os recursos do projeto correspondente, exigem reconhecimento e guardiões e podem dar 10% em defesa ou suprimentos. Nos pactos atuais, torre + projeto têm teto conjunto de 15%; várias torres não multiplicam esse efeito. Pactos antigos preservam a regra de bônus correspondente.

Hordas de torre atingem apenas ondas que caem no período do pacto. Apoio voluntário usa a oferta e o intervalo já existentes. Derrota encerra o bônus; não remove tropas/cidades diretamente nesse encontro. A horda do reino continua separada, sem usar um bônus já perdido.

## 8. Reis, itens, XP e prêmios

- Não existe nível de conta. Cada rei tem XP/nível próprio; 22 aparências, quatro iniciais. Nomes de personagem são identidade de NPC, não substituem o nickname global do jogador.
- Base de cada rei soma 15 pontos distribuídos em Administração/Comando/Exploração. Base fixa; sobe adicionando nove pontos até nível 10. Máximo 10% por stat, orçamento final 24, sem redistribuir a base.
- Até três equipamentos diferentes escolhidos para cada mundo. Os quinze itens atuais somam pequenos bônus; os maiores efeitos legais de três itens são 4% materiais, 4% suprimentos, 4,5% defesa ou 4,5% menos viagem. Nenhum dá influência diretamente.
- Stats e itens são fixados na coroação. Escolher outro rei ou investir pontos no lobby não altera um reinado em andamento.
- XP de progresso usa a maior influência já atingida no mundo: um por cinco pontos no Expresso, peso quatro no Normal. Perder/recuperar não repete XP; sucessão não herda XP retroativo. Nível máximo: 2025 XP.
- Fechamento: participação elegível recebe cinco Gemas; selo dá mais dez; três primeiros entre ao menos cinco elegíveis recebem mais 3/2/1. Normal multiplica Gemas por quatro, não quantidade de itens.
- Até um equipamento por vitória. Colocação define raridade, não quantidade. Raridade completa converte em duas Gemas. Melhores 25%/50% recebem +10%/+5% do XP realmente ganho por cada rei naquele mundo, com ao menos cinco elegíveis.
- Servidor exige calendário completo e ranking completo, com recibo único. Reabrir não paga novamente. Detalhamento em [PREMIOS-TEMPORADA.md](PREMIOS-TEMPORADA.md).
- Premium: até cinco mundos, em vez de um; sem propaganda, criação com senha e opção visual. Não aumenta força, XP por ação, influência ou recompensas de um mundo. Pagamentos reais ainda não publicados.

## 9. Critério do balanceamento

A meta aproximada de 60–65% de selos precisa de um denominador explícito: amostra de participantes com atividade mínima, incluindo casual competente, diário competente, decisões ruins e negligência. Não forçar uma distribuição normal nem tratar bots como população real.

Especializar deve elevar a frente escolhida com custo em outras; não precisa vencer um equilibrado em toda semente. Reis/itens podem mudar escolhas e limiares sem garantir vitória. Solo precisa continuar viável; aliança e torres são escolhas de cooperação, não chaves obrigatórias para o selo. Os estudos devem registrar perfil, visitas, ações, recursos, fontes de influência, derrotas e configuração, sem injetar recursos na simulação econômica.

## 10. Fora deste MVP

Sem aposta separada de influência, tropas por cidade, eliminação no Cozy, torre obrigatória, nível de conta, season pass, poder comprado em pacote, população/desemprego simulados ou probabilidades inventadas para decisões certas. Novas propostas exigem decisão própria; não recuperá-las de um arquivo histórico.
