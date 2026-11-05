# King's World — regras e progressão da Coroa

Documento principal de design, consolidado em **31/10/2026** a partir das decisões do projeto e da leitura do motor Cozy. Substitui os textos anteriores como referência de regras. O histórico foi preservado em [historico/](historico/README.md).

**Como ler:** **Mantido** identifica decisões já tomadas; **Hoje** descreve o comportamento encontrado no código; **Modelo de progressão** descreve o redesenho implementado para novas temporadas com `influence_version=2`; **Direção recomendada** identifica extensões que continuam em avaliação. Valores atuais não são números de balanceamento aprovados. Em caso de conflito, não importar uma regra de arquivo histórico para o jogo atual.

## 1. A ideia única

O jogador constrói a reputação de um bom governante ao desenvolver, administrar, proteger e manter unido um reino. A Coroa reúne cinco caminhos de influência. Cidades e mapa são os lugares onde as decisões produzem consequências.

**Mantido:** jogo de celular, imersivo, cozy e estratégico; sessões curtas, progresso persistente e resolução pelo servidor. O jogador pode perder colônias e enfrentar crises. No Cozy, a capital original e a participação do jogador permanecem.

O desafio central é **expandir sem perder a capacidade de governar e proteger o que foi construído**. O ciclo conecta descoberta, recursos, investimento, preparação, consequências e recuperação. Não depende de correr para o centro do mapa.

## 2. Temporada, vitória e modos

- Cinco áreas de influência, cada uma com teto de **500**: Infraestrutura, Governo, Militar, Conselho e Conquistas. Total de **2.500**.
- **Nova decisão de progressão:** começar com **0 nas cinco áreas**, preservando capital, tropas, recursos e satisfação iniciais. Implementado no motor para novas temporadas (`influence_version=2`), com pesos provisórios. Temporadas existentes mantêm a versão 1 e sua pontuação; não são convertidas.
- Vitória atual: alcançar **1.500 de influência** durante a temporada ativa. O servidor registra o Selo de Vitória; uma queda posterior não apaga o selo.
- Não há exigência de posição, viagem, torre, Maravilha ou dia mínimo para esse selo. A temporada continua até o ranking final.
- Clássico: 120 dias reais/de jogo. Novo Expresso econômico (implementação local, migração 63 pendente): 30 dias reais/de jogo, produção e preços próprios, sem relógio global acelerado; ondas nos dias 5/10/15/20/25/28. Expressos anteriores preservam seu ritmo e duração. A proposta intermediária de 60 dias não é o padrão novo.
- Novas campanhas Cozy aceitam até 20 jogadores. Cada império pode ter até 10 cidades: capital e 9 colônias. Partidas antigas mantêm suas configurações.
- Cozy: PvE, sem atacar jogadores. Competitivo: previsto, com conflitos prolongados e eventual disputa de influência; ainda não está habilitado.
- Fases ajudam a orientar a temporada. O antigo Êxodo/Portal obrigatório e a exigência de ativar torres para vencer foram retirados.

**Direção recomendada:** os 500 de cada área representam excelência naquela frente. Os 1.500 devem aceitar combinações diferentes de progresso. Não acrescentar um mínimo obrigatório por área sem uma nova decisão de design.

## 3. Onde cada coisa acontece

| Lugar | Responsabilidade |
|---|---|
| Coroa | Cinco menus principais, visão do reino, influência, alertas e ordens |
| Infraestrutura | Resumo das cidades e acesso aos setores |
| Militar | Recrutar o exército, preparar defesa e acompanhar ameaças |
| Governo | Heróis, designações, pesquisas e situação do reino |
| Conselho | Dois conselheiros e decisões que repercutem no reino |
| Conquistas | Missões, Maravilhas, cooperação, vitória e ranking |
| Dentro da cidade | Cinco níveis, produção real, integridade, Sociedade e decisões locais |
| Mundo | Exploração, áreas de recurso, anexação, NPCs e expansão |
| Aliança | Acesso compartilhado às áreas e apoio contra hordas |
| Lobby/conta | Entrar nos mundos, histórico, XP, selos e Hall da Fama |

Os cinco setores da cidade são **Administração, Economia, Sociedade, Recrutamento e Defesa**, de nível 0 a 10. Recrutar tropas é ação do Militar; o setor Recrutamento da cidade aumenta capacidade e melhora condições. Sociedade pertence à cidade; Conselho é a frente de governo da relação com o povo. Conquistas substitui o nome Legado na interface.

| Setor da cidade | Função no modelo-alvo |
|---|---|
| Administração | Organizar e apoiar a produção de materiais |
| Economia | Produzir materiais e suprimentos |
| Sociedade | Sustentar confiança e resistência/recuperação diante de consequências sociais |
| Recrutamento | Ampliar capacidade e melhorar condições de recrutamento no Militar |
| Defesa | Contribuir para a fortificação efetiva do império, considerando a integridade local |

No modelo novo, Sociedade reduz perdas de confiança causadas por decisões e hordas, em até 30% no nível 10. A confiança efetiva alimenta Conselho. As funções já existentes dos outros setores não foram recalibradas.

## 4. Os cinco desafios de progresso

Esta seção registra o **modelo de progressão implementado para novas temporadas**, após a decisão de começar em zero. Define fontes de mérito e consequências. Os pesos são provisórios; preços, durações e economia não foram recalibrados. A seção 12 preserva as fórmulas da versão anterior.

| Área | Pergunta do jogador | Desafio que deve sustentar o progresso | Sinal de avanço |
|---|---|---|---|
| Infraestrutura | Consigo sustentar um reino maior? | Escolher onde investir e expandir mantendo cidades desenvolvidas e operantes | Cidades com setores evoluídos, capacidade produtiva e recuperação possível |
| Governo | Tenho a corte e o conhecimento certos? | Investir ouro, escolher especialistas e ordenar pesquisas conforme as necessidades | Heróis em função, conhecimento concluído e especialização útil |
| Militar | Estou preparado para o próximo confronto? | Equilibrar recrutamento, capacidade, pesquisa, fortificações e recuperação | Defesa efetiva, preparação para ameaças e continuidade após perdas |
| Conselho | Meu povo ainda confia em mim? | Resolver dilemas e problemas persistentes com recursos limitados | Confiança e estabilidade locais, com crises efetivamente tratadas |
| Conquistas | O que este reino realizou de importante? | Concluir feitos de maior alcance e cooperar de forma útil | Marcos únicos, Maravilhas e contribuições reconhecidas |

