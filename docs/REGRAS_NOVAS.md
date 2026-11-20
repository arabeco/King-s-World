# King's World: regras novas

> **Fonte de verdade das regras.** Se `REGRAS_DO_JOGO.md`, `BALANCEAMENTO-REIS-ITENS-MVP.md` ou o código contradisserem este arquivo, vale este. Itens sem [x] e "Perguntas em aberto" ainda não estão decididos: não invente regra para eles.

Documento em branco, preenchido item por item, com perguntas. Cada item tem **Decisão** (o que vale no jogo) e **Notas** (números, exceções, ideias para depois). Quando um item estiver fechado, marque [x] na lista de progresso.

## Progresso

- [x] 1. Visão e pilares
- [x] 2. Loop diário
- [ ] 3. Temporada e fases
- [x] 4. Influência (as 5 áreas)
- [x] 5. Cidades e setores
- [x] 6. Exército e recrutamento
- [x] 7. Hordas e defesa
- [x] 8. Mapa e exploração
- [x] 9. Recursos e economia
- [x] 10. Heróis, especialistas e diplomatas
- [x] 11. Pesquisas
- [x] 12. Senado e decisões
- [x] 13. Aliança e cooperação
- [x] 14. Fim da temporada e Êxodo
- [x] 15. Cosméticos, Selo de Vitória e Hall da Fama
- [ ] 16. Modo expresso
- [x] 17. O que sai do modelo atual
- [x] 18. Áreas de recursos coletivas
- [x] 19. A Coroa: os 5 cards do centro do reino
- [x] 20. Elementos cozy
- [x] 21. Telas, cidades e prédios (20/11)

---

## 1. Visão e pilares

**Decisão:** Um jogo cozy de estratégia por temporada, em que um reino cooperativo segura as hordas de NPCs e, no fim, cruza o Portal Central. Os 8 pilares da seção 9 valem como estão.

**Notas:**
- Coop PvE, sem PvP tóxico. Alianças cooperam e defendem contra hordas e eventos do mundo.
- PvP é uma chave por mundo: ligada, o mundo vira competitivo (ver Modos).
- Exército universal na Coroa, recrutado pelo Card Militar em lotes, sem mover tropas pelo mapa.
- Infraestrutura limpa nas cidades: subir setores, sem microgerenciamento de prédios.
- Defesa sem deslocamento: a horda é resolvida pelo poder global do exército, com relatório.
- Mapa por áreas e cores: amarelo ao anexar, verde ao dominar.
- Exploração passiva: clica para revelar e o tempo avança.
- Pesquisas independentes, com aba própria. O Sábio acelera.
- Influência de 0 a 2500, dividida em 5 áreas de 0 a 500.
- Galeria de Reis e Êxodo: na Fase 4, 1500 ou mais de Influência para cruzar o Portal Central.

## 2. Loop diário

**Decisão:** Abre o jogo, lê o relatório do dia (o que aconteceu no reino e nas hordas), faz uma ou duas ações (subir um setor, recrutar um lote, tomar uma decisão do Senado), marca um ponto do mapa para explorar, revela e confere se o ponto mostrou o que ele queria. Depois fecha.

**Notas:**
- Explorar não é opcional: o jogador quer ver se a revelação bateu com o que ele marcou.
- O que ele vê antes de revelar (pista ou nada) vai para o item 8 (mapa).
- Base: 5 a 10 minutos.
- Opcional, para quem quer uns 30 minutos: customizar as cidades e os cards de ações da cidade (a definir depois). Nada disso é obrigatório.

## 3. Temporada e fases

**Decisão:** Temporada clássica de 120 dias. Cada dia de jogo é um dia real, então o jogador entra uma vez por dia.

**Notas:**
- As fases são uma dica para o jogador, não uma regra fixa.
- Não há evento no dia 90. O Êxodo são os últimos 30 dias (dias 91 a 120): o jogador tem 30 dias para chegar ao Portal.
- Provisório. Marcos internos (dia 30, dia 60...) podem existir, sem pressão pro jogador. Os alvos podem mudar no balanceamento.

