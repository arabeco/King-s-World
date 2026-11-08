# Regras unificadas e expansão — v3

Implementado e validado localmente. A criação de mundos v3 depende de aplicar
`76_SQL_COZY_UNIFIED_RHYTHM.sql` no projeto correto. Mundos existentes não são
convertidos. O CLI consultado em 08/11/2026 mostrou somente GOL1.0; nenhuma
alteração foi enviada a esse projeto.

## Uma pontuação, dois ritmos

- Normal: 120 dias reais; Expresso: os mesmos 120 dias de jogo em 30 dias reais.
- No Expresso, o tempo passa ×4. Produção, construções, pesquisa, viagens,
  acontecimentos, preparação de ataques e períodos de benefício acompanham o relógio.
- Custos, recompensas, equipamentos e fórmulas de influência são iguais. Nenhum
  multiplicador de influência por ser Expresso. Exige mais oportunidades de ação por dia real.
- Infraestrutura: +1 por nível, cinco setores de 0 a 10, máximo 50 por cidade
  e 500 no reino. Sem ponderação pela posição da cidade.
- Governo: até dez heróis ×30; quatro pesquisas ×cinco níveis ×10.
- Militar: a força inicial não pontua. Os primeiros 50 de força desenvolvida
  valem um ponto a cada cinco; depois, um a cada 90. Preparo até 300 e seis
  vitórias contra hordas até 200. Baixas e danos afetam o preparo.
- Conselho: mesmas fontes e estabilidade em ambos os modos. Limites 160/140/200
  para decretos, decisões locais e manutenção; méritos base 8/6/4, com redução
  por expansão e reconhecimento de cuidados reais. Sem crédito ×4.
- Conquistas: seis marcos ×50 e duas maravilhas ×100. Meta de vitória: 1.500.
- Filas com a mesma capacidade nos novos mundos Normal e Expresso.

Esses números são uma base testável, não um balanceamento final demonstrado.
Uma amostra de bots não estima a porcentagem real de vitoriosos.

## Mapa e recursos

- Distritos de recursos são áreas contínuas, não objetivos diferentes por hexágono.
- Um contorno e um marcador por área; terrenos comuns e névoa sem pontinhos.
- Reconhecer uma área v3 conclui o levantamento da reserva. Anexar toma posse
  da área inteira; coletar retira dessa única reserva.
- Pode-se usar outro hexágono da mesma área sem repetir seu reconhecimento.
- Novas reservas têm um único dono. Entrar na aliança dele não concede coleta.
- Esgotar a reserva não apaga o território. Direitos históricos de áreas
  compartilhadas antigas são preservados, sem criar novos compartilhamentos.
- Cidades abandonadas são esparsas nos mapas novos. Mapas antigos não são regenerados.

## Ataque e anexação de cidades NPC/abandonadas

1. Explorar o destino e reconhecer o caminho.
2. Atacar sem selecionar ou reservar um herói.
3. Resolver na chegada e mostrar a defesa e o controle restantes.
4. Aguardar o retorno para uma nova expedição.
5. Quando o controle estiver no limite, selecionar um retrato de herói livre e
   confirmar a anexação. O herói assume a cidade somente na chegada.

A barra chama-se **Controle da cidade**. Não é a satisfação da população.
Controle é a resistência restante em relação à defesa original. O limite
provisório é 25%, compartilhado por Normal e Expresso. Um ataque perdido pode
reduzir a resistência; isso fica salvo e é visível aos outros jogadores que
conhecem o local. Vencer não concede posse automática. Corridas de anexação
produzem um único proprietário; o outro herói permanece disponível.

O novo fluxo acima trata NPCs/abandonadas. Não confundir com as regras de
ocupação de cidades de jogadores no modo competitivo.

## Fundação

- Alternativa à conquista, em terreno comum explorado, fora das torres e de
  território alheio, a pelo menos três hexágonos de outra cidade.
- Limite total de dez cidades e um herói disponível para a expedição.
- Investimento provisório comum: 1.500 materiais, 250 suprimentos mais a
  viagem; duração de um quarto de dia de jogo mais o deslocamento.
- A nova cidade começa com os cinco setores no nível zero e tipo aberto.
- Conquistas preservam construções existentes; fundações não dão níveis grátis.
- Se o local for ocupado antes da chegada, os materiais de construção voltam;
  suprimentos da viagem foram consumidos e o herói continua disponível.

## Validação reproduzível

### Decisões contextuais

- Cidade: crise, recuperação, feira, escambo, oficinas, colheita e entregas.
  Efeitos locais pequenos; trocas usam o orçamento real do império.
- Conselho: crise e danos têm prioridade; depois vêm hordas, comércio e oficinas.
  Decisões coletivas alcançam as cidades, sem recrutar tropas ou restaurar níveis.
- Custos e resultados ficam lado a lado. Selecionar opção ou tocar no ícone não
  gasta nada; o botão dourado confirma a decisão.
- Algumas expedições têm chance de sucesso. O custo é pago em ambos os resultados;
  uma nova leitura ou repetição da mesma confirmação não sorteia outra vez.
- Reparos consideram o dano real. Bônus coletivos preservam efeitos mais fortes,
  e não são oferecidos se todas as cidades já estiverem melhor atendidas.
- O catálogo novo usa `unifiedRules`; temporadas históricas conservam os eventos
  e pagamentos antigos. A apresentação de ícones é compartilhada.
- `npm run test:smart-decisions` e `npm run test:smart-decisions:ui` verificam
  pagamentos, contextos, relógios, sucesso/falha e confirmação no celular.

- `npm run test:unified-map`: regras, calendário SQL, ataque/anexação,
  reserva exclusiva, fundação e distribuição dos distritos.
- `npm run test:unified-map:ui`: mundo v3 real na fixture SQL/API, barra em
  100%/24%, slots, ausência de execução ao selecionar retrato, botão visível
  e fundação explícita em 320/390/430 px.
- `npm run test:cozy` e `npm run test:cozy:integration`: compatibilidade e
  cenários existentes. Build e TypeScript são checagens separadas.
- `COZY_SIM_UNIFIED=1` habilita a v3 nos bots do motor real; no Expresso eles
  recebem quatro oportunidades por dia real. Não equivale a um casual que
  entra uma única vez por dia. A simulação v2 histórica continua disponível.

Pendente: ativação remota, partida humana completa, calibração conjunta de
escassez/expansão e conclusão do novo recomendador da Coroa. Sem novo AAB nesta etapa.
