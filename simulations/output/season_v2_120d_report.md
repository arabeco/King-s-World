# KingsWorld - Relatorio V4 (Escassez, Horda e Influencia 2500)

## Regras aplicadas

- Influencia fixa 2500: Infraestrutura 1000 + Governo 500 + Militar 400 + Sociedade 300 + Legado 300.
- Teto de tropas por imperio limitado entre 1.5k e 2.5k no pico da temporada.
- Custo de treino e upkeep modelados em escala 10x e economia com escassez.
- Horda 91+ com mortalidade elevada e perda real de aldeias perifericas.
- ETA para o Centro depende de Navegador + Branch Fluxo para cair em ~48h-60h.

## Validacao dos alvos

- 2a aldeia media perto do Dia 15: 14.98 (OK).
- 1a aldeia nivel 100 media perto do Dia 45: 44.84 (OK).
- Sobreviventes no Portal por seed (alvo ~15): 15.9 (OK).
- Elegiveis >=1500 no Dia 90 por seed: 27.1.
- Mortes PvP por seed: 6.
- Players com pico 2500 por seed: 0.

## Tabela de validacao - 20 seeds (5 por perfil)

| Seed | Cenario | Perfil foco | Portal | Vivos D120 | D90 >=1500 | Pico 2500 | Mortes PvP | Mortes trilha | Perda media aldeias (total) | Herois medios | ETA medio (h) |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 90712026 | metropole-1 | Metropole | 17 | 17 | 28 | 0 | 4 | 11 | 3.26 | 3.4 | 118.49 |
| 90719945 | metropole-2 | Metropole | 16 | 16 | 30 | 0 | 7 | 2 | 3.24 | 3.6 | 93.57 |
| 90727864 | metropole-3 | Metropole | 19 | 19 | 31 | 0 | 8 | 3 | 3 | 3.44 | 94.1 |
| 90735783 | metropole-4 | Metropole | 18 | 18 | 29 | 0 | 11 | 6 | 3.24 | 3.46 | 86.49 |
| 90743702 | metropole-5 | Metropole | 13 | 13 | 28 | 0 | 8 | 8 | 3.4 | 3.38 | 101.58 |
| 90751621 | posto-1 | Posto Avancado | 15 | 15 | 29 | 0 | 5 | 7 | 3.14 | 3.48 | 111.16 |
| 90759540 | posto-2 | Posto Avancado | 15 | 15 | 25 | 0 | 4 | 6 | 3.14 | 3.06 | 115.71 |
| 90767459 | posto-3 | Posto Avancado | 7 | 7 | 23 | 0 | 10 | 5 | 3.72 | 3.08 | 86.34 |
| 90775378 | posto-4 | Posto Avancado | 16 | 16 | 28 | 0 | 4 | 8 | 3.46 | 3.64 | 107.58 |
| 90783297 | posto-5 | Posto Avancado | 15 | 15 | 22 | 0 | 3 | 6 | 2.84 | 3.5 | 112.7 |
| 90791216 | bastiao-1 | Bastiao | 16 | 16 | 26 | 0 | 5 | 6 | 2.82 | 3.32 | 105.85 |
| 90799135 | bastiao-2 | Bastiao | 11 | 11 | 26 | 0 | 4 | 7 | 3.22 | 3.48 | 111.37 |
| 90807054 | bastiao-3 | Bastiao | 15 | 15 | 17 | 0 | 6 | 7 | 3.04 | 2.92 | 108.09 |
| 90814973 | bastiao-4 | Bastiao | 16 | 16 | 21 | 0 | 8 | 5 | 3.14 | 3.4 | 106.71 |
| 90822892 | bastiao-5 | Bastiao | 17 | 17 | 25 | 0 | 8 | 4 | 3.08 | 3.48 | 98.62 |
| 90830811 | celeiro-1 | Celeiro | 15 | 15 | 28 | 0 | 6 | 3 | 3.18 | 3.6 | 91.4 |
| 90838730 | celeiro-2 | Celeiro | 12 | 12 | 27 | 0 | 6 | 8 | 3.48 | 3.4 | 96.55 |
| 90846649 | celeiro-3 | Celeiro | 22 | 22 | 31 | 0 | 3 | 4 | 2.96 | 3.32 | 95.27 |
| 90854568 | celeiro-4 | Celeiro | 22 | 22 | 33 | 0 | 7 | 5 | 2.56 | 3.48 | 95.97 |
| 90862487 | celeiro-5 | Celeiro | 21 | 21 | 35 | 0 | 3 | 10 | 2.94 | 3.52 | 98.5 |

