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
- [ ] 12. Senado e decisões
- [x] 13. Aliança e cooperação
- [x] 14. Fim da temporada e condição de vitória
- [x] 15. Cosméticos, Selo de Vitória e Hall da Fama
- [ ] 16. Modo expresso
- [x] 17. O que sai do modelo atual
- [x] 18. Áreas de recursos coletivas
- [x] 19. A Coroa: os 5 cards do centro do reino
- [ ] 20. Torres opcionais: bônus, desafios e posicionamento equilibrado
- [ ] 21. Motor de combate e modos Cozy/competitivo
- [ ] 22. Cards com custo, recompensa, tempo e risco

---

## 1. Visão e pilares

**Decisão:** Um jogo cozy de estratégia por temporada, em que um reino cooperativo cresce, ganha influência e segura as hordas de NPCs. O objetivo atual é alcançar 1.500 de influência (item 14). Os 8 pilares da seção 9 valem como estão.

**Notas:**
- Coop PvE, sem PvP tóxico. Alianças cooperam e defendem contra hordas e eventos do mundo.
- Exército universal na Coroa, recrutado pelo Card Militar em lotes, sem mover tropas pelo mapa.
- Infraestrutura limpa nas cidades: subir setores, sem microgerenciamento de prédios.
- Defesa sem deslocamento: a horda é resolvida pelo poder global do exército, com relatório.
- Mapa por áreas e cores: amarelo ao anexar, verde ao dominar.
- Exploração passiva: clica para revelar e o tempo avança.
- Pesquisas independentes, com aba própria. O Sábio acelera.
- Influência de 0 a 2500, dividida em 5 áreas de 0 a 500.
- Vitória: alcançar 1.500 de influência.

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
- A antiga janela de Êxodo (dias 91 a 120) dependia da vitória pelo Portal e está em revisão. Não há mais obrigação de chegar ao centro.
- Provisório. Marcos internos (dia 30, dia 60...) podem existir, sem pressão pro jogador. Os alvos podem mudar no balanceamento.

## 4. Influência (as 5 áreas)

**Decisão:** Cinco áreas de 0 a 500 cada, total 2500: Infraestrutura, Governo, Militar, Conselho e Conquistas. Os identificadores antigos dos saves são preservados.

**Notas:**
- Pontuação de cada área: vai pro balanceamento. Ponto de partida na seção 9.2 de `docs/REGRAS_DO_JOGO.md`.
- Quests de era: slots no card Conquistas, da Coroa, que dão influência (item 19).
- O motor cozy atual já usa cinco tetos de 500. As fórmulas internas ainda estão em revisão.

### Direção de influência e Governo em revisão

Influência representa o reconhecimento do reino por seus feitos: infraestrutura, capacidade de governo, segurança militar, confiança social e legado. O usuário propôs começar em zero e ter crescimento compreensível. Não confundir possuir uma capital/exército inicial com já ter conquistado prestígio. A forma de descontar a base inicial e distribuir progresso até 500 precisa ser definida antes de alterar os saves; o motor ainda inicia com influência positiva.

**Proposta de Governo:** 300 pontos de heróis (10 × 30) e 200 de pesquisa (se forem quatro linhas pontuáveis, 4 × 50 no máximo). Níveis intermediários teriam valores progressivos, ainda não aprovados. Não confundir quatro linhas de pesquisa com quatro pesquisas simultâneas: quantidade de slots/concomitância continua em definição. Decidir também se contam heróis contratados ou em função; o motor atual pontua heróis atribuídos.

**Mapa entre menus e influência:** Infraestrutura → Infraestrutura; Governo → Governo; Militar → Militar; Conselho → Sociedade; Conquistas → Legado. Conselho é o lugar de decidir, Sociedade é a dimensão de influência que representa a relação com o povo. A proposta de Sociedade deve valorizar confiança, estabilidade e resolução de problemas; quantidade de cliques ou decisões assinadas não é, por si só, boa liderança. A fórmula final fica para o balanceamento.

## 5. Cidades e setores

**Decisão:** Capital mais 9 colônias, no máximo 10 cidades. Cada cidade tem 5 setores (cards). Os 5 precisam existir pra infraestrutura subir, e os 5 precisam ser bons.

