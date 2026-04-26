# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)

## Regras aplicadas

- Influencia fixa 2500: Infraestrutura 1000 + Governo 500 + Militar 400 + Sociedade 300 + Legado 300.
- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.
- Custo de treino e upkeep modelados em escala 10x e economia com escassez.
- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.
- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.

## Validacao dos alvos

- 2a aldeia media perto do Dia 15: 15.3 (OK).
- 1a aldeia nivel 100 media perto do Dia 45: 44.64 (OK).
- Sobreviventes no Portal por seed (alvo ~15): 16.13 (OK).
- Elegiveis >=1500 no Dia 90 por seed: 26.63.
- Mortes PvP por seed: 6.
- Players com pico 2500 por seed: 1.

## Tabela de validacao - 8 seeds (2 por perfil (1 perfeito + 1 com falhas))

| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes PvP | Mortes trilha | Perda media aldeias (total) | Herois medios | ETA medio (h) |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90712026 | metropole-perfect | Metropole | 25 | 25 | 36 | 1 | 9 | 5 | 2.78 | 5.14 | 87.51 |
| 90719945 | metropole-lazy | Metropole | 12 | 12 | 31 | 0 | 9 | 7 | 3.66 | 3.36 | 92.69 |
| 90727864 | posto-perfect | Posto Avancado | 14 | 14 | 22 | 1 | 6 | 4 | 3.32 | 3.86 | 106.51 |
| 90735783 | posto-lazy | Posto Avancado | 10 | 10 | 24 | 0 | 4 | 8 | 4.1 | 2.94 | 113.92 |
| 90743702 | bastiao-perfect | Bastiao | 22 | 22 | 27 | 2 | 2 | 3 | 2.5 | 4.44 | 103.75 |
| 90751621 | bastiao-lazy | Bastiao | 14 | 14 | 13 | 0 | 2 | 8 | 2.48 | 2.98 | 116.41 |
| 90759540 | celeiro-perfect | Celeiro | 23 | 23 | 34 | 4 | 8 | 6 | 2.68 | 5.04 | 69.56 |
| 90767459 | celeiro-lazy | Celeiro | 9 | 9 | 26 | 0 | 8 | 7 | 3.94 | 3.1 | 84.1 |

## Progressao media (dias 15, 30, 60, 90, 120)

| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Governo | Sociedade | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 50 | 0 | 142.45 | 70.64 | 44.96 | 0 | 26.86 | 0 | 0 | 0 | 398.42 | 1.59 |
| 30 | 50 | 0 | 361.53 | 174.1 | 89.59 | 18.63 | 60.06 | 19.16 | 0 | 0 | 637.89 | 3.2 |
| 60 | 50 | 2.63 | 986.71 | 432.9 | 179.36 | 157.13 | 138.52 | 39.55 | 39.25 | 0 | 1117.03 | 5.58 |
| 90 | 50 | 26.63 | 1534.82 | 750.71 | 268.8 | 191.25 | 229.58 | 55.23 | 39.25 | 0 | 1596.13 | 7.92 |
| 120 | 16.13 | 19.13 | 1412.17 | 536 | 269.65 | 192.88 | 248.29 | 55.23 | 41.38 | 68.75 | 844.5 | 5.36 |

## Eficacia das Branches de Pesquisa

| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| urban | 85 | 25.88% | 68.24% | 2.35% | 1633.76 | 1405.54 | 99.64 | 15.29% | 2.41 |
| tactical | 99 | 30.3% | 63.64% | 1.01% | 1563.4 | 1374.77 | 110.35 | 14.14% | 2.86 |
| defensive | 112 | 40.18% | 25.89% | 1.79% | 1387.51 | 1464.87 | 126.23 | 11.61% | 1.46 |
| flow | 104 | 30.77% | 60.58% | 2.88% | 1592.95 | 1396.45 | 49.9 | 7.69% | 2.41 |

## Dados uteis dos 5 Herois Especialistas

| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Engenheiro | 59.25% | 1.52 | 33.87 | 42.19% | 17.79% | 24.4 | 98.42 | 1551.09 |
| Marechal | 52% | 1.51 | 42.69 | 46.15% | 17.19% | 28.97 | 102.15 | 1611.49 |
| Navegador | 64% | 1.47 | 67.11 | 37.89% | 22.22% | 15.67 | 76.89 | 1480 |
| Intendente | 54.75% | 1.32 | 43.33 | 47.49% | 13.81% | 33.68 | 86.48 | 1593.12 |
| Erudito | 40% | 1.27 | 38.38 | 45.63% | 23.33% | 22.29 | 103.26 | 1597.51 |

## Resultado por estilo de capital

| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Metropole | 92 | 29.35% | 1663.23 | 1428.38 | 708.37 | 2.42 | 13.79 | 39.82 | 2.17% |
| Posto Avancado | 100 | 30% | 1540.87 | 1370.9 | 850.8 | 2.72 | 15.21 | 46.1 | 1% |
| Bastiao | 101 | 41.58% | 1394.67 | 1508.93 | 1059.02 | 1.3 | 17.45 | 48.57 | 1.98% |
| Celeiro | 107 | 28.04% | 1558.4 | 1345.48 | 753.15 | 2.59 | 14.64 | 43.7 | 2.8% |

## Ajustes aplicados

- branchBuffUrban: 0.12
- branchBuffFlow: 0.12
- portalDeathBase: 0.08
- hordeLossBase: 3