## 4. Influência (as 5 áreas)

**Decisão:** Cinco áreas de 0 a 500 cada, total 2500: Infraestrutura, Governo, Militar, Sociedade e Legado.

**Notas:**
- Pontuação de cada área: vai pro balanceamento. Ponto de partida na seção 9.2 de `docs/REGRAS_DO_JOGO.md`.
- Quests de era: slots no card Conquistas, da Coroa, que dão influência (item 19).
- Hoje no código: 1000, 500, 400, 300 e 300 (total 2500).

## 5. Cidades e setores

> **Os setores foram substituídos pelos 5 prédios do item 21.** Continua valendo: capital mais 9 colônias, no máximo 10 cidades, e cada cidade nova custa mais.

**Decisão:** Capital mais 9 colônias, no máximo 10 cidades. Cada cidade tem 5 setores (cards). Os 5 precisam existir pra infraestrutura subir, e os 5 precisam ser bons.

**Notas:**
- Coroa (card 1, da cidade): em aberto. Hoje no código, Palácio dá teto político (100 + 45 por nível) e Senado dá teto de influência (500 + 250 por nível). No novo modelo, o Senado virou Conselho. Onde ficam: a definir.
- Economia (card 2): produz só alimentos e materiais. Não tem mais malha viária. Ouro não sai daqui.
- Sociedade (card 3): só sobe de nível, de 0 a 10. Contentamento, empregos e status são dados extras.
- Recrutamento (card 4): só sobe de nível, de 0 a 10.
- Defesa (card 5): sobe de nível, de 0 a 10, e aumenta o total (a confirmar qual). Como funciona a muralha (barreira ou muro): a definir.
- Maravilha: aparece na própria cidade, na aba Infraestrutura, quando a cidade chega a 100. Dá bolinha de notificação na aba.
- O nome "Coroa" do setor vai ser trocado depois.
- Cap de 10 cidades mantido. Cada cidade nova custa mais que a anterior, em curva não reta (ver Balanceamento).

## 6. Exército e recrutamento

**Decisão:** O exército fica na Coroa. Recruta pelo Card Militar, em lotes (+1, +5, máximo). Não anda pelo mapa.

**Notas:**
- Tipos de tropa: já tem a base. Conferir no código, depois.
- O card Militar, na Coroa, recruta cada tipo de tropa disponível, no nível de pesquisa atual (item 19).
- Subir o Recrutamento nas cidades dá bônus ou abre limite. Acho que baixa o custo (vai pro balanceamento).

## 7. Hordas e defesa

> **Substituído pelo item 21:** a horda virou missão opcional, com dificuldade inteligente.

**Decisão:** Hordas atacam em ondas e a defesa é automática: o poder global do exército responde sozinho. O jogador também ataca NPCs (cidade inexplorada ou para conquistar). O ataque tem tempo de chegada, avisa quando chega, e o relatório do combate cai nas notificações na hora da chegada.

**Notas:**
- A horda também avisa com tempo de chegada, igual ao ataque do jogador.
- Conquistar aldeia de NPC exige um herói comprado com ouro. A conquista não custa mais nada: ao conquistar, você escolhe um herói disponível da pool, já pago.

## 8. Mapa e exploração

**Decisão:** Antes de revelar, o jogador vê uma pista do que tem no ponto (ex.: "parece ter ruína"). O resultado completo aparece depois de revelar. Ao escolher um ponto, ele escolhe se quer explorar ou atacar, para não perder tropas por engano.

**Notas:**
- Custo de explorar: só suprimentos, sem tropas.
- Revelar leva tempo, que depende da distância (igual ao ataque).
- Locais de mineração no mapa, de onde vem o ouro: entram (item 18). O mapa de hoje já tem "Mina Rara", dá pra reaproveitar.
- Anexar cidade vazia: achar, pagar e ter tropa maior, com sobra (ver item 10).

## 9. Recursos e economia

**Decisão:** Três recursos: Ouro, Alimento (suprimentos) e Materiais de Construção.