**Notas:**
- Coroa (card 1, da cidade): em aberto. Hoje no código, Palácio dá teto político (100 + 45 por nível) e Senado dá teto de influência (500 + 250 por nível). No novo modelo, o Senado virou Conselho. Onde ficam: a definir.
- Economia (card 2): produz só alimentos e materiais. Não tem mais malha viária. Ouro não sai daqui.
- Sociedade (card 3): só sobe de nível, de 0 a 10. Contentamento, empregos e status são dados extras.
- Recrutamento (card 4): só sobe de nível, de 0 a 10.
- Defesa (card 5): somente nível de 0 a 10. Esse nível entra na conta das ações/custos/eficiência de defesa do Militar. A muralha imperial e as escolhas de investimento ficam na Coroa → Militar; não criar um segundo construtor de muralhas dentro da cidade.
- Maravilha: aparece na própria cidade, na aba Infraestrutura, quando a cidade chega a 100. Dá bolinha de notificação na aba.
- O nome "Coroa" do setor vai ser trocado depois.

## 6. Exército e recrutamento

**Decisão:** O exército fica na Coroa. Recruta pelo Card Militar, em lotes (+1, +5, máximo). Não anda pelo mapa.

**Nova direção de interface e sistema:** Militar tem Recrutamento e Defesa, ambos com ações reais. Defesa permite investir/evoluir a muralha do império e escolher alternativas de defesa com custos e vantagens diferentes. Pesquisas militares/defensivas entram nessa progressão. Os níveis de Defesa das cidades ajudam na conta dessas ações; a fórmula ainda não foi definida. A aba atual de Defesa mostra informações e atalhos, mas ainda não tem a muralha imperial como entidade própria nem novos investimentos.

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

**Revisão de direção em 30/10/2026:** Até 20 jogadores, nascimentos distribuídos pelo interior e expansão em várias direções, sem destino obrigatório no centro. Planejar espaço para cerca de 7 cidades por império, mantendo o limite de 10. Menos áreas de recurso, maiores e de tamanhos variados. O raio 34 (3.571 hexágonos) é uma proposta visual, ainda não uma migração do mundo real. Ver `DIRECAO_MAPA.md`.

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

## 14. Fim da temporada e condição de vitória

**Decisão atualizada em 30/10/2026:** O objetivo por enquanto é alcançar **1.500 pontos de influência**. O Selo de Vitória é registrado automaticamente pelo servidor durante a temporada ativa. Não exige viagem, posição, maravilha ou dia 91. A temporada continua até a classificação final; quedas posteriores de influência não removem a conquista.

**Notas:**
- A proposta de obra monumental fica guardada para discussão futura, sem requisito atual.
- O campo persistido `portalCrossedAt` conserva selos históricos e passa a registrar também a conquista por influência. Não apagar nem renomear saves existentes nesta etapa.
- Ordens antigas de Portal são compatíveis e não impõem nova viagem. Temporadas já finalizadas preservam seus resultados.
- Implementado localmente no motor e na tela Conquistas → Vitória. Publicação online ainda precisa ser verificada.
- Balanceamento e preparação de AAB não fazem parte desta rodada.
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
- O objetivo atual de influência vale nos dois ritmos; a antiga restrição do Portal ao dia 91 foi removida. A duração do modo expresso continua provisória.

## 17. O que sai do modelo atual

**Decisão revisada:** No modo Cozy não há PvP entre jogadores. Haverá também um modo competitivo separado (item 21). Eliminação e perda da última cidade estão em revisão; não presumir imunidade permanente da capital nem reativar automaticamente a regra histórica de eliminação ao perdê-la. Sai tropa por cidade e expedição com equipe. A tribo vira aliança.

**Notas:**
- Entra no lugar: exército universal na Coroa (item 6) e exploração passiva (item 8).

## 18. Áreas de recursos, anexação e aliança

**Decisão atualizada em 30/10/2026:** Vários pontos da mesma área usam uma única reserva por recurso. Depois de três levantamentos, o reino pode anexar a área. Um aliado pode entrar no compartilhamento ao anexar um ponto conhecido da mesma área. Outros impérios não podem coletar ali.

- O primeiro anexante mantém seu acesso. Participantes posteriores precisam continuar aliados ao primeiro para coletar; sair da aliança suspende esse acesso.
- Ao esgotar, desaparece a camada de recurso. Cidades e territórios anexados permanecem; o esgotamento não apaga posses.
- A coleta reserva o saldo no comando do servidor, antes da chegada da ordem, sob a revisão compartilhada/CAS. Trocar de ponto não cria outra reserva.
- Os três levantamentos são da área, não de cada célula.
- Terras com dono de fora da aliança impedem anexação. Cidades existentes têm prioridade; distritos de santuários não viram território por anexação de recurso.