### 4.1 Infraestrutura — desenvolver e sustentar a expansão

- **Começo:** entender uma cidade e distribuir investimento pelos cinco setores.
- **Evolução:** decidir entre aprofundar a capital, recuperar uma cidade ou investir em uma colônia. A expansão aumenta produção, necessidades de defesa e atenção às crises.
- **Excelência:** manter um conjunto de cidades bem desenvolvido e capaz de continuar funcionando após contratempos.
- Materiais financiam obras e tropas; essa disputa de uso precisa ser perceptível. Heróis e pesquisa influenciam a eficiência desse investimento.
- Nível construído, integridade e eficiência têm funções diferentes. Dano reduz operação; reparo recupera o investimento existente. Não cobrar perda simultânea de nível pelo mesmo dano sem uma regra explícita.
- A pontuação de infraestrutura deve ter origem clara nos níveis. Perder uma colônia pode reduzir a infraestrutura do império.

**Manter:** setores simples e evolução na cidade. **Calibrar depois:** ritmo de expansão, investimento de uma colônia e intensidade dos efeitos dos setores. Não criar manutenção diária ou novos recursos por inferência.

### 4.2 Governo — fazer escolhas com ouro e conhecimento

- **Começo:** escolher o primeiro especialista e a primeira linha de pesquisa.
- **Evolução:** ordenar contratações e tecnologias, distribuir funções e decidir entre desenvolvimento, exploração e preparação militar.
- **Excelência:** corte útil e conhecimento desenvolvido, com contribuição compreensível de ambos para Governo.
- O herói deve exercer uma função para produzir seu bônus. Reserva, designação e indisponibilidade em conquista precisam ser claras.
- Ouro também participa das oportunidades do mapa. Contratar tudo imediatamente não deve eliminar as escolhas de pesquisa.

**Referência do usuário preservada:** **heróis + pesquisas**, com a repartição sugerida de **300 + 200** dentro do teto 500. A estrutura passa a reconhecer os dois caminhos; valores por herói/nível e a curva exata continuam para a calibração. A versão nova aplica 30 por herói designado e 10 por nível concluído de pesquisa, chegando a 300 + 200. São pesos provisórios. As quatro linhas atuais de pesquisa não significam quatro pesquisas simultâneas: hoje há uma ordem de pesquisa por vez.

**Contrato desta revisão:** heróis em função válida e pesquisa concluída são as fontes. Contratar para deixar na reserva e começar uma pesquisa não pagam influência por si só. A ordem única de pesquisa é preservada para a primeira implementação do redesenho; novas vagas simultâneas ficam para uma revisão própria. O número de cidades continua limitando designações, mas já não é a única maneira de avançar Governo.

### 4.3 Militar — preparar, defender e recuperar

- **Começo:** conhecer a força disponível e preparar a primeira defesa.
- **Evolução:** abrir tipos de tropa pela pesquisa, ampliar capacidade nas cidades e comparar defesa com a próxima ameaça. Materiais dividem-se entre exército e obras.
- **Excelência:** um império preparado para ameaças maiores, com defesa, apoio e capacidade de recuperação.
- Recrutamento e decisões defensivas ficam no Militar. Na cidade, Defesa continua sendo um nível que ajuda a conta militar.
- A muralha imperial como investimento próprio e suas alternativas continuam no plano. Hoje existem fortificações das cidades e pesquisa de muralhas, sem esse nível imperial separado.
- Preparação contra hordas deve importar mesmo para quem não quer atacar NPCs. Perdas e danos precisam ter relatório e recuperação compreensíveis.

**Contrato desta revisão:** Militar reconhece capacidade efetiva presente; a compra é investimento e a vitória pode ser um feito de Conquistas. A muralha imperial nova continua fora do primeiro modelo. Calibrar depois a contribuição da força, fortificação, dano e recomposição.

### 4.4 Conselho — governar a confiança do povo

- **Começo:** reconhecer o estado das cidades e entender as consequências das escolhas.
- **Evolução:** conciliar recursos, produção e confiança, atendendo problemas locais e consequências de decisões maiores.
- **Excelência:** um reino com estabilidade sustentada, capaz de atravessar dificuldades e recuperar crises.
- **Papel da influência de Conselho no modelo-alvo: legitimidade do governo**, apoiada na situação real das cidades. Sociedade é o setor local que ajuda a explicar e sustentar essa relação.
- Cards do Conselho lidam com temas do reino; cards da cidade tratam causas e efeitos locais. O estado de uma cidade deve aparecer nos avisos e nas consequências correspondentes.
- Pontuar a condição alcançada e os resultados válidos de governo, com regras para não premiar criar e desfazer o próprio problema repetidamente.
- Assinar muitas cartas, abrir a tela ou manter conselheiros selecionados não demonstra, por si só, boa administração.
- Uma crise crítica persistente e anunciada pode separar uma colônia. Baixa eficiência produtiva, sozinha, não sorteia perda de cidade. A capital segue protegida no Cozy.

**Contrato desta revisão:** confiança inicial não dá influência. A legitimidade é conquistada por resultados válidos de administração e sustentada pela estabilidade real das cidades. O resumo do reino deve derivar desses estados locais. Não criar três barras obrigatórias de satisfação, emprego e legitimidade; desemprego real continua fora do primeiro modelo.

### 4.5 Conquistas — registrar feitos que merecem ser lembrados