**Notas:**
- Hoje no código: materiais e suprimentos, sem ouro.
- Ouro: compra heróis e paga pesquisas. A conquista exige um herói comprado (item 7).
- Ouro: achado no mapa, em cidade abandonada, em luta ou em mina (item 18). Materiais: da Economia da cidade e das áreas de recurso (item 18).
- Alimento (suprimentos): gasta só na exploração, sem sustentar o exército. Vem das Fazendas nas cidades (setor Economia).
- Materiais de Construção: pagam tropas e subir os setores das cidades (infraestrutura).

## 10. Heróis, especialistas e diplomatas

**Decisão:** 10 vagas de herói, em 5 tipos: General, Engenheiro, Administrador, Explorador e Sábio. Os heróis ficam numa pool, e cada cidade aceita no máximo um herói.

**Notas:**
- Diplomatas saem. Para ocupar cidade vazia: achar, ter um herói (que já custa ouro) e ter tropa maior, com sobra. Sem herói, dá pra saquear.
- Conquistar aldeia exige herói comprado. Ao conquistar, escolhe um herói disponível da pool, já pago (ver item 7).

## 11. Pesquisas

**Decisão:** Pesquisa é paga com ouro. Tem aba própria, separada dos heróis. O Sábio acelera.

**Notas:**
- O que cada pesquisa dá: vai pro balanceamento.
- A pesquisa fica no card Governo, da Coroa (item 19).

## 12. Senado e decisões

**Decisão:** O Senado tem 2 conselheiros. Você escolhe eles de graça, e dá pra trocar. Cada um tem uma moral (personalidade): um mais político e outro mais interno. As cartas de decisão podem vir com o nome de um deles.

**Notas:**
- Cartas de decisão (decretos): cada escolha, e o efeito só aparece depois de assinar.
- A moral do conselheiro muda as opções da carta (ex.: mais duro ou mais social).
- Na seção 9 eram 2 a 3 avatares. Agora são 2.
- Os cargos dos conselheiros: depois.
- O Senado vira Conselho, card da Coroa (item 19).
- Conselho com cards de decisão fica no jogo: é o clima cozy.

## 13. Aliança e cooperação

**Decisão:** Aliança é um grupo de jogadores que divide metas. O apoio é um bônus de defesa pro aliado contra horda, sem mover tropa. O aliado pede, e um membro manda ou aceita o pedido, mas só vale se der tempo, antes da horda chegar.

**Notas:**
- Aliança substitui a tribo (seção 9, onde se chamava clã). Lealdade da aliança: a definir.
- Entrar na aliança: a definir. Adicionar amigo e bônus: prancheta.
- Apoio: duração e cooldown, vai pro balanceamento.

## 14. Fim da temporada e Êxodo

**Decisão:** O Êxodo são os últimos 30 dias (91 a 120). Quem cruza o Portal Central com 1500 ou mais de Influência ganha o Selo de Vitória.

**Notas:**
- O Portal não tem cooldown.
- Como atravessar (ascender agora ou um dos 3 ritos): item 21.
- Ao fim da temporada: ranking, relatório e dados. Hall da Fama e troféu pro 1º lugar.

## 15. Cosméticos, Selo de Vitória e Hall da Fama

**Decisão:** Cosméticos (às vezes bônus) e o nível de conta valem nas próximas temporadas. Aparecem no lobby, fora do jogo. O nível de conta é XP. Ganha XP por terminar a temporada e por posição no ranking. Itens de ajuda (não cosméticos) seguem a mesma lógica.

**Notas:**
- Selo de Vitória, Hall da Fama e troféu: ver item 14.
- Quais cosméticos existem: prancheta.
- Quais itens de ajuda existem e o que cada um faz: prancheta.

## 16. Modo expresso

**Decisão:** Igual ao clássico, mas com 30 dias. O tempo passa 4 vezes mais rápido: 1 dia de jogo = 6 horas reais. Provisório: o dono vai pensar depois.

**Notas:**
- Hoje no código, o Portal só abre no dia 91, e o expresso para no dia 30. A detalhar.
- Fica no desenho, fora da primeira versão.