## Progressao media (dias 15, 30, 60, 90, 120)

| Dia | Players vivos | Elegiveis >=1500 | Influencia media | Predios | Militar | Governo | Sociedade | Quests | Maravilhas | Tribo | Tropas medias | Aldeias medias |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15 | 50 | 0 | 143.47 | 71.93 | 44.58 | 0 | 26.96 | 0 | 0 | 0 | 397.2 | 1.64 |
| 30 | 50 | 0 | 355.19 | 171.62 | 88.84 | 15.3 | 59.93 | 19.5 | 0 | 0 | 635.3 | 3.19 |
| 60 | 50 | 0 | 951.43 | 425.34 | 177.86 | 137 | 137.83 | 39.66 | 33.75 | 0 | 1111.7 | 5.5 |
| 90 | 50 | 26.85 | 1492.13 | 737.78 | 266.7 | 169.75 | 228.78 | 55.38 | 33.75 | 0 | 1588.09 | 7.79 |
| 120 | 15.9 | 20 | 1369.85 | 523.59 | 267.81 | 169.9 | 248.38 | 55.38 | 35.6 | 69.2 | 826.62 | 5.24 |

## Eficacia das Branches de Pesquisa

| Branch | Players | Taxa Portal | D90 >=1500 | Pico 2500 | Infl. D90 | Infl. D120 | ETA medio (h) | Morte trilha | Perda aldeias Horda |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| urban | 236 | 24.15% | 64.83% | 0% | 1548.56 | 1327.53 | 111.78 | 16.53% | 2.36 |
| tactical | 242 | 35.12% | 66.53% | 0% | 1559.15 | 1414.15 | 120.1 | 12.81% | 2.58 |
| defensive | 261 | 36.78% | 22.99% | 0% | 1327.04 | 1386.22 | 125.37 | 12.26% | 1.64 |
| flow | 261 | 30.65% | 64.37% | 0% | 1551.54 | 1350.67 | 52.25 | 7.28% | 2.37 |

## Dados uteis dos 5 Herois Especialistas

| Heroi | Adocao | Media de vagas | Dia medio contratacao | Taxa portal (usuarios) | Taxa portal (nao usuarios) | Delta (pp) | ETA medio usuarios (h) | Infl. D120 usuarios |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Engenheiro | 59.1% | 1.41 | 32.98 | 37.56% | 23.47% | 14.09 | 106.18 | 1449.48 |
| Marechal | 49.9% | 1.4 | 41.62 | 41.88% | 21.76% | 20.13 | 113.45 | 1479.19 |
| Navegador | 60.6% | 1.43 | 66.14 | 35.81% | 25.63% | 10.17 | 77.46 | 1382.48 |
| Intendente | 47.2% | 1.17 | 43.67 | 40.25% | 24.24% | 16.01 | 91.24 | 1469.84 |
| Erudito | 41.2% | 1.08 | 39.23 | 35.92% | 28.91% | 7.01 | 105.9 | 1417.93 |

## Resultado por estilo de capital

| Estilo | Players | Portal | Infl. D90 | Infl. D120 | Tropas D120 | Aldeias perdidas Horda | 2a aldeia media | 1a aldeia 100 media | Pico 2500 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Metropole | 231 | 30.3% | 1605.24 | 1379.37 | 715.28 | 2.21 | 13.21 | 40.22 | 0% |
| Posto Avancado | 250 | 33.2% | 1547.14 | 1397.24 | 842.53 | 2.63 | 14.76 | 45.56 | 0% |
| Bastiao | 256 | 33.59% | 1281.39 | 1379.37 | 1014.59 | 1.59 | 18.1 | 49.07 | 0% |
| Celeiro | 263 | 30.04% | 1553.05 | 1326.18 | 726.33 | 2.49 | 13.69 | 44.08 | 0% |

## Ajustes aplicados

- branchBuffUrban: 0.12
- branchBuffFlow: 0.12
- portalDeathBase: 0.06
- hordeLossBase: 3