- **Começo:** marcos que ensinam o ciclo do jogo e deixam um objetivo próximo visível.
- **Evolução:** feitos que exigem preparação, exploração, tecnologia, defesa ou cooperação útil.
- **Excelência:** projetos e realizações de maior alcance, incluindo Maravilhas e contribuição ao mundo.
- Missões devem ter início, progresso e conclusão claros. Um resgate não pode pagar duas vezes pelo mesmo feito.
- Repetir ações pequenas deve ser avaliado como possível atalho de pontuação. A contribuição reconhecida precisa corresponder a algo útil, e não apenas à quantidade de ordens emitidas.
- Maravilha continua ligada a uma cidade plenamente desenvolvida e a um investimento expressivo. Não é requisito para o Selo de Vitória.
- O painel Conquistas acompanha Maravilhas; a ação de construir continua dentro da cidade. Um projeto em etapas/tempo é proposta futura, não comportamento atual.
- Cooperação deve continuar acessível a quem está desenvolvendo o reino; a contribuição de exploração/coleta e a de apoio aliado precisam de critérios claros.

**Contrato implementado:** no modelo novo Cozy, feitos reconhecidos em Conquistas ficam no histórico e não são apagados pela perda posterior da cidade. Isso inclui o feito de construir uma Maravilha. Adquirir/reconquistar uma Maravilha existente não conta como construí-la de novo. O registro de construções usa o local da obra e persiste após a perda da cidade. Na versão antiga, a parcela continua dependendo da posse atual.

### 4.6 Contrato das cinco áreas, partindo de zero

Este é o contrato implementado no motor para novas temporadas. Os critérios abaixo já determinam influência; os pesos ainda serão calibrados.

| Área | Começa em zero porque… | O que reconhece | O que pode reduzir a pontuação | O que permanece |
|---|---|---|---|---|
| Infraestrutura | A estrutura recebida na capital é o ponto de partida | Desenvolvimento adicional e cidades adquiridas pelo jogador, enquanto pertencem ao império | Perda de colônia ou de uma melhoria, se existir uma regra explícita para isso | O investimento remanescente da cidade; reparo não precisa refazer níveis |
| Governo | Não há herói em função nem conhecimento concluído | Heróis atuando e níveis de pesquisa finalizados | Herói sai de função ou perde a cidade em que atuava | Conhecimento já concluído |
| Militar | Tropas e proteção iniciais são a capacidade recebida | Capacidade militar efetiva desenvolvida além da base inicial, incluindo fortificações operantes | Baixas, dano e perda da capacidade reconhecida | Tecnologias concluídas continuam disponíveis para reconstruir |
| Conselho | A confiança inicial é uma condição de partida | Resultados de governo reconhecidos, sustentados pela estabilidade local | Crises persistentes e deterioração da confiança nas cidades | Histórico das decisões/resultados; o prestígio efetivo pode cair |
| Conquistas | Nenhum grande feito foi concluído nesta temporada | Marcos únicos, construção de Maravilhas e patamares de contribuição útil | Não perde pontos já registrados no modelo Cozy | Feitos reconhecidos e seus registros |

**Os cinco tetos continuam em 500.** A capacidade inicial continua funcionando, mesmo com influência zero. Não zerar níveis, satisfação, produção, exército ou inventário para fabricar esse início.

### 4.7 Infraestrutura: capital inicial e expansão

- A capital recebida começa com sua contribuição de influência em zero. Seus setores existentes continuam produzindo e funcionando.
- Melhorias acima desse ponto inicial fazem sua contribuição crescer, até o teto de 50 por cidade plenamente desenvolvida.
- Uma cidade fundada ou conquistada pelo jogador é uma aquisição real: pode contribuir por sua incorporação e pelo desenvolvimento que possui. O peso exato da aquisição versus níveis será definido na curva.
- O conjunto das dez cidades pode atingir 500. A normalização deve preservar esse máximo apesar da base inicial excluída da capital.
- A pontuação representa o que o império possui. Perder e retomar uma cidade restaura a contribuição correspondente, sem acumular novos prêmios de fundação a cada troca de dono.
- Integridade continua separada. Dano reduz produção/defesa; a mesma ocorrência não reduz também os níveis/pontos de infraestrutura sem nova regra explícita.

### 4.8 Governo: função e conhecimento

- Um herói conta enquanto atua numa cidade pertencente ao jogador e a designação é válida nos dois lados. A reserva e a simples compra não contam.
- Trocar de cidade ou liberar/designar novamente apenas recalcula essa contribuição; não acumula pontos.
- Pesquisa pontua quando um nível termina no servidor. Comprar a ordem, esperar ou cancelar não antecipam prestígio.
- As quatro linhas atuais são os caminhos de conhecimento. Cada uma deve ter uma curva legível, sem confundir linha com vaga simultânea.
- Pesquisa militar dá prestígio de conhecimento em Governo; seu efeito melhora a capacidade efetiva em Militar. Não acrescentar outra recompensa plana pelo mesmo clique sem definir um mérito diferente.
- O jogador escolhe ordem de contratação, função e pesquisa com o ouro disponível. Essa decisão é o desafio de Governo.

### 4.9 Militar: capacidade presente, sem farm de reconstrução

- O ponto inicial é o exército/proteção recebidos. Bônus do perfil escolhido não dão influência imediata.
- O progresso vem da capacidade efetiva desenvolvida: exército disponível, fortificação em funcionamento e efeitos reais da preparação. Uma vaga vazia ou uma tropa apenas desbloqueada não representa força pronta.
- Perder tropas ou sofrer dano pode reduzir Militar, limitado a zero. O histórico de quanto foi gasto não mantém sozinho os pontos.
- Reparar e recompor recuperam capacidade e pontuação; não rendem um prêmio cumulativo a cada destruição/reconstrução.
- Vitórias e grandes defesas são feitos de Conquistas. Militar mede a capacidade atual de enfrentar ameaças; não transforma cada resultado em mais uma parcela ilimitada.
- A futura muralha imperial permanece uma extensão própria. O primeiro modelo pode usar as fortificações já existentes sem inventar um investimento que ainda não funciona.