## 17. O que sai do modelo atual

**Decisão:** Sai do padrão: PvP entre jogadores (e a eliminação pela capital), que volta como chave opcional, por mundo (ver Modos). Também sai: tropa por cidade e expedição com equipe. A tribo vira aliança.

**Notas:**
- Entra no lugar: exército universal na Coroa (item 6) e exploração passiva (item 8).

## 18. Áreas de recursos coletivas

**Decisão:** Qualquer jogador explora a área, sozinho ou junto com o clã. Quando ela está inteira explorada, dá pra ir lá e coletar até a área esgotar. A área tem depósitos de tamanhos diferentes, de ouro ou materiais. Comida não sai daqui.

**Notas:**
- São os mesmos locais de mineração do item 9. Sim.
- Entra no escopo. Não fica pra depois.

## 19. A Coroa: os 5 cards do centro do reino

> **Substituído pelo item 21:** os 5 cards da Coroa viraram a barra de baixo (Reino + as 5 áreas de influência).

**Decisão:** A Coroa tem 5 cards: Infraestrutura, Militar, Governo, Conselho e Conquistas.

**Notas:**
- Infraestrutura: resume as cidades, com atalho pra pular em qualquer uma.
- Militar: recruta cada tipo de tropa disponível, no nível de pesquisa atual (item 6).
- Governo: heróis e pesquisa, com slots e status (itens 10 e 11).
- Conselho (no lugar do Senado): cards e 2 slots de representantes políticos (item 12).
- Conquistas: slots de quests que dão influência (item 4).

## 20. Elementos cozy

**Decisão:**
- Carta do Conselho: fica na própria tela do Conselho, não no relatório. Tom quente: uma coisa boa, um problema pequeno e uma escolha.
- Acontecimentos nas cidades: cada cidade tem cards de acontecimentos. Só os conselheiros e os 10 heróis têm nome.
- Estações: as 4 fases viram estações na Coroa e no mapa. Só visual, a regra não muda.
- Colheita: um toque na Coroa recolhe de todas as cidades de uma vez, com a animação passando pelas cidades. Dentro de uma cidade, dá pra recolher só a dela.
- Sem castigo por sumir: quem fica uns dias fora não perde nada. A horda é resolvida pelo exército, a colheita acumula, e na volta a carta do Conselho resume o que aconteceu.
- Presente pro aliado: além do apoio de defesa, dá pra mandar suprimentos ou materiais pra um aliado, sem tropa. Ouro não vai, pra ninguém usar conta reserva pra juntar ouro numa conta principal.

## 21. Telas, cidades e prédios

**Decisão:** O jogo fica com menos telas e o reino fala com você. A barra de baixo tem 6 botões: **Reino** (home) e as 5 áreas de influência (**Infra, Militar, Governo, Sociedade, Legado**). Cada botão acende um sinal quando tem algo pra fazer e mostra um anelzinho de progresso da área (sem número). As cidades têm **5 prédios**, de 0 a 3, no lugar dos setores.

