# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)

## Regras aplicadas

- Influencia fixa 2500: Infraestrutura 1000 + Governo 500 + Militar 400 + Sociedade 300 + Legado 300.
- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.
- Custo de treino e upkeep modelados em escala 10x e economia com escassez.
- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.
- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.

## Validacao dos alvos

- 2a aldeia media perto do Dia 15: 15.21 (OK).
- 1a aldeia nivel 100 media perto do Dia 45: 44.56 (OK).
- Sobreviventes no Portal por seed (alvo ~15): 16.13 (OK).
- Elegiveis >=1500 no Dia 90 por seed: 27.38.
- Mortes PvP por seed: 5.75.
- Players com pico 2500 por seed: 1.25.

## Tabela de validacao - 8 seeds (2 por perfil (1 perfeito + 1 com falhas))

| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes PvP | Mortes trilha | Perda media aldeias (total) | Herois medios | ETA medio (h) |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90712026 | metropole-perfect | Metropole | 25 | 25 | 41 | 3 | 8 | 5 | 2.56 | 4.74 | 93.96 |
| 90719945 | metropole-lazy | Metropole | 11 | 11 | 31 | 0 | 9 | 8 | 3.4 | 3.36 | 92.7 |
| 90727864 | posto-perfect | Posto Avancado | 12 | 12 | 22 | 1 | 5 | 6 | 3.5 | 3.9 | 104.37 |
| 90735783 | posto-lazy | Posto Avancado | 11 | 11 | 25 | 0 | 4 | 9 | 3.92 | 2.96 | 113.97 |
| 90743702 | bastiao-perfect | Bastiao | 22 | 22 | 27 | 2 | 2 | 4 | 2.4 | 4.44 | 103.75 |
| 90751621 | bastiao-lazy | Bastiao | 14 | 14 | 13 | 0 | 2 | 10 | 2.46 | 2.98 | 116.41 |
| 90759540 | celeiro-perfect | Celeiro | 23 | 23 | 34 | 4 | 8 | 8 | 2.54 | 5.04 | 69.56 |
| 90767459 | celeiro-lazy | Celeiro | 11 | 11 | 26 | 0 | 8 | 10 | 3.64 | 3.1 | 84.21 |

## Progressao media (dias 15, 30, 60, 90, 120)

| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Governo | Sociedade | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 50 | 0 | 143.82 | 71.91 | 44.97 | 0 | 26.94 | 0 | 0 | 0 | 400.1 | 1.61 |
| 30 | 50 | 0 | 361.97 | 175.11 | 89.65 | 17.38 | 60.16 | 19.69 | 0 | 0 | 640.7 | 3.21 |
| 60 | 50 | 2.88 | 987.74 | 434.25 | 179.44 | 155.25 | 138.75 | 40.43 | 39.63 | 0 | 1122.11 | 5.58 |
| 90 | 50 | 27.38 | 1535.49 | 751.96 | 268.93 | 189.13 | 229.83 | 56.03 | 39.63 | 0 | 1603.48 | 7.93 |
| 120 | 16.13 | 20.5 | 1426.6 | 549 | 269.48 | 190.75 | 250.47 | 56.03 | 41.38 | 69.5 | 849.04 | 5.49 |

## Eficacia das Branches de Pesquisa

| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| urban | 86 | 26.74% | 73.26% | 3.49% | 1630.63 | 1444.1 | 103.86 | 17.44% | 2.07 |
| tactical | 100 | 30% | 62% | 1% | 1565.37 | 1383.1 | 113.49 | 18% | 2.78 |
| defensive | 108 | 39.81% | 25.93% | 2.78% | 1384.2 | 1470.17 | 123.42 | 13.89% | 1.4 |
| flow | 106 | 31.13% | 62.26% | 2.83% | 1591.81 | 1409.04 | 50.35 | 11.32% | 2.27 |

## Dados uteis dos 5 Herois Especialistas

| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Engenheiro | 59.5% | 1.52 | 33.86 | 41.18% | 19.14% | 22.04 | 99.29 | 1568.66 |
| Marechal | 50.75% | 1.5 | 42.51 | 44.83% | 19.29% | 25.54 | 101.43 | 1614.78 |
| Navegador | 64% | 1.46 | 67.07 | 37.11% | 23.61% | 13.5 | 77.06 | 1486.08 |
| Intendente | 54.5% | 1.31 | 43.17 | 46.33% | 15.38% | 30.95 | 88.59 | 1598.79 |
| Erudito | 40% | 1.26 | 38.81 | 47.5% | 22.08% | 25.42 | 105.42 | 1594.01 |

## Resultado por estilo de capital

| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Metropole | 93 | 30.11% | 1672.01 | 1487.99 | 719.92 | 1.98 | 13.43 | 39.56 | 3.23% |
| Posto Avancado | 100 | 28% | 1535.69 | 1357.07 | 857.27 | 2.74 | 15.39 | 45.84 | 1% |
| Bastiao | 101 | 40.59% | 1388.96 | 1493.22 | 1053.43 | 1.36 | 17.41 | 48.68 | 2.97% |
| Celeiro | 106 | 30.19% | 1562.7 | 1374.85 | 759.82 | 2.39 | 14.52 | 43.82 | 2.83% |

## Ajustes aplicados

- branchBuffUrban: 0.12
- branchBuffFlow: 0.12
- portalDeathBase: 0.12
- hordeLossBase: 3