### 4.10 Conselho: legitimidade conquistada e confiança atual

A confiança local é uma condição da cidade; influência de Conselho é o reconhecimento do governo. **Começar com cidades estáveis não significa já ter construído uma reputação de 170 pontos.**

- A legitimidade começa sem mérito registrado. O jogador a constrói ao concluir episódios válidos de governo: responder a dilemas, cumprir uma resposta até seu resultado e sustentar cidades estáveis após mudanças reais no reino.
- Uma administração bem-sucedida em tempos tranquilos também precisa ter caminho de progresso. Não exigir provocar crises para poder pontuar.
- O episódio tem identidade e resultado no servidor. Abrir o menu, trocar conselheiro ou reaplicar a mesma resposta não cria outro mérito.
- A estabilidade local limita/sustenta o prestígio reconhecido. Mesmo com histórico de boas decisões, crises persistentes afetam a pontuação atual.
- Recuperar uma crise pode restabelecer o prestígio perdido. A mesma crise, artificialmente agravada e reparada em sequência pelo jogador, não vira fonte recorrente de mérito.
- O nível de Sociedade deve ajudar a cidade a resistir e recuperar confiança diante das consequências. Essa função operacional está implementada para perdas de confiança; não concede pontuação automática de Conselho apenas por existir.
- A interface continua mostrando confiança na cidade e influência na Coroa. O registro interno de episódios não exige outra barra de manutenção diária.
- Os coeficientes de mérito, estabilidade, resistência e recuperação ficam para a etapa numérica. A primeira versão reconhece decisões locais úteis, decretos com cidades estáveis e períodos de estabilidade após cuidado real. A variedade dos episódios ainda pode evoluir antes da calibração.

### 4.11 Conquistas: crédito por resultado útil

- Cada missão/marco tem uma identidade estável por temporada e pode pagar sua recompensa uma vez. O botão de resgate é só uma confirmação desse direito.
- Maravilha exige uma construção válida do jogador. Conquistar, perder, reparar ou retomar a mesma obra não repete o feito de construção.
- Levantamento de recursos contribui quando avança o conhecimento útil da área. Repetir um levantamento já concluído não acrescenta mérito por si só.
- Coleta deve reconhecer contribuição útil em patamares; dividir a mesma quantidade em várias ordens pequenas não pode multiplicar influência.
- Apoio aliado contribui quando é válido e utilizado na resolução da ameaça. Pedidos não aceitos ou já contabilizados não contam novamente; a contribuição pode ter sido útil mesmo em uma derrota.
- Cooperação tem limites/marcos definidos para a temporada; não é uma torneira infinita de pontos por ação.
- Torres continuam sem influência, inclusive por descoberta/sintonia. Não contornar essa decisão criando uma missão pontuável que obrigue ativá-las.
- Os pesos entre missões, Maravilhas e cooperação serão calibrados. O teto da área permanece 500, com feitos guardados após a conquista no Cozy.

### 4.12 Regras comuns e transição

- Nova temporada deve mostrar **0/500 em cada área e 0/2.500 no total**, mesmo já oferecendo condições para jogar.
- Uma ação só muda influência quando seu resultado é válido. A chegada de uma ordem, a manutenção de uma função ou a conclusão de um episódio têm fonte identificável no servidor.
- Ausência do aplicativo não zera prestígio por si só. Ordens continuam, ameaças chegam e crises já abertas podem avançar; são esses resultados que têm consequência.
- Trocar nome, perfil visual, aba, conselheiro ou ordem de ações não permite repetir a mesma recompensa.
- Fontes atuais, histórico de feitos e condições locais ficam separados no estado. A interface deve explicar a origem e o motivo de uma queda.
- O modelo de influência precisa ser versionado por temporada. O primeiro reino criado no modelo novo recebe sua base inicial reconhecida; um campo faltando num save antigo não significa que ele começou hoje.
- Temporadas antigas não são convertidas silenciosamente, e selos já registrados não são apagados. A política aplicada é preservar a versão de cada temporada; uma conversão futura exige uma revisão própria.
- O total é a soma das áreas, sem pontuação negativa. Os tetos 500/2.500 e a vitória em 1.500 continuam; nenhuma área mínima extra foi exigida.

### 4.13 Casos obrigatórios para a implementação

1. Novo reino com capital, recursos, tropas e satisfação iniciais mostra zero nas cinco áreas.
2. Melhorar a capital permite progredir; a capital completa ainda pode atingir sua contribuição máxima.
3. Adquirir uma cidade gera somente sua contribuição válida atual; perder/retomar não duplica mérito.
4. Contratar sem designar não pontua Governo; designar pontua a função; trocar de cidade não acumula; pesquisa só conta na conclusão.
5. Escolher perfil de rei não oferece influência imediata. Baixas/reparo/recrutamento recalculam Militar sem farm cumulativo.
6. Uma cidade estável de início não concede Conselho. Um episódio concluído permite avanço; estabilidade sustenta esse avanço; uma crise real pode derrubá-lo e a recuperação pode restaurá-lo.
7. Um império bem administrado progride no Conselho sem precisar causar revolta. Repetir uma crise própria não concede novo mérito ilimitado.
8. Resgatar de novo, fragmentar coleta, repetir levantamento completo ou reenviar o mesmo apoio não multiplica Conquistas.
9. Perder a cidade de uma Maravilha não apaga o feito já registrado no modelo novo; retomar a obra não o paga de novo.
10. Recarregar, ficar offline e repetir um recibo preservam resultado e autoria; a liquidação não altera silenciosamente temporadas antigas.

## 5. Como as áreas se ajudam

**Exploração → recursos → obras/tropas/pesquisas → capacidade de expansão e defesa → estabilidade → novos feitos.**