**Notas:**
- **Reino (home):** a vista bonita das suas cidades. Em cada cidade: **!** quando tem algo pendente, barrinhas e o evento que está rolando. Atalhos: **Mapa** (muda a visão ou dá zoom ali mesmo) e **Relatos**.
- **Infra:** lista das cidades em cards, com **!** e nível (ex.: 7/15). Tocar abre a cidade direto nas **Decisões**. Quando resolve as importantes, aparece "Tudo certo por aqui", com a opção de ver as decisões pequenas.
- **Notícias de reação:** além das decisões, chegam notícias boas pra recolher (ex.: "os mercadores agradeceram a festa" → Recolher +80 ouro). Podem dar recurso, satisfação ou um empurrão de influência via Conselho.
- **Militar:** um exército só, do reino. Recruta **em grupos**, não unidade. Mostra as missões em andamento. Atalho pra pesquisa ("liberar tropas mais fortes"). A pesquisa militar pode pedir uma cidade com Quartel no nível X.
- **Infra (topo):** aviso "X cidades precisam de atenção", com o motivo (ex.: Pedravale, greve; Aurora, lealdade baixa).
- **Governo:** heróis em cima, um card por herói (rosto, tipo, cidade que governa). Heróis livres aparecem como "prontos pra uma cidade nova". Contratar com ouro, até 10. **O tipo do herói turbina um prédio da cidade e muda os cards que ele traz** (ex.: General → Quartel e assuntos de guerra; Administrador → Fábrica e comércio).
- **Pesquisa (no Governo):** grade 3×3 de cards quadrados (PNG/SVG bonitos). Linhas Militar, Economia e Exploração, 3 níveis cada. Apagado = não pesquisado, aceso = pesquisado. Tocar abre um modal: o que faz, custo em ouro, tempo e o que pede (ex.: cidade com Quartel 2). O Sábio acelera.
- **Sociedade = a aba mais importante.** Subabas em cima: **Conselho** e **Aliança** (a aliança precisa da tela inteira; também dá pra chegar pelo mapa).
  - Topo: os 2 conselheiros, um de cada lado, com a **relação** de cada um com você. A relação muda os cards e decide se ele quer sair. Relação baixa: primeiro um aviso ou card no Conselho; se não cuidar, ele vai embora e você escolhe outro.
  - **Decisões:** banners no meio da tela. Tocar abre as decisões uma por uma, em banner. Só coisas importantes; as pequenas ficam nas cidades.
  - **Notícias e resgates:** bloco separado, sem escolha, só recolher (ex.: ruína achada explorando → Recolher +120 materiais).
  - **O Conselho é a central de notificações do reino**, incluindo o que você acha explorando. Separar sempre o que é notícia/resgate do que é decisão.
- **Legado = quests:** checklist do que foi cumprido e do que liberou (ex.: se o Monumento abriu). As missões chegam e são aceitas no Conselho; o Legado mostra o que elas viraram.
- **Livro do Reino (Legado):** quests em **capítulos da temporada** (ex.: Fundação, Crescimento, Glória, Êxodo). **Nenhum capítulo é trancado:** todos dá pra fazer, só ficam **colapsados**, e o capítulo atual aparece aberto. Cada quest tem check e uma recompensinha pra recolher. Capítulo completo dá algo grande (influência de Legado, cosmético ou liberar o Monumento). As quests usam as coisas novas: prédios, festas, lealdade alta, missões cumpridas, ajudar aliado. Substitui as 6 quests de hoje (várias falam de horda e nível 40, que mudaram).
- **Quests do Livro do Reino:**
  - **1 · Fundação** (recompensa: um herói, pra 2ª cidade): construir a primeira Fábrica; tomar a primeira decisão no Conselho; explorar 5 pontos do mapa; recrutar o primeiro grupo; dar uma festa numa cidade. O capítulo 1 ensina o jogo sem tutorial.
  - **2 · Crescimento** (recompensa: cosmético, brasão ou visual da cidade, + Legado): governar 3 cidades; levar um prédio ao nível 3; vencer 3 missões; concluir 2 pesquisas; ter uma cidade com lealdade alta.
  - **3 · Glória** (recompensa: muito Legado + título): levar uma cidade a 15/15; erguer um Monumento; ajudar um aliado **ou** atender 5 pedidos do povo (quem joga sozinho não trava); passar um dia sem nenhuma cidade triste; ter uma Festa e uma Feira no mesmo dia.
  - **4 · Êxodo** (recompensa: Selo de Vitória): juntar 1500 de Glória; escolher como atravessar; atravessar o Portal.
