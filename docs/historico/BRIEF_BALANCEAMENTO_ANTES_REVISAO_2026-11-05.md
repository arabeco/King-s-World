> Fechamento atual: `MVP_FECHAMENTO_BALANCEAMENTO.md`, 506 trajetórias finais/12 sementes; obras 1,36; Conselho 160/140/200 com mérito-base 4/6/8, administração saudável e constância verificadas. Checkpoints abaixo são históricos. MVP Cozy local pronto para playtest, sem publicação.

> Continuação atual em `MVP_EXPRESSO_30.md`: candidato de MVP Cozy local, Conselho 260/160/80, qualidade urbana revisada e 626 trajetórias no modelo mantido. Os checkpoints e números anteriores abaixo são históricos. Balanceamento humano ainda não encerrado.

# Brief de balanceamento — King's World

Atualização 01/11: implementação e testes autorizados. Estado vigente em `docs/EXPRESSO_ALIANCAS_TORRES_QA.md`: migração 63 aplicada no King's World, novo RPC econômico compatível com app antigo; Expresso de 30 dias, fila de 12 e Infraestrutura por qualidade nos novos perfis locais. Aplicação ainda não publicada. Modelo atual testado em 390 trajetórias e cinco sementes, duas separadas para validação. Instruções antigas de apenas analisar não restringem a autorização posterior. A proposta de 60 dias foi substituída.

## Tarefa da IA

Analisar o balanceamento com raciocínio concreto e poucas palavras. Primeiro propor o modelo; não implementar nem alterar valores, mapa, banco ou publicação. Evitar perguntas: registrar hipóteses reversíveis quando faltar informação. Não apresentar hipóteses como decisões aprovadas.

Este arquivo resume o pedido atual. Para esclarecer regras, consultar somente o trecho relevante de `docs/REGRAS_DO_JOGO.md`; para números existentes, localizar a função correspondente em `lib/cozy/`. Não ler todo o repositório ou históricos. Distinguir **desejado**, **implementado** e **proposto**.

## Base e intenção do jogador

- Jogo medieval para celular, imersivo e cozy; decisões relevantes sem exigir presença constante.
- Novas temporadas começam com 0 de influência. Cinco áreas da Coroa, até 500 cada; total até 2500. Conselho e Conquistas são os nomes atuais. Sociedade fica dentro da cidade.
- Regra implementada atual: atingir 1500 concede selo persistente durante a temporada; cair depois não retira o selo. Torres são opcionais, sem influência direta nem requisito de vitória. Não recuperar propostas antigas de êxodo/torres obrigatórias.
- Meta desejada: aproximadamente 60% de vencedores. Ainda definir denominador: todos os iniciantes ou jogadores que mantêm alguma atividade.
- Jogador dedicado, competente e com sorte pode chegar a 2500, muito raramente.
- Jogador que não entra todo dia, mas faz o básico, pode vencer e chegar a aproximadamente 1800, especialmente com sorte.
- Jogador que joga mal tende a ficar em 1000–1400 no momento decisivo. São faixas desejadas, não resultados medidos. Não forçar distribuição gaussiana.
- Cozy não permite atacar jogadores nem eliminar definitivamente o participante: capital protegida, mas cidades secundárias podem ser perdidas. PvP completo é pendência; combate a NPCs fornece a base, não comprova PvP pronto.
- Alianças atualmente limitadas a 5. Há contribuições, ajuda, torres e hordas. Custos, prazos e bônus atuais são provisórios.

## Prioridades de análise

| Prioridade | Tema | O que resolver |
| --- | --- | --- |
| P0 | Vitória e tempo | Denominador dos 60%; duração da temporada; minutos/entradas esperados; selo imediato versus avaliação final. Não trocar a regra atual sem justificar. |
| P0 | Influência | Curva de 0–1500–2500, contribuição e dificuldade das cinco áreas, perdas e possibilidade de recuperação. Evitar uma área obrigatória ou trivial. |
| P0 | Mérito e sorte | Quanto dedicação, boas decisões e sorte explicam o resultado; limitar sequências injustas. Definir fonte e frequência da aleatoriedade. |
| P1 | Economia | Ouro, materiais e suprimentos: produção, gastos, tempos, filas, armazenamento e escassez. Conferir inflação e ações dominantes. |
| P1 | Cidades/infraestrutura | Todos os setores devem ser úteis em contextos diferentes; conferir impacto real de tipo/especialização da cidade. Níveis, eficiência e decisões locais precisam ter papéis claros. |
| P1 | Expansão e recuperação | Custo/retorno de novas cidades, vantagem acumulada dos líderes, crises, dano, perda de cidades e sucessão. Recuperação possível sem apagar consequências. |
| P2 | Militar | Hordas, cidades abandonadas e PvP: força, defesa local/imperial, duração, dano, perdas estruturais e recompensa. Base comum, parâmetros próprios por alvo/modo. Duelo não deve matar todo o exército de uma vez. |
| P2 | Ajuda e alianças | Tempo de resposta, aceite, alcance, limites, repetição, contribuição e benefício; solo viável e proteção contra concentração de vantagens. |
| P2 | Torres | Custo de exploração/sintonia, bônus, duração, guardiões e hordas; acúmulo e retorno. Continuam opcionais. |
| P3 | Offline e modos | Progresso offline, ausência e eventos não respondidos; Cozy e PvP como variantes equilibradas. Não confundir ausência de login com um modo offline separado. |

P0 define o sucesso. P1 determina sua viabilidade. P2 deve respeitar ambos. P3 adapta consequências e disponibilidade. Não calibrar todos simultaneamente.

## Método econômico de trabalho

1. Primeira resposta: apontar até 5 conflitos/lacunas que mais alteram o resultado e sugerir hipóteses. Sem inventário do código.
2. Depois analisar um grupo de prioridade por vez. Buscar código só quando uma conclusão depender da implementação; citar caminho/função, sem copiar corpos inteiros.
3. Fixar primeiro tempo de temporada, frequência esperada e vitória. Depois desenhar progressão/economia; só então ajustar combate, ajuda e bônus.
4. Comparar quatro perfis: dedicado competente; casual competente; frequente com decisões ruins; ausente/negligente. Variar sorte baixa/mediana/alta mantendo as mesmas decisões. Não supor que frequência equivale a competência.
5. Fazer contas simples antes de simular. Se necessário, usar o mesmo conjunto de sementes para comparar propostas. Testar limiares de vitória, crescimento acumulado, abuso e recuperação, não somente médias.
6. Tratar 60% como meta de população: exige hipótese sobre proporção de perfis. Simulação não prova comportamento de jogadores reais.

## Formato de resposta

Até 400 palavras por rodada, exceto pedido explícito. Usar uma tabela curta:

| Problema | Evidência ou hipótese | Ajuste proposto | Como verificar |
| --- | --- | --- | --- |

Encerrar com até 3 decisões recomendadas para o próximo passo. Números novos devem vir como **hipótese inicial**, acompanhados da razão. Não escrever lore, repetir este brief, prometer equilíbrio perfeito ou declarar porcentagens de conclusão sem evidência.

## Fora do escopo

UI/assets, acabamento do mapa, Vercel, AAB e correções administrativas. O único aviso atual do Supabase é proteção de senhas vazadas, bloqueada pelo plano Pro; está adiado e não interfere nesta análise. Nenhuma compra ou mudança de plano.