- Infraestrutura sustenta produção e capacidade; também amplia o que é preciso governar.
- Governo transforma ouro e funções em eficiência e opções de desenvolvimento.
- Militar protege cidades e abre oportunidades de PvE.
- Conselho mantém a relação com o povo e trata consequências das decisões.
- Conquistas reconhece realizações dessas frentes, com limites claros de repetição.

Uma ação pode beneficiar várias frentes, desde que cada contribuição seja explicável. **Recomendação:** cada área deve ter ao menos uma escolha relevante que não seja decidida automaticamente pela mesma expansão ou compra que resolve todas as outras.

## 6. Recursos, ações e tempo

**Mantido:** ouro, materiais e suprimentos. Economia das cidades produz materiais e suprimentos; ouro vem do mundo e paga heróis/pesquisas. Materiais pagam obras e tropas. Suprimentos pagam exploração e algumas decisões; não há manutenção diária de tropas.

Heróis: até 10, nas funções General, Engenheiro, Administrador, Explorador e Sábio. Uma cidade recebe no máximo um herói. Conquista utiliza um herói livre já contratado; não há diplomata separado no Cozy atual.

Ordens continuam enquanto o jogador está fora. O servidor decide tempo, chegada, custo, recompensa, reserva e resultado. Explorar, pesquisar, coletar e atacar têm filas próprias; cada cidade tem sua fila de obra. A interface mostra preço, duração, progresso e motivo do bloqueio.

**Direção recomendada para decisões:** mostrar custo, consequência conhecida e prazo antes de confirmar. Quando houver chance, mostrar risco e resultados possíveis. Duas alternativas devem ser úteis em contextos diferentes: reserva curta, produção comprometida, ameaça próxima ou necessidade de recuperação. Evitar apresentar uma alternativa como escolha estratégica quando outra entrega mais de tudo no mesmo contexto. Os cards atuais são determinísticos; probabilidades continuam pendentes.

## 7. Cidades, crises, capital e reinados

- Desenvolvimento da cidade vai a 100; a contribuição de infraestrutura vai a 50. São escalas diferentes dos mesmos cinco níveis.
- Sociedade acompanha confiança e estabilidade local. A produção mostra rendimento real e eficiência; nível, herói, pesquisa, integridade e efeito temporário podem influenciar o rendimento.
- Crises e dano têm causas, alertas e caminhos de recuperação. Existe alternativa sem custo em recursos para evitar um reino sem saída.
- Colônias podem se separar por crise persistente ou ser perdidas para hordas. A cidade continua no mapa com estruturas remanescentes; herói é liberado e obras locais são interrompidas.
- Reconquista preserva o investimento remanescente e exige condições válidas. Recuperar a posse não reconstrói gratuitamente toda a cidade.
- No Cozy, capital original permanente e nenhuma eliminação do jogador. Uma derrota extrema pode matar o rei; a sucessão continua o reino sem curar estruturas ou conceder recursos.
- Perfil é um arquétipo com retrato, nickname e bônus, fixo por reinado. Histórico de reinados é preservado.

**Hoje:** estabilidade local usa 60/35 como limites; ruptura considera sete dias de jogo críticos consecutivos, com avisos. Esses números são parâmetros de funcionamento, não calibração final. A satisfação não sofre uma nova queda automática simplesmente por deixar de abrir uma tela; uma crise já ativa pode continuar avançando durante a ausência.

## 8. Mapa, áreas, alianças e torres

**Mantido:** explorar, sem espiar; custo de suprimentos e tempo; pistas antes da revelação. Terreno visual não impõe uma malha viária obrigatória nem bloqueios de construção inventados. Posse, ameaças, reservas e distritos especiais têm regras próprias visíveis.

Poucas áreas grandes, com tamanhos variados, devem organizar ouro e materiais. A reserva é única por área/recurso. Levantamento, anexação e coleta são autoritativos. A aliança vigente permite compartilhar acesso conforme a regra de anexação; sair do grupo pode suspender esse acesso. Esgotamento remove o recurso, preservando territórios e fronteiras.

**Hoje:** geração histórica de coordenadas e áreas por distritos de até 8×8. O estudo de raio 34/3.571 hexágonos e oito áreas maiores ainda não substituiu essa geração. Nascimentos distribuídos pelo interior, acesso inicial a oportunidades e contato com vários vizinhos continuam objetivos da geração definitiva. Não mover cidades antigas silenciosamente.

### Alianças — grupos de até cinco reinos

Cada aliança aceita **até 5 jogadores**. Grupos maiores que já existam não perdem membros; não recebem novas entradas enquanto estiverem acima do limite. Uma pessoa pertence a um grupo por vez.

- A aba inferior **Aliança** concentra **Visão geral, Projetos e Membros**. A Coroa continua com cinco áreas; um aviso de aliança abre convites, pedidos de ajuda, pedidos de entrada ou projeto concluído sem substituir o acesso às ordens.
- O líder escolhe entrada livre ou por aprovação. Qualquer membro pode convidar um jogador disponível deste mundo. O destinatário precisa aceitar; aprovar um pedido também gera um convite para aceite. Convites não reservam vagas: o servidor confirma o limite na entrada, inclusive em concorrência.
- Aliança coopera contra hordas sem deslocar tropas de apoio. Há pedido, aceite antes da chegada e intervalo entre envios. A ajuda usada fica registrada junto ao resultado, força enfrentada, perdas e dano real da defesa. Não existe combate entre jogadores no Cozy.
- O líder escolhe **um projeto em preparação por vez**. Todos podem reservar os recursos que faltam. Contribuições são limitadas à meta real; valores inválidos, recursos sem meta e projetos de outro grupo são rejeitados. Os recursos só contam como utilizados quando a meta completa.
- **Bônus coletivo:** Bastião dos aliados melhora a defesa contra hordas; Rotas de abastecimento melhora a produção de suprimentos. O benefício vale para os membros atuais, inclusive recém-chegados; termina na saída ou no vencimento. Um mesmo tipo não acumula nem pode ser reiniciado enquanto seu bônus está ativo.
- **Reconhecimento pessoal:** quem contribuiu para um projeto concluído recebe um registro único e crédito no teto já existente de cooperação em Conquistas. Nenhum ponto é entregue por contribuição ainda reservada. Quem entrou depois recebe o benefício coletivo, sem receber o feito de quem financiou a obra.
- Sair não apaga participação. O projeto continua para os membros restantes; um contribuinte que saiu ainda é reconhecido se a meta for concluída. Se o grupo for encerrado antes da conclusão, as reservas de todos, inclusive ex-membros, são devolvidas uma única vez. O histórico permanece independente da existência do grupo.
- Ao sair, pedidos de apoio ainda não aceitos são retirados; apoios já confirmados continuam válidos. O próximo membro assume a liderança se o líder sair.