- **Travessia do Portal (4 caminhos, escolhe 1):**
  - **Ascender agora:** o mais cozy. Atravessa na hora, sem prova. Ganha o Selo de Vitória.
  - **Rei guerreiro:** rito de batalhas pra abrir caminho até o Portal.
  - **Rei próspero:** rito de riqueza pra equipar a grande caravana.
  - **Rei amado:** rito do povo pra reunir as cidades leais.
  - Os 3 ritos são caprichados e **duram um tempo**: algumas etapas ao longo de alguns dias, cada uma chegando como card do Conselho com escolha e acontecimento, e o herói contando como foi. Dificuldade inteligente.
  - **Se der errado, não perde nada:** tenta de novo ou desiste e ascende agora.
  - **Recompensa do rito:** Selo de Vitória + título e visual do caminho (ex.: "o Guerreiro", brasão de batalha) + mais Legado.
  - Vem do Rito da Travessia que já existe no modo persistente (hoje: 2 de 3 provas), agora como 1 de 3, mais longo e caprichado.
- **A horda vira missão opcional.** O Conselheiro 2 traz a ameaça como card (ex.: "Saqueadores rondam a estrada de Pedravale"). Você aceita ou deixa passar. **Dificuldade inteligente:** o inimigo é calculado pelo seu exército, e a chance aparece antes ("chance alta", "arriscado"); nunca vem surpresa impossível. Recompensa: recurso, influência militar e itens pras quests do Legado.
- **Deixar a missão passar:** a cidade fica um pouco triste, com limite. Quem fica um mês fora volta com cidades no máximo "meio pra baixo", nunca em revolta, sem perder prédio nem tropa. Sempre dá pra consertar.
- **Ordens do rei (no modal da cidade):** o rei age por conta própria sobre a cidade. Poucas ações, com custo e tempo de espera: **Dar uma festa** (satisfação sobe bastante), **Visitar a cidade** (lealdade sobe), **Perdoar impostos** (mais barato, abre mão de ouro por uns dias), **Promover algo** (feira, torneio: puxa evento bom). O Conselho só avisa ("Pedravale anda triste") e o card leva direto pra cidade. **Regra de lugar:** o Conselho traz coisas até você (reativo); na cidade, você age sobre ela (proativo).
- **Público (princípio):** proteger o jogador cozy e agradar mulheres e adolescentes. Tom de aventura, não de carnificina: proteger aldeões, escoltar caravana, resgatar viajantes.
- **Influência (como aparece):** continua com 5 áreas de 0 a 500 (total 2500, Portal com 1500), mas **sem planilha na tela**:
  - **Glória do Reino:** uma barra só no topo, enchendo até o Portal (1500).
  - Na barra de baixo, cada área tem **um anelzinho que vai enchendo, sem número**. A área mais fraca brilha ("cresça aqui").
  - Quem quiser os números exatos toca na barra de Glória e vê o detalhe (pro jogador competitivo e pro ranking).
  - Fontes: Infra = Fábricas e cidades; Militar = Quartéis e missões vencidas; Governo = Palácios, heróis e pesquisas; Sociedade = Praças e decisões do Conselho; Legado = Templos, Livro do Reino e Monumento.
- **Cards ligados a tudo (princípio):** o que decide os cards: evento da cidade, satisfação, lealdade, tipo do herói, nível dos prédios, próximo ataque, conselheiro que fala e fase da temporada. O que os cards mexem: recursos, barrinhas, prédios, herói, influência e os próximos eventos.
- **Vozes:** o Conselheiro 1 traz as decisões importantes do reino. O Conselheiro 2 traz missões e assuntos militares. Nas cidades, você fala com o **herói daquela cidade**.
- **Heróis:** toda cidade tem herói. Pra pegar uma cidade, precisa mandar um herói, e ele fica como a voz dela. **Você é o herói da capital**: não nomeia ninguém no começo.
- **Prédios (0 a 3 cada, máx. 15 por cidade).** Subir é caro, e o recurso volta a ser bloqueio:
  - **Fábrica:** produção e coleta de materiais (Infra). Os cards podem mexer nas duas.
  - **Quartel:** vagas do exército do reino e defesa da cidade (Militar).
  - **Palácio:** herói da cidade mais forte, cards melhores (Governo). Na capital, o Palácio é o seu.
  - **Praça:** satisfação (Sociedade).
  - **Templo:** lealdade (Legado).
  - **Monumento:** slot extra, aparece num espaço vazio quando a cidade chega em 15/15. É a maravilha.