**Implementação de compatibilidade:** Distritos estáveis de até 8×8 coordenadas axiais, separados por tipo de recurso. Ouro e materiais podem estar no mesmo distrito geográfico, mas possuem reservas distintas. Pontos antigos já descobertos têm seus saldos e capacidades somados uma única vez; valores reservados em ordens continuam nas ordens. Novas descobertas de pontos da mesma área revelam acessos, sem multiplicar a reserva. A quantidade global de distritos deste modelo ainda não é a distribuição de oito manchas da prévia; redesenhar a geração de temporadas é outro trabalho, sem mover cidades antigas silenciosamente.

## 19. A Coroa: os 5 cards do centro do reino

**Decisão:** A Coroa tem 5 cards: Infraestrutura, Militar, Governo, Conselho e Conquistas.

**Notas:**
- Infraestrutura: resume as cidades, com atalho pra pular em qualquer uma.
- Militar: recruta cada tipo de tropa disponível, no nível de pesquisa atual (item 6).
- Governo: heróis e pesquisa, com slots e status (itens 10 e 11).
- Conselho (no lugar do Senado): cards e 2 slots de representantes políticos (item 12).
- Conquistas: slots de quests que dão influência (item 4).

## 20. Torres e santuários — bônus e desafios opcionais

**Estado visual implementado:** **Seis santuários externos**, em disposição hexagonal, e **um monumento central distinto**, totalizando sete. **Posicionamento em revisão:** o usuário quer acesso equilibrado e está considerando tornar a torre central apenas mais uma torre equivalente. O centro não deve oferecer uma vantagem automática aos nascimentos próximos. Não considerar as posições atuais como distribuição final aprovada. Os seis externos repetem o mesmo PNG de distrito: observatório, praça, ruas circulares, jardins e pequenos pavilhões. O central tem arte própria mais monumental.

- Cada distrito reserva 37 hexágonos (raio axial 3). As posições externas são (22,0), (0,22), (-22,22), (-22,0), (0,-22) e (22,-22). O central fica em (0,0).
- Novas cidades não podem ocupar esses hexágonos. O mapa apresenta esses distritos como monumentos, sem novos NPCs ou depósitos sobrepostos; depósitos históricos já registrados e ordens antigas são preservados. Cidades existentes e ordens antigas não são removidas. A chegada de uma conquista também revalida mudanças de posse.
- Todos são elementos separados do terreno. O PNG original do mapa é preservado; a nova camada `terrain-clean-v1.png` remove o monumento embutido para evitar duplicação.
- Assets: `public/landmarks/sanctuary-district-v1.png` e `observatory-study-v1.png` (central). Geração pela ferramenta ImageGen integrada, com transparência.

**Direção de jogo corrigida:** As torres oferecem bônus e desafios opcionais, inclusive pela descoberta/sintonia. Não dão influência e não entram na condição de vitória. A ideia de exigir três torres, vincular o selo a elas ou abrir um Êxodo por ativação foi descartada. O objetivo vigente continua sendo 1.500 de influência.

Hordas podem atingir as torres, e decisões de Governo/Conselho podem tratar de abastecimento, preparo e defesa. Custos, intensidade de efeitos e consequências ainda não estão balanceados. Nenhuma mecânica ativa de doação, bônus ou ataque às torres foi implementada neste checkpoint.

## 21. Combate compartilhado e modos Cozy/competitivo

**Direção solicitada:** Criar um motor de confrontos que primeiro atenda cidades abandonadas/NPCs e também suporte disputas entre jogadores no modo competitivo. Atacar uma cidade abandonada é PvE; usa a mesma base de resolução, sem transformar o Cozy em PvP.

- Cozy: somente confrontos contra NPCs; ações contra jogadores permanecem proibidas. Derrotas graves/prolongadas para hordas podem causar perda de cidade; não há imunidade automática de posse por ser amigável.
- Competitivo: disputa funciona como aposta de influência, com tempo de resolução. Um lado perde e o outro ganha, conforme a regra de confronto a definir.
- **Correção do formato:** conflito prolongado, com ataques que levam tempo e causam dano gradual; não é uma resolução em que todo o exército morre. Cards de decisão durante o conflito podem influenciar preparo, defesa e recuperação. Dano, perdas limitadas, ritmo, desfecho e transferência de influência ainda precisam de especificação. Não aplicar a futura regra competitiva retroativamente aos relatórios PvE históricos.
- Considerar o nível de defesa da aldeia/cidade, além do poder militar, nos requisitos, riscos e custos apresentados.
- O card Militar reúne informações de ataque e defesa. Evoluir o setor de defesa permanece na cidade.
- Falta definir aposta/aceitação ou defesa automática, contabilidade da influência, limites, empate, cancelamento e proteção contra repetição/abuso. Não ativar transferência de influência nem alterar pontuações persistidas antes dessa especificação.
- A base atual resolve PvE; modo competitivo e aposta ainda não foram implementados. São uma nova frente de trabalho, não a remoção da proteção de PvP do Cozy.