**Pesos funcionais provisórios**, centralizados em `lib/cozy/alliances.ts`: Bastião custa 600 materiais + 400 suprimentos; Rotas custa 500 materiais + 100 ouro; cada um dá +10% no seu efeito durante 7 dias de jogo. Participação utilizada num projeto dá +12 de cooperação, dentro dos mesmos 80 da área, sem uma sexta fonte ilimitada. Não é uma calibração aprovada da economia. Torres usam pactos próprios sem crédito nos 80 de cooperação; estes projetos pertencem à aba Aliança.


Torres/santuários: bônus e desafios opcionais, sem influência nem condição de vitória. O visual atual tem seis externos e um central, com distritos reservados. Reconhecimento por expedição está implementado: custo/tempo usam exploração, registro único na chegada e nenhuma influência, missão ou cooperação. Sintonia solo/aliança, reservas, devolução e bônus temporários de defesa/abastecimento estão implementados; guardiões de ativação estão implementados; defesas contra hordas durante os pactos novos estão implementadas localmente; especialidades adicionais e revisão de posicionamento continuam em design. A arte central diferente não justifica vantagem automática a um nascimento próximo.

## 9. Combate e limite entre os modos

A base de combate deve servir a PvE e ao competitivo futuro. **Hoje:** exploração e ataques a NPCs têm resolução automática, perdas e relatórios. O competitivo prolongado ainda não está implementado.

**Direção mantida para o competitivo:** ataques demoram, causam dano gradual e permitem decisões durante o conflito. Não é aniquilação automática de todo o exército. Uma cidade alvo é disputada; não há direito automático a tomar outra cidade qualquer após vencer.

Aposta/transferência de influência, aceitação do confronto, perdas, conquista, empates, cancelamento e proteção contra abuso precisam de contrato próprio. Não usar os números do PvE como se já equilibrassem PvP. Destino da capital/eliminação no competitivo permanece em aberto; a proteção Cozy não é removida.

## 10. O que fica fora da primeira calibração

Manter no horizonte, com especificação própria: PvP por aposta, muralha imperial como entidade própria, cards probabilísticos, manutenção paga e especialidades adicionais das torres, desemprego/população simulados, novas especializações de cidade e bônus jogáveis entre temporadas.

XP, histórico, selos e troféus já têm base. Catálogo de cosméticos e eventuais itens de ajuda continuam pendentes. **Recomendação:** calibrar primeiro o reino base, mantendo vantagens externas fora dos ensaios iniciais, para saber o que o jogador realmente precisa fazer para avançar.

Não retomar Portal obrigatório, diplomatas do modelo antigo, tropas por cidade, eliminação Cozy por perder a capital ou teto desigual das cinco áreas a partir de texto histórico.

## 11. Preparação do balanceamento: ordem de trabalho

Os mecanismos da progressão zero estão implementados. A etapa numérica permanece adiada: os pesos abaixo permitem jogar e testar o contrato, sem afirmar que a curva está equilibrada.

1. **Fontes e consequências definidas nesta revisão:** seguir os contratos 4.6–4.12 para separar capacidade presente, legitimidade e feitos permanentes.
2. **Mecanismos implementados:** contribuição de pesquisa, base inicial por temporada, episódios de legitimidade, resistência social e registro único de feitos/contribuições. Expandir o catálogo contextual antes de julgar sua variedade.
3. **Início zero decidido pelo usuário:** preservar capacidade e recursos iniciais; reconhecer mérito a partir dos contratos novos. Não subtrair 182 de cada save nem zerar a satisfação real das cidades. Temporadas existentes mantêm a versão 1; novas usam a versão 2, com base inicial registrada.
4. **Conferir escolhas e dependências:** expansão, ouro, materiais, pesquisa e proteção precisam oferecer caminhos úteis em diferentes situações. Marcar ações repetíveis e recompensas duplicadas pelo mesmo mérito.
5. **Fechar catálogo e ritmo dos desafios:** progressão por começo/evolução/excelência, temas de decisões e pressão das ameaças. Não impor uma data de vitória nem marcos obrigatórios novos para todos.
6. **Só então calibrar:** ganhos, custos, produção, duração, frequência, dano e recuperação no mesmo modelo. Primeiro Cozy clássico; depois validar o expresso com a mesma progressão em tempo de jogo. PvP exige sua própria especificação antes da calibração competitiva.
7. **Validar cenários:** reino compacto e desenvolvido; expansão com manutenção da estabilidade; pesquisa prioritária; defesa/cooperação; recuperação após ausência/derrota; tentativa de farmar contadores. Comparar caminhos e situações, sem declarar uma rota ótima como experiência de todo jogador.
8. **Planejar transição:** novas fórmulas têm versão e tratamento de temporadas existentes. Selos históricos, recibos e dados persistidos não são recalculados silenciosamente.

**Critérios para considerar o desenho pronto:** cada área tem uma escolha relevante; a origem dos pontos cabe numa explicação curta; a próxima meta é visível; há motivo para cuidar da Sociedade; uma dificuldade tem resposta possível; nenhum caminho repetível paga prestígio ilimitado; modos e estados já implementados estão separados de propostas.

## 12. Auditoria da versão anterior — preservada em temporadas existentes