- **Duas barrinhas por cidade:**
  - **Satisfação** (Praça): a vida do povo. Muda rápido. Mexe na produção e gera eventos (festa, greve).
  - **Lealdade** (Templo): a relação com a Coroa. Muda devagar. Baixa: a cidade pensa em se separar. Alta: as decisões arriscadas dão certo com mais frequência.
  - As decisões puxam uma contra a outra (ex.: imposto na festa = +ouro, −lealdade; justiça dura = +lealdade, −satisfação).
- **Eventos da cidade:** são o que está rolando ali, não o status. Nascem do status: abundância → festa, feira, mercadores; insatisfeita → greve, protesto; ameaçada → pânico, voluntários. **O evento define os cards que o herói traz.**
- **Decisões com risco:** antes de escolher você vê o que ganha se der certo e o que perde se der errado. Descobre na hora, e a cidade reage. As decisões têm peso: alta, média, baixa ou muito baixa.

**Em aberto:**
- Quanto dá cada recompensinha das quests (balanceamento).
- Quanto cada fonte dá de influência (balanceamento).

---

## Balanceamento (depois, tudo junto)

- Pontuação das 5 áreas de Influência, de 0 a 500 cada (item 4).
- Calibrar os 35/50 que o dono quer que o jogador ganhe (item 8). A esclarecer o que são.
- Custo de tropa, herói, pesquisa e setor, em ouro, materiais e alimento (itens 6, 9, 10 e 11).
- Recrutamento: quanto baixa o custo do exército, e o bônus ou limite (itens 5 e 6).
- Ocupar cidade vazia e conquistar aldeia: custo do herói e tropa com sobra (itens 7 e 10).
- Tempo de exploração e de revelar (item 8).
- Tempo de coleta e quanto cada depósito dá (item 18).
- Duração e cooldown do apoio (item 13).
- Defesa e muralha: valores (item 5).
- Pesquisas: o que cada uma dá, e o tempo (item 11).
- Tipos de tropa e composição (item 6).
- XP do nível de conta e itens de ajuda (item 15).
- Marcos internos e alvos da temporada (item 3).
- Expresso: fases e Êxodo em 30 dias (item 16).
- Custo das cidades novas: cada uma fica mais cara, em curva não reta (item 5).
- Simular influências: quanto tempo leva pra juntar 10 cidades. Pode demorar (itens 4 e 5).

## Prancheta (depois, não adianta ver agora)

- Cosméticos e itens de ajuda (item 15).
- Cards de ações da cidade, opcionais, de uns 30 minutos (item 2).
- Customização visual: skins e decorações do reino, PNG por nível e tipo. Ainda não existe; fazer não é problema, é troca de PNG. Quantas variações: a definir (item 15).
- Como entrar na aliança, adicionar amigo e o bônus (item 13).

## Modos (ideia abstrata, virar 3 possibilidades depois)

- **Modo sobrevivência (ideia):** sem condição de vitória. O jogador entra, cuida da cidade e expande, e o mapa pode ser enorme. Zerar a temporada dá prêmios conforme a influência alcançada e o tempo que levou. Prêmios ficam no desenho, fora da primeira versão.
- **Modo atual (Portal):** vitória ao cruzar o Portal Central com 1500 ou mais na Fase 4.
- **Ideia:** o modo sobrevivência seria o tryhard, para quem já jogou o outro e domina a influência.
- **Muda junto:** lobby, tamanho do mundo e escolha de modo.
- **Problema pra depois, vale pros dois modos:** simplificar o jogo, saber o que dá pra upar e o que está em aberto ou pra trás.
- **Chave de PvP (decidido, por mundo):** cada mundo nasce cozy (PvP desligado, coop PvE) ou competitivo (PvP ligado). Casual e tryhard ficam em mundos separados.

## Perguntas em aberto

- Palácio e Senado: onde ficam?
- Muralha e defesa: como funciona (barreira ou muro)?
- Defesa aumenta "o total". Qual total?