### Sala do Governo e estado do reino

A entrada do Governo deve mostrar o estado do reino: em paz, em conflito/guerra no modo competitivo, sob ataque ou com problemas sociais em uma cidade. Esses estados orientam os temas dos cards de decisão e precisam corresponder a eventos reais do servidor, sem rótulos decorativos de guerra no Cozy. A tela/sala terá asset próprio posteriormente. Há decisões locais de satisfação e produção nas cidades; os estados de conflito, crise e separatismo ainda não têm motor persistido para alimentar a sala.

### Correção de arquitetura: conquista e danos estruturais

**Direção reafirmada pelo usuário:** O jogo deve nascer com uma base de combate/conquista compartilhada por PvE e PvP. No modo amigável/Cozy, atacar jogadores é proibido; não criar um jogo separado sem a base de guerra. Perder cidades faz parte dos dois modos: no Cozy, por hordas/NPCs e por ruptura social; no competitivo, também por conquista de outro jogador. Os ataques são graduais, levam tempo e abalam as estruturas, com consequências persistidas e relatórios contados.

O texto histórico de `REGRAS_DO_JOGO.md`, seção 7, eliminava quem perdesse a capital e convertia a cidade tomada em colônia do atacante. Isso é histórico; a revisão recente de conflito prolongado ainda não definiu a eliminação final. Não restaurar aquela regra silenciosamente.

**Encaminhamento de design proposto, ainda sem implementação:**
- Cada conflito declara uma cidade alvo. Ataques reduzem sua capacidade defensiva/integridade de forma gradual; não destroem o império inteiro num confronto.
- Conquista transfere a cidade efetivamente disputada, com o dano remanescente. As outras cidades continuam com o defensor; não há direito de escolher uma cidade qualquer depois de vencer um ataque.
- Separar nível construído de integridade atual: o nível representa investimento e o dano reduz a capacidade efetiva até reparação. Não aplicar simultaneamente perda de nível e integridade pelo mesmo dano sem regra explícita.
- A muralha imperial e o exército participam da defesa; o dano da cidade alvo é local. Apostas/transferências de influência e mudança de proprietário são resultados distintos, a especificar.
- Eliminação por perda da última cidade é uma alternativa em avaliação; derrota da capital não deve apagar automaticamente todas as outras posses sem decisão expressa. Destino de cidades restantes de um jogador eliminado também está em aberto.
- **Correção aceita pelo usuário:** Sociedade baixa e crises ignoradas podem culminar em separação da cidade, inclusive no Cozy. A perda é consequência de uma crise persistida e anunciada, não sorteio isolado de eficiência. Perda externa exige resolução de conquista/horda; perda interna exige resolução da ruptura social.
- Decisões durante o conflito e relatórios devem registrar tempo, dano, reparo, perdas, influência e eventual troca de dono. Não definir coeficientes de dano ou custos nesta etapa.

### Sociedade, crises internas e perda de cidade no Cozy

**Decisão de direção em 30/10/2026:** O modo amigável bloqueia ataques contra jogadores, mas não garante cidades indestrutíveis. Hordas podem tomar cidades mal defendidas. Uma cidade com problemas sociais persistentes também pode se separar se o governante agravar ou ignorar suas crises.