Conferida em `lib/cozy/engine.ts`, `catalog.ts`, `city-life.ts` e `city-crisis.ts` em 31/10/2026. Esta seção descreve somente `influence_version=1`; novas temporadas seguem a seção 13.

| Área | Fórmula de influência hoje | O que precisa ser resolvido no design |
|---|---|---|
| Infraestrutura | Soma dos cinco níveis por cidade, somente se os cinco forem positivos; teto 500 | Qualidade da expansão, ritmo de desenvolvimento e tratamento da base inicial |
| Governo | 50 por herói designado corretamente a uma cidade; teto 500 | Pesquisa não pontua; quase todo o progresso depende da quantidade de cidades |
| Militar | Parte inteira de (poder do exército + fortificações)/6, mais 15 por nível de pesquisa militar; teto 500 | Relação entre compra de poder, defesa, preparo e resultados; recuperação após perdas |
| Conselho (`society`) | Arredonda satisfação global ×2 + média de nível de Sociedade das cidades ×30; teto 500 | Estado local não é a base direta desta fórmula; pontuação inicial alta e máximo possível com uma só cidade |
| Conquistas (`legacy`) | Missões resgatadas + até duas Maravilhas ×60 + cooperação ×4 limitada a 80; teto 500 | Critério de feitos, repetibilidade da cooperação e diferença entre histórico e posse atual |

**Constatação executada na versão 1:** um reino no clássico começa com **182** de influência: 5 de Infraestrutura, 0 de Governo, 7 de Militar, 170 de Conselho e 0 de Conquistas. Com uma única cidade, Sociedade nível 10 e satisfação global 100, Conselho já chega a 500. Isso explica por que as cinco frentes ainda não passam a mesma sensação de desafio. Não é uma recomendação de pontuação inicial.

As seis missões atuais dão 50 cada: desenvolvimento 40 numa cidade, três cidades, dez pontos explorados, cinco níveis de pesquisa, duas hordas vencidas e cinco decretos assinados. Maravilhas somam até 120 e cooperação até 80. Essa composição totaliza os 500 de Conquistas; ainda deve ser avaliada quanto ao mérito e ao ritmo, em vez de apenas ajustar preços.

Os decretos atuais dão materiais e modificam satisfação, sem custo e sem sorteio. Há decisões locais com custo, recuperação, arrecadação e efeitos temporários de produção. São uma base funcional; o catálogo contextual e as trocas estratégicas ainda precisam evoluir. Essas fórmulas são preservadas apenas para temporadas existentes. O começo zero, Governo 300/200 e Conselho local já estão no modelo novo.

## 13. Implementação zero — pesos provisórios e persistência

`lib/cozy/progression.ts` centraliza os pesos para a calibração posterior. Os cinco tetos são 500; o total máximo é 2.500 e o Selo continua em 1.500.

| Área | Primeira implementação funcional |
|---|---|
| Infraestrutura | Clássico e perfis anteriores: capital normaliza os níveis adicionais acima da estrutura recebida até 50; demais cidades somam os cinco níveis positivos, até 50 cada. Novo perfil do Expresso econômico: ordena essas proporções de desenvolvimento e aplica pesos 150/100/70/50/35/25/20/20/15/15, gravados no perfil do mundo. Quatro cidades completas reconhecidas dão 370; dez dão 500. Perfis anteriores conservam seus pesos; o modelo anterior reconhecia 300 em quatro cidades completas. A estrutura inicial da capital continua excluída. A posse atual determina a contribuição. |
| Governo | 30 por herói em função válida (até 300) + 10 por nível concluído nas quatro linhas de pesquisa (até 200). Reserva e ordens pendentes não pontuam. |
| Militar | Novos estados gravam pesos próprios: até 300 de preparo, um ponto por 90 de força acima da base, e até 200 pelas seis hordas vencidas. Perdas reduzem preparo, vitórias ficam registradas. Estados anteriores com pesos gravados mantêm esses pesos; estados v2 sem pesos mantêm divisor 6. Sem prêmio cumulativo por recomposição. |
| Conselho | Mérito reconhecido × estabilidade média das cidades. Base: decisão útil +6 por local/período de 6 dias, decreto válido +8, estabilidade após cuidado real +4. Novos pesos amortecem episódios locais pela raiz do número de cidades (mínimo 1). O novo Expresso econômico multiplica o crédito resultante por 4, compensando menos dias; teto 500. O perfil de fechamento usa créditos-base 4/6/8 (decreto/local/estável), com limites de 160/140/200. Decretos exigem ganho genuíno ou um ciclo real de administração saudável; confiança inicial e reparação exata de dano autoprovocado não geram mérito novo. Constância requer seis dias com cuidado e confiança suficiente; crise abaixo de 60 ou dano social autoprovocado reinicia o prazo. Perfis anteriores conservam créditos, limites e contrato anteriores. Estabilidade cresce de 0 a 100% entre confiança 35 e 70 de cada cidade. |
| Conquistas | Missões únicas até 300 + duas construções de Maravilha até 120 + contribuição útil até 80. Levantamento: +4 por avanço real; coleta: +4 a cada 500 unidades somadas; apoio: +12 após uso na horda; projeto: +12 após a contribuição ser utilizada na meta concluída. |

**Obras no perfil de fechamento do Expresso:** custo `arredondar(150 × 1,36^nível atual)`. Perfis anteriores continuam com 1,42. Produção, duração e pontos por obra permanecem iguais.

Danos de confiança causados pelo próprio governante ficam registrados por local. Recuperar apenas o que ele mesmo retirou não cria mérito. Perder uma cidade encerra seu relógio de estabilidade sem apagar esse histórico. Maravilhas, etapas de levantamento e apoios usados têm identificadores únicos; a coleta registra volume. Recarga e repetição não duplicam crédito.

