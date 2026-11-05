# King's World: regras novas

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

---

## 1. Visão e pilares

**Decisão:** Um jogo cozy de estratégia por temporada, em que um reino cooperativo segura as hordas de NPCs e, no fim, cruza o Portal Central. Os 8 pilares da seção 9 valem como estão.

**Notas:**
- Coop PvE, sem PvP tóxico. Alianças cooperam e defendem contra hordas e eventos do mundo.
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

**Decisão:** Capital mais 9 colônias, no máximo 10 cidades. Cada cidade tem 5 setores (cards). Os 5 precisam existir pra infraestrutura subir, e os 5 precisam ser bons.

**Notas:**
- Coroa (card 1, da cidade): em aberto. Hoje no código, Palácio dá teto político (100 + 45 por nível) e Senado dá teto de influência (500 + 250 por nível). No novo modelo, o Senado virou Conselho. Onde ficam: a definir.
- Economia (card 2): produz só alimentos e materiais. Não tem mais malha viária. Ouro não sai daqui.
- Sociedade (card 3): só sobe de nível, de 0 a 10. Contentamento, empregos e status são dados extras.
- Recrutamento (card 4): só sobe de nível, de 0 a 10.
- Defesa (card 5): sobe de nível, de 0 a 10, e aumenta o total (a confirmar qual). Como funciona a muralha (barreira ou muro): a definir.
- Maravilha: aparece na própria cidade, na aba Infraestrutura, quando a cidade chega a 100. Dá bolinha de notificação na aba.
- O nome "Coroa" do setor vai ser trocado depois.

## 6. Exército e recrutamento

**Decisão:** O exército fica na Coroa. Recruta pelo Card Militar, em lotes (+1, +5, máximo). Não anda pelo mapa.

**Notas:**
- Tipos de tropa: já tem a base. Conferir no código, depois.
- O card Militar, na Coroa, recruta cada tipo de tropa disponível, no nível de pesquisa atual (item 19).
- Subir o Recrutamento nas cidades dá bônus ou abre limite. Acho que baixa o custo (vai pro balanceamento).

## 7. Hordas e defesa

**Decisão:** Hordas atacam em ondas e a defesa é automática: o poder global do exército responde sozinho. O jogador também ataca NPCs (cidade inexplorada ou para conquistar). O ataque tem tempo de chegada, avisa quando chega, e o relatório do combate cai nas notificações na hora da chegada.

**Notas:**
- A horda também avisa com tempo de chegada, igual ao ataque do jogador.
- Conquistar aldeia de NPC exige um herói comprado com ouro. A conquista não custa mais nada: ao conquistar, você escolhe um herói disponível da pool, já pago.

## 8. Mapa e exploração

**Decisão:** Antes de revelar, o jogador vê uma pista do que tem no ponto (ex.: "parece ter ruína"). O resultado completo aparece depois de revelar. Ao escolher um ponto, ele escolhe se quer explorar ou atacar, para não perder tropas por engano.

**Notas:**
- Custo de explorar: só suprimentos, sem tropas.
- Revelar leva tempo, que depende da distância (igual ao ataque).
- Locais de mineração no mapa, de onde vem o ouro (ideia, a confirmar). O mapa de hoje já tem "Mina Rara", dá pra reaproveitar.
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

## 17. O que sai do modelo atual

**Decisão:** Sai: PvP entre jogadores (e a eliminação pela capital), tropa por cidade e expedição com equipe. A tribo vira aliança.

**Notas:**
- Entra no lugar: exército universal na Coroa (item 6) e exploração passiva (item 8).

## 18. Áreas de recursos coletivas

**Decisão:** Qualquer jogador explora a área, sozinho ou junto com o clã. Quando ela está inteira explorada, dá pra ir lá e coletar até a área esgotar. A área tem depósitos de tamanhos diferentes, de ouro ou materiais. Comida não sai daqui.

**Notas:**
- São os mesmos locais de mineração do item 9. Sim.

## 19. A Coroa: os 5 cards do centro do reino

**Decisão:** A Coroa tem 5 cards: Infraestrutura, Militar, Governo, Conselho e Conquistas.

**Notas:**
- Infraestrutura: resume as cidades, com atalho pra pular em qualquer uma.
- Militar: recruta cada tipo de tropa disponível, no nível de pesquisa atual (item 6).
- Governo: heróis e pesquisa, com slots e status (itens 10 e 11).
- Conselho (no lugar do Senado): cards e 2 slots de representantes políticos (item 12).
- Conquistas: slots de quests que dão influência (item 4).

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

## Prancheta (depois, não adianta ver agora)

- Cosméticos e itens de ajuda (item 15).
- Cards de ações da cidade, opcionais, de uns 30 minutos (item 2).
- Customização visual: skins e decorações (item 15).
- Como entrar na aliança, adicionar amigo e o bônus (item 13).

## Perguntas em aberto

- Palácio e Senado: onde ficam?
- Muralha e defesa: como funciona (barreira ou muro)?
- Defesa aumenta "o total". Qual total?