- Sociedade cuida da estabilidade interna, confiança no governo e capacidade de convivência/organização da cidade. Satisfação e desemprego ajudam a explicar esse estado; não são três sistemas independentes de pontuação.
- Defesa/Militar cuidam da resistência externa. Produção cuida do rendimento; eficiência produtiva baixa, sozinha, não sorteia perda de posse.
- **Fluxo proposto:** estável → tensão → crise → movimento separatista → ruptura. Estados, duração, limiares e consequências intermediárias ainda precisam ser especificados. Mostrar motivo, consequências e opções de resposta antes da ruptura.
- Os cards da cidade tratam das causas locais; o Conselho pode lidar com decisões que afetem uma ou mais cidades. Ignorar problemas abertos tem consequências; simplesmente abrir a aba não resolve a crise.
- Escolhas têm trocas compreensíveis entre recursos, segurança e confiança. Não criar uma resposta moral secretamente correta em todos os cards.
- Uma cidade separada permanece no mapa como independente/NPC, com histórico e estruturas remanescentes. Reconciliação/reintegração e reconquista são caminhos em avaliação; a cidade não desaparece nem vira automaticamente posse de outro jogador.
- Hordas também têm alvo, dano e resultado claros. Evitar que uma derrota isolada apague todo o império. A perda da última cidade e o fim da participação precisam de regra própria.
- **Estado do código:** hordas agora podem danificar integridade e causar perda de cidade; eventos anteriores à ativação do sistema mantêm o tratamento histórico. Há satisfação local persistida por cidade, além da medida global anterior. Há escalada de crise e separação implementadas localmente; a última cidade continua protegida enquanto o ciclo de eliminação não é definido. Esta decisão de design não declara essas mecânicas implementadas.

## 22. Cards de decisão e apresentação das ações

**Direção solicitada:** Escolhas com consequências e alternativas reais. Uma opção pode ter custo, oferecer recompensa, ser mais lenta ou trazer mais risco. Algumas decisões podem ter chance de sucesso; outras são escolhas determinísticas entre vantagens diferentes. Não reduzir tudo a uma escolha obviamente melhor nem tornar todos os cards aleatórios.

- Mostrar antes da confirmação os custos, a duração, a recompensa prevista e o risco aplicável. Onde houver probabilidade definida, comunicar a chance de forma legível.
- Custos de suprimentos: PNG + quantidade no botão de ação, com tempo visível e área confortável para tocar. Terminologia: **Explorar**, nunca “espiar”.
- A resolução, os débitos e as recompensas devem ser do servidor, persistidos uma vez. Reabrir o card ou repetir a requisição não pode sortear outro resultado ou pagar novamente.
- Governo/Conselho podem receber situações ligadas a torres, hordas, defesa e abastecimento. Manter a personalidade dos representantes e a coerência das consequências.
- Exemplos numéricos de chance, custo e recompensa ficam para o balanceamento posterior. Esta seção registra a direção; não declara esses novos cards implementados.


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
- Muralha imperial no Militar: alternativas, investimentos e contribuição dos níveis de Defesa das cidades.
- Influência inicial zero e Governo 300/200: definir progressão, elegibilidade e compatibilidade dos placares existentes.

### Checkpoint de implementação dos cards

Militar ganhou abas Recrutamento/Defesa, com contribuição total das fortificações, pesquisa de fortificação, níveis de defesa das cidades e comparação com a próxima horda/apoio confirmado. O mapa mostra defesa conhecida do alvo, mínimo de força para iniciar ocupação e duração. Não existe ainda um nível próprio de defesa para cada aldeia NPC; a resistência continua sendo o valor real do motor atual.

Explorar mostra suprimentos com PNG, quantidade e tempo no botão. Conselho expõe os efeitos reais antes da assinatura, obtidos da mesma opção que o servidor executa; mostra o ganho efetivo limitado à satisfação máxima. Os decretos atuais são determinísticos e não têm custo. Não foram criadas chances, custos ou recompensas novas neste checkpoint. Decisões com probabilidade e motor competitivo de aposta permanecem pendentes.

### Checkpoint: indicadores e decisões locais nas cidades

Implementados localmente: satisfação por cidade (inicializada a partir do valor anterior, sem perder saves), eficiência produtiva e produção real por cidade/dia de jogo. A tela dos setores mostra um dado curto; no detalhe há uma barra e os números; os cards ficam em Decisões. Desemprego não é mostrado: ainda não há um modelo real de população/emprego para sustentá-lo.

Uma decisão local por cidade e dia de jogo, com duas alternativas determinísticas e débito pelo servidor. Inicialmente alternam convivência social e cuidado das oficinas. Valores de funcionamento provisórios: refeições custam 60 suprimentos e dão até 6 de satisfação; praça custa 80 materiais e dá até 4; oficinas custam 80 materiais para eficiência 105%, ou 60 suprimentos para 103%, durante dois dias de jogo. O efeito de produção substitui o anterior, sem acumular multiplicadores. Esses valores habilitam o fluxo e não são balanceamento aprovado.