A migração `58_SQL_COZY_ZERO_INFLUENCE.sql` cria a versão imutável por temporada: registros existentes ficam em 1, criações futuras usam 2. Cada novo estado registra níveis da capital e capacidade militar iniciais. Estados incompatíveis são rejeitados pelo servidor; não são recriados silenciosamente. **Migração 58 aplicada no Supabase real em 31/10/2026 após renovar o login:** novas criações usam versão 2, os dois mundos existentes mantêm versão 1, e o bloqueio de alteração passou no QA transacional. Hashes dos mundos, participantes, estados e recompensas foram preservados. O motor e a interface passaram localmente; a web não foi publicada nesta etapa.

## Referências e precedência

- Este arquivo: referência única de regras e direção de progresso.
- [IMPLEMENTACAO_COZY.md](IMPLEMENTACAO_COZY.md): arquitetura e comportamento implementado.
- [UI_COZY.md](UI_COZY.md): apresentação e evidências de interface.
- [DIRECAO_MAPA.md](DIRECAO_MAPA.md): estudo espacial e limites da geração atual.
- [PROXIMOS_PASSOS.md](PROXIMOS_PASSOS.md): execução do projeto.
- [BACKEND_REMOTE_QA.md](BACKEND_REMOTE_QA.md): migrações e evidência do banco real.
- [historico/README.md](historico/README.md): textos anteriores preservados, sem precedência sobre esta consolidação.

## Torres e orientação de Maravilhas — primeiro ciclo

Conquistas orienta a próxima Maravilha pela cidade mais desenvolvida que ainda não tem a obra, com requisitos e saldo reais. Construção continua na cidade e permanece instantânea pelo custo existente. Duas construções dão a parcela de reconhecimento; obras adicionais não prometem mais pontos.

Reconhecer uma torre é uma expedição opcional que usa suprimentos, prazo e fila de exploração existentes. Só a chegada registra a visita; repetir não gera um novo feito. A visita não altera exploração pontuável, reservas ou cooperação. Sintonia e bônus temporários de defesa/abastecimento estão ativos, sem acumular efeitos da mesma família; os pactos novos exigem enfrentar guardiões; pactos anteriores conservam a regra de ativação anterior. Contrato e proposta de continuidade em `CONQUISTAS_TORRES_MARAVILHAS.md`.

### Sintonia: reservas, benefício e encerramento

Reconhecimento libera pactos solo; o líder pode iniciar pactos da aliança, e membros que reconheceram a torre podem contribuir. Todos os membros atuais recebem o benefício de grupo, mas a participação pessoal só fica registrada para quem financiou. O registro não acrescenta influência, missões ou cooperação.

Um pacto pendente/ativo por escopo. Metas e efeitos usam provisoriamente os mesmos valores dos projetos atuais: defesa e abastecimento, até 7 dias e fim da temporada como limite. Vale o maior efeito de cada família entre torres e projetos comuns. Cancelamento antes da ativação, dissolução e temporada encerrada devolvem reservas uma vez. Sair remove o benefício do grupo; recursos já utilizados em pacto concluído não são devolvidos. Contrato completo em `CONQUISTAS_TORRES_MARAVILHAS.md`.

### Guardiões dos novos pactos

Pactos novos travam a força dos guardiões ao iniciar e não ativam somente por completar recursos. Um membro reconhecido envia seu exército, pagando suprimentos e tempo de viagem, e o servidor resolve a batalha na chegada. Vitória ativa a sintonia; derrota mantém as reservas para nova tentativa ou cancelamento. Força e perdas reutilizam provisoriamente o PvE existente. O confronto não concede influência, saque ou dano às cidades. Pactos antigos sem guardiões não recebem um requisito retroativo. Regras completas em `CONQUISTAS_TORRES_MARAVILHAS.md`.


## Apresentação contextual de Conselho e Governo — 31/10/2026

Em temporadas do modelo zero, o assunto do decreto considera primeiro uma crise social, depois estruturas danificadas e, sem essas situações, uma horda nos próximos três dias de jogo (o intervalo já existente dos decretos). Fora desses contextos, usa os temas regulares. A prioridade social considera mais dias de crise e, no empate, menor confiança; reparos priorizam menor integridade. A mesma seleção orienta o atalho de cuidado no Governo.

Isso muda o texto e o destino do atalho, sem modificar IDs, opções `care/invest`, efeitos numéricos, mérito, intervalo ou limite de assinaturas. Mudar o contexto não reabre um decreto assinado. Reunir materiais pelo decreto não repara estruturas nem recruta tropas automaticamente. Temporadas antigas preservam também os temas anteriores. Não foi executado balanceamento.


## Hordas das torres — implementação local de 31/10/2026

O quarto ciclo está especificado em `CONQUISTAS_TORRES_MARAVILHAS.md`. Pactos novos anunciam as ondas existentes que chegam durante o bônus. Apoio voluntário usa a oferta e o intervalo da ajuda aos aliados, sem custo de recurso, deslocamento ou fila; cada reino protege uma torre por onda. A soma confirmada resolve o encontro automaticamente: vitória preserva o prazo; derrota encerra o bônus do pacto. Não há perda direta de cidade/tropa, devolução de recursos usados ou influência por esse encontro. A horda do reino continua independente, considerando o bônus válido depois da resolução da torre. Saves/pactos anteriores sem a versão de ameaças permanecem compatíveis.

Este ciclo não recalibra força, custos, produção, duração, perdas ou influência. Não acrescenta PvP e não modifica o mapa ou o Supabase.


### Entrada em temporada iniciada — decisão de produto

Até um dia limite a definir por modo, um novo jogador poderá assumir a posição de um reino NPC reservado. Começa com zero de influência e uma capital inicial. O limite será avaliado considerando a chance real de alcançar 1.500 pontos, inclusive no Expresso. A posição do reino deve continuar a mesma após a troca de controle.

Este fluxo ainda não está implementado no Cozy. Um reino NPC já desenvolvido não pode ser transferido simplesmente com a influência zerada, pois seus níveis, pesquisas e conquistas poderiam gerar pontos imediatamente. A entrada precisa de um estado inicial elegível e de uma transferência transacional, com proteção contra dois jogadores assumirem a mesma vaga.