A produção offline divide os intervalos na expiração exata dos efeitos. Inicializar o sistema mantém eficiência de 100% e preserva a produção anterior. Vitória contra horda melhora a satisfação das cidades; uma derrota afeta a satisfação da cidade atingida, seguindo os deltas já existentes do evento. Não há deterioração social nova por ausência, desemprego simulado, movimento separatista ou perda de cidades implementados neste lote.

Nomes visíveis de influência ajustados para Conselho e Conquistas; identificadores persistidos `society`/`legacy` permanecem para compatibilidade. A fórmula dos 500 de Conselho ainda precisa substituir a base anterior; esta troca de nomes não deve ser tomada como uma nova fórmula já implementada.

### Checkpoint: crises sociais, dano estrutural e cidades independentes

Implementação local: satisfação ≥60 estável, 35–59 tensão e abaixo de 35 crise. Sete dias de jogo consecutivos em crise podem separar uma cidade, com relatórios nos dias 1, 3 e 6. A partir do terceiro dia crítico aparece movimento separatista. Recuperar para 35 ou mais encerra a contagem. Haverá ajuste posterior de limiares/prazos: estes valores habilitam o fluxo, não são balanceamento final.

Decisões críticas substituem as situações comuns da cidade: provisões pagas recuperam mais confiança e ouvir/negociar oferece recuperação sem custo em recursos. Há também uma escolha de arrecadação com ganho material e perda explícita de satisfação. As escolhas do Conselho repercutem na confiança local. Abrir um menu não interrompe a crise; é o efeito da decisão que importa.

Estruturas têm integridade separada dos níveis: as novas derrotas para hordas causam 25 pontos de dano, reduzindo produção e contribuição de muralhas; não reduzem simultaneamente os níveis. Danos sucessivos que levem a zero podem tornar a cidade independente. Reparos pagos ou com a equipe local recuperam integridade; o caminho sem recursos evita impedir a recuperação de um reino sem produção. A capital original é permanente no Cozy, conforme a decisão mais recente; as perdas de posse afetam colônias.

A cidade perdida conserva nome, setores, maravilha e dano no mapa. O herói é liberado, obras pendentes da cidade são interrompidas, a produção deixa o império e a influência é recalculada a partir das cidades restantes. A reconquista preserva os níveis e o dano, designa um herói disponível e reinicia a administração sem a crise anterior ativa. Não há transferência automática para outro jogador.

**Regra atual do Cozy:** capital permanente e sem eliminação; morte do rei e sucessão substituem a eliminação do jogador nesse modo. O competitivo ainda precisa de regras próprias. Não declarar esse fechamento implementado. Hordas históricas anteriores à ativação dos novos sistemas mantêm seu tratamento anterior; crises novas não separam retroativamente uma cidade de save antigo. A liquidação social é cronológica, inclusive entre jogadores, e para no fim da temporada.

A interface mostra alertas na cidade, resumo no Governo, integridade, produção real e decisões de recuperação. Ainda não existem desemprego real, PvP por aposta nem cards probabilísticos. Não rodar balanceamento fino nem preparar AAB nesta etapa.

### Atualização: perfis reais, capital permanente e sucessão no Cozy

**Decisão mais recente:** no Cozy o jogador não é eliminado e a capital original é permanente. Substitui a proposta anterior de perder/promover a capital. Colônias ainda podem se separar ou ser perdidas para hordas. Capitais historicamente substituídas em saves anteriores não são recriadas nem tomadas de outro dono por migração.

Perfis são arquétipos, não nomes de pessoas: retrato, adjetivo/perfil e bônus, com nickname próprio. O mundo Cozy tem os perfis Construtor (+5% produção), Guardião (+5% defesa contra hordas) e Explorador (viagens 5% mais rápidas), com valores provisórios de funcionamento. A escolha é persistida no servidor e fixa por reinado; pode ser feita na preparação. O seletor histórico também usa nomes de arquétipos, preservando seus IDs e bônus anteriores.

Se só resta a capital, ela está sem integridade e uma horda supera mais que o dobro da defesa, a derrota extrema pode matar o rei. O registro guarda nickname, perfil, geração, data e os poderes do confronto, uma vez por reinado. O jogador continua com cidade, recursos, heróis, pesquisas e histórico. O bônus do governante deixa de valer até coroar um sucessor. A sucessão não cura a capital nem concede recursos; começa outro reinado, mantendo os anteriores.

Novo asset transparente `public/cities/royal-capital-v1.png`, gerado por ImageGen e usado no mapa/listas/interior/panorama. Original preservado. O protótipo continua sendo uma fixture visual; as regras de morte/sucessão pertencem ao jogo real.
