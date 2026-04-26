# KingsWorld - Auditoria de Temporada

- Esta auditoria mostra o que a temporada realmente registrou por run representativa, dia a dia.
- Onde o simulador atual nao persiste granularidade fina, o arquivo marca isso explicitamente em vez de inventar regra nova.

## Limites conhecidos

- O simulador de temporada nao persiste estoque inicial real; o saldo de recursos desta auditoria e normalizado a partir do Dia 1.
- O motor atual nao registra tipos individuais de tropa; a auditoria expõe totais e perdas agregadas.
- A abertura exata/estado aberto de cada quest nao e persistido; a auditoria registra gates, conclusoes e bloqueios observaveis.
- A trilha tribal atual e booleana no simulador; a auditoria registra ativacao, efeito e marcos do fluxo final.

## Jogador em foco

- Cenario: metropole-perfect
- Seed: 90712026
- Jogador: H01
- Perfil: metropole
- Branch: urban
- Resultado: Entrou no Portal com 2300 de influencia.

### Dias criticos do jogador em foco

- D12: 2a aldeia fundada: Primeiro salto territorial confirmado pela run.
- D39: 1a aldeia 100/100: A capital ou vila foco fechou o primeiro teto estrutural.
- D90: Gate do Portal: A run passou do corte de 1500 de influencia.
- D91: Inicio do Exodus: A fase final do mundo ficou ativa.
- D113: Marcha iniciada: A run iniciou a marcha final com ETA 98.1h.
- D117: Entrada no Portal: Entrada confirmada com 2300 de influencia.
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto

| Dia | Fase | Recursos | Infl. | Tropas | Eventos | Resumo |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 1 | I: Consolidacao | M 1755 | S 1727 | E 1324 | I 212 | 62 | 167 | Fazendas -> Nv 2 + Minas -> Nv 2 | Influencia 62 (+62) | aldeias 1 | tropas 167 | 2 upgrade(s) | sem confronto |
| 2 | I: Consolidacao | M 652 | S 1376 | E 968 | I 29 | 68 | 181 | Palacio -> Nv 2 + Senado -> Nv 2 | Influencia 68 (+6) | aldeias 1 | tropas 181 | 2 upgrade(s) | sem confronto |
| 3 | I: Consolidacao | M 0 | S 1147 | E 811 | I 0 | 74 | 195 | Fazendas -> Nv 3 + Minas -> Nv 3 | Influencia 74 (+6) | aldeias 1 | tropas 195 | 2 upgrade(s) | sem confronto |
| 4 | I: Consolidacao | M 0 | S 704 | E 366 | I 0 | 80 | 209 | Palacio -> Nv 3 + Senado -> Nv 3 | Influencia 80 (+6) | aldeias 1 | tropas 209 | 2 upgrade(s) | sem confronto |
| 5 | I: Consolidacao | M 177 | S 816 | E 465 | I 20 | 85 | 224 | Sem marco novo | Influencia 85 (+5) | aldeias 1 | tropas 224 | sem upgrade estrutural | sem confronto |
| 6 | I: Consolidacao | M 354 | S 928 | E 564 | I 40 | 91 | 238 | Sem marco novo | Influencia 91 (+6) | aldeias 1 | tropas 238 | sem upgrade estrutural | sem confronto |
| 7 | I: Consolidacao | M 531 | S 1039 | E 663 | I 60 | 97 | 252 | Sem marco novo | Influencia 97 (+6) | aldeias 1 | tropas 252 | sem upgrade estrutural | sem confronto |
| 8 | I: Consolidacao | M 708 | S 1150 | E 762 | I 80 | 101 | 266 | Buscas e coletas (7) | Influencia 101 (+4) | aldeias 1 | tropas 266 | sem upgrade estrutural | sem confronto |
| 9 | I: Consolidacao | M 885 | S 1260 | E 861 | I 100 | 107 | 280 | Sem marco novo | Influencia 107 (+6) | aldeias 1 | tropas 280 | sem upgrade estrutural | sem confronto |
| 10 | I: Consolidacao | M 1062 | S 1369 | E 960 | I 120 | 113 | 294 | Formou a primeira reserva militar na Capital | Influencia 113 (+6) | aldeias 1 | tropas 294 | sem upgrade estrutural | sem confronto |
| 11 | I: Consolidacao | M 1239 | S 1478 | E 1059 | I 140 | 117 | 308 | Sem marco novo | Influencia 117 (+4) | aldeias 1 | tropas 308 | sem upgrade estrutural | sem confronto |
| 12 | I: Consolidacao | M 1603 | S 1723 | E 1280 | I 181 | 190 | 322 | [MARCO] 2a aldeia fundada + Conquistou/Fundou a 2a aldeia | Influencia 190 (+73) | aldeias 2 | tropas 322 | sem upgrade estrutural | sem confronto |
| 13 | I: Consolidacao | M 1967 | S 1967 | E 1501 | I 222 | 196 | 336 | Sem marco novo | Influencia 196 (+6) | aldeias 2 | tropas 336 | sem upgrade estrutural | sem confronto |
| 14 | I: Consolidacao | M 2331 | S 2211 | E 1722 | I 263 | 201 | 350 | Sem marco novo | Influencia 201 (+5) | aldeias 2 | tropas 350 | sem upgrade estrutural | sem confronto |
| 15 | I: Consolidacao | M 2695 | S 2453 | E 1943 | I 304 | 208 | 365 | Sem marco novo | Influencia 208 (+7) | aldeias 2 | tropas 365 | sem upgrade estrutural | sem confronto |
| 16 | I: Consolidacao | M 3059 | S 2695 | E 2164 | I 345 | 214 | 379 | Sem marco novo | Influencia 214 (+6) | aldeias 2 | tropas 379 | sem upgrade estrutural | sem confronto |
| 17 | I: Consolidacao | M 3423 | S 2936 | E 2385 | I 386 | 219 | 393 | Sem marco novo | Influencia 219 (+5) | aldeias 2 | tropas 393 | sem upgrade estrutural | sem confronto |
| 18 | I: Consolidacao | M 3973 | S 3314 | E 2727 | I 447 | 296 | 407 | Sem marco novo | Influencia 296 (+77) | aldeias 3 | tropas 407 | sem upgrade estrutural | sem confronto |
| 19 | I: Consolidacao | M 4523 | S 3691 | E 3069 | I 508 | 303 | 421 | Sem marco novo | Influencia 303 (+7) | aldeias 3 | tropas 421 | sem upgrade estrutural | sem confronto |
| 20 | I: Consolidacao | M 5253 | S 4207 | E 3491 | I 669 | 409 | 435 | Concluiu Quest 1/3 | Influencia 409 (+106) | aldeias 3 | tropas 435 | sem upgrade estrutural | sem confronto |
| 21 | II: Expansao | M 5803 | S 4583 | E 3833 | I 730 | 416 | 449 | Sem marco novo | Influencia 416 (+7) | aldeias 3 | tropas 449 | sem upgrade estrutural | sem confronto |
| 22 | II: Expansao | M 6353 | S 4958 | E 4175 | I 791 | 423 | 463 | Sem marco novo | Influencia 423 (+7) | aldeias 3 | tropas 463 | sem upgrade estrutural | sem confronto |
| 23 | II: Expansao | M 6903 | S 5332 | E 4517 | I 852 | 429 | 477 | Sem marco novo | Influencia 429 (+6) | aldeias 3 | tropas 477 | sem upgrade estrutural | sem confronto |
| 24 | II: Expansao | M 7333 | S 5546 | E 4769 | I 763 | 435 | 491 | Ocupou cidade vazia 1 | Influencia 435 (+6) | aldeias 3 | tropas 491 | sem upgrade estrutural | sem confronto |
| 25 | II: Expansao | M 7883 | S 5918 | E 5111 | I 824 | 442 | 506 | Sem marco novo | Influencia 442 (+7) | aldeias 3 | tropas 506 | sem upgrade estrutural | sem confronto |
| 26 | II: Expansao | M 8433 | S 6290 | E 5453 | I 885 | 448 | 520 | Sem marco novo | Influencia 448 (+6) | aldeias 3 | tropas 520 | sem upgrade estrutural | sem confronto |
| 27 | II: Expansao | M 8983 | S 6661 | E 5795 | I 946 | 455 | 534 | Sem marco novo | Influencia 455 (+7) | aldeias 3 | tropas 534 | sem upgrade estrutural | sem confronto |
| 28 | II: Expansao | M 9533 | S 7032 | E 6137 | I 1007 | 462 | 548 | Sem marco novo | Influencia 462 (+7) | aldeias 3 | tropas 548 | sem upgrade estrutural | sem confronto |
| 29 | II: Expansao | M 10270 | S 7538 | E 6601 | I 1089 | 545 | 562 | Sem marco novo | Influencia 545 (+83) | aldeias 4 | tropas 562 | sem upgrade estrutural | sem confronto |
| 30 | II: Expansao | M 11007 | S 8043 | E 7065 | I 1171 | 553 | 576 | Chegou a 4 aldeias | Influencia 553 (+8) | aldeias 4 | tropas 576 | sem upgrade estrutural | sem confronto |
| 31 | II: Expansao | M 11744 | S 8548 | E 7529 | I 1253 | 610 | 590 | Contratou Engenheiro | Influencia 610 (+57) | aldeias 4 | tropas 590 | sem upgrade estrutural | sem confronto |
| 32 | II: Expansao | M 12481 | S 9052 | E 7993 | I 1335 | 617 | 604 | Sem marco novo | Influencia 617 (+7) | aldeias 4 | tropas 604 | sem upgrade estrutural | sem confronto |
| 33 | II: Expansao | M 13218 | S 9555 | E 8457 | I 1417 | 674 | 618 | Contratou Engenheiro (2a vaga) | Influencia 674 (+57) | aldeias 4 | tropas 618 | sem upgrade estrutural | sem confronto |
| 34 | II: Expansao | M 13955 | S 10058 | E 8921 | I 1499 | 682 | 632 | Sem marco novo | Influencia 682 (+8) | aldeias 4 | tropas 632 | sem upgrade estrutural | sem confronto |
| 35 | II: Expansao | M 14692 | S 10559 | E 9385 | I 1581 | 692 | 647 | Sem marco novo | Influencia 692 (+10) | aldeias 4 | tropas 647 | sem upgrade estrutural | sem confronto |
| 36 | II: Expansao | M 15429 | S 11060 | E 9849 | I 1663 | 704 | 661 | Sem marco novo | Influencia 704 (+12) | aldeias 4 | tropas 661 | sem upgrade estrutural | sem confronto |
| 37 | II: Expansao | M 16166 | S 11560 | E 10313 | I 1745 | 715 | 675 | Sem marco novo | Influencia 715 (+11) | aldeias 4 | tropas 675 | sem upgrade estrutural | sem confronto |
| 38 | II: Expansao | M 16903 | S 12060 | E 10777 | I 1827 | 776 | 689 | Contratou Erudito | Influencia 776 (+61) | aldeias 4 | tropas 689 | sem upgrade estrutural | sem confronto |
| 39 | II: Expansao | M 17640 | S 12559 | E 11241 | I 1909 | 787 | 703 | [MARCO] 1a aldeia 100/100 + Primeira aldeia atingiu 100/100 | Influencia 787 (+11) | aldeias 4 | tropas 703 | sem upgrade estrutural | sem confronto |
| 40 | II: Expansao | M 18563 | S 13194 | E 11826 | I 2011 | 1039 | 717 | Sem marco novo | Influencia 1039 (+252) | aldeias 5 | tropas 717 | sem upgrade estrutural | sem confronto |
| 41 | II: Expansao | M 19486 | S 13829 | E 12411 | I 2113 | 1052 | 731 | Sem marco novo | Influencia 1052 (+13) | aldeias 5 | tropas 731 | sem upgrade estrutural | sem confronto |
| 42 | II: Expansao | M 20409 | S 14463 | E 12996 | I 2215 | 1065 | 745 | Sem marco novo | Influencia 1065 (+13) | aldeias 5 | tropas 745 | sem upgrade estrutural | sem confronto |
| 43 | II: Expansao | M 21332 | S 15096 | E 13581 | I 2317 | 1078 | 759 | Ergueu/garantiu Maravilha 1 | Influencia 1078 (+13) | aldeias 5 | tropas 759 | sem upgrade estrutural | sem confronto |
| 44 | II: Expansao | M 22255 | S 15729 | E 14166 | I 2419 | 1090 | 773 | Sem marco novo | Influencia 1090 (+12) | aldeias 5 | tropas 773 | sem upgrade estrutural | sem confronto |
| 45 | II: Expansao | M 23178 | S 16360 | E 14751 | I 2521 | 1103 | 788 | Sem marco novo | Influencia 1103 (+13) | aldeias 5 | tropas 788 | sem upgrade estrutural | sem confronto |
| 46 | II: Expansao | M 24101 | S 16991 | E 15336 | I 2623 | 1115 | 802 | Sem marco novo | Influencia 1115 (+12) | aldeias 5 | tropas 802 | sem upgrade estrutural | sem confronto |
| 47 | II: Expansao | M 25024 | S 17621 | E 15921 | I 2725 | 1119 | 816 | Sem marco novo | Influencia 1119 (+4) | aldeias 5 | tropas 816 | sem upgrade estrutural | sem confronto |
| 48 | II: Expansao | M 25947 | S 18251 | E 16506 | I 2827 | 1124 | 830 | Sem marco novo | Influencia 1124 (+5) | aldeias 5 | tropas 830 | sem upgrade estrutural | sem confronto |
| 49 | II: Expansao | M 26870 | S 18880 | E 17091 | I 2929 | 1129 | 844 | Sem marco novo | Influencia 1129 (+5) | aldeias 5 | tropas 844 | sem upgrade estrutural | sem confronto |
| 50 | II: Expansao | M 27793 | S 19508 | E 17676 | I 3031 | 1133 | 858 | Sem marco novo | Influencia 1133 (+4) | aldeias 5 | tropas 858 | sem upgrade estrutural | sem confronto |
| 51 | II: Expansao | M 28903 | S 20273 | E 18383 | I 3154 | 1238 | 872 | Sem marco novo | Influencia 1238 (+105) | aldeias 6 | tropas 872 | sem upgrade estrutural | sem confronto |
| 52 | II: Expansao | M 30273 | S 21257 | E 19210 | I 3377 | 1343 | 886 | Concluiu Quest 2/3 | Influencia 1343 (+105) | aldeias 6 | tropas 886 | sem upgrade estrutural | sem confronto |
| 53 | II: Expansao | M 31383 | S 22020 | E 19917 | I 3500 | 1347 | 900 | Sem marco novo | Influencia 1347 (+4) | aldeias 6 | tropas 900 | sem upgrade estrutural | sem confronto |
| 54 | II: Expansao | M 32493 | S 22783 | E 20624 | I 3623 | 1352 | 914 | Sem marco novo | Influencia 1352 (+5) | aldeias 6 | tropas 914 | sem upgrade estrutural | sem confronto |
| 55 | II: Expansao | M 33603 | S 23544 | E 21331 | I 3746 | 1407 | 929 | Contratou Intendente | Influencia 1407 (+55) | aldeias 6 | tropas 929 | sem upgrade estrutural | sem confronto |
| 56 | II: Expansao | M 34713 | S 24305 | E 22038 | I 3869 | 1411 | 943 | Sem marco novo | Influencia 1411 (+4) | aldeias 6 | tropas 943 | sem upgrade estrutural | sem confronto |
| 57 | II: Expansao | M 35823 | S 25065 | E 22745 | I 3992 | 1416 | 957 | Sem marco novo | Influencia 1416 (+5) | aldeias 6 | tropas 957 | sem upgrade estrutural | sem confronto |
| 58 | II: Expansao | M 36933 | S 25825 | E 23452 | I 4115 | 1421 | 971 | Ergueu/garantiu Maravilha 2 | Influencia 1421 (+5) | aldeias 6 | tropas 971 | sem upgrade estrutural | sem confronto |
| 59 | II: Expansao | M 38043 | S 26584 | E 24159 | I 4238 | 1425 | 985 | Sem marco novo | Influencia 1425 (+4) | aldeias 6 | tropas 985 | sem upgrade estrutural | sem confronto |
| 60 | II: Expansao | M 39153 | S 27342 | E 24866 | I 4361 | 1430 | 999 | Mid game com 6 aldeias | Influencia 1430 (+5) | aldeias 6 | tropas 999 | sem upgrade estrutural | sem confronto |
| 61 | III: Fortificacao | M 40263 | S 28100 | E 25573 | I 4484 | 1435 | 1013 | Sem marco novo | Influencia 1435 (+5) | aldeias 6 | tropas 1013 | sem upgrade estrutural | sem confronto |
| 62 | III: Fortificacao | M 41373 | S 28857 | E 26280 | I 4607 | 1439 | 1027 | Sem marco novo | Influencia 1439 (+4) | aldeias 6 | tropas 1027 | sem upgrade estrutural | sem confronto |
| 63 | III: Fortificacao | M 42669 | S 29750 | E 27108 | I 4750 | 1544 | 1041 | Sem marco novo | Influencia 1544 (+105) | aldeias 7 | tropas 1041 | sem upgrade estrutural | sem confronto |
| 64 | III: Fortificacao | M 43965 | S 30643 | E 27936 | I 4893 | 1549 | 1055 | Sem marco novo | Influencia 1549 (+5) | aldeias 7 | tropas 1055 | sem upgrade estrutural | sem confronto |
| 65 | III: Fortificacao | M 45261 | S 31534 | E 28764 | I 5036 | 1553 | 1070 | Sem marco novo | Influencia 1553 (+4) | aldeias 7 | tropas 1070 | sem upgrade estrutural | sem confronto |
| 66 | III: Fortificacao | M 46557 | S 32425 | E 29592 | I 5179 | 1558 | 1084 | Sem marco novo | Influencia 1558 (+5) | aldeias 7 | tropas 1084 | sem upgrade estrutural | sem confronto |
| 67 | III: Fortificacao | M 47853 | S 33315 | E 30420 | I 5322 | 1563 | 1098 | Sem marco novo | Influencia 1563 (+5) | aldeias 7 | tropas 1098 | sem upgrade estrutural | sem confronto |
| 68 | III: Fortificacao | M 49149 | S 34205 | E 31248 | I 5465 | 1567 | 1112 | Sem marco novo | Influencia 1567 (+4) | aldeias 7 | tropas 1112 | sem upgrade estrutural | sem confronto |
| 69 | III: Fortificacao | M 50445 | S 35094 | E 32076 | I 5608 | 1572 | 1126 | Sem marco novo | Influencia 1572 (+5) | aldeias 7 | tropas 1126 | sem upgrade estrutural | sem confronto |
| 70 | III: Fortificacao | M 51741 | S 35982 | E 32904 | I 5751 | 1577 | 1140 | Sem marco novo | Influencia 1577 (+5) | aldeias 7 | tropas 1140 | sem upgrade estrutural | sem confronto |
| 71 | III: Fortificacao | M 53037 | S 36870 | E 33732 | I 5894 | 1581 | 1154 | Sem marco novo | Influencia 1581 (+4) | aldeias 7 | tropas 1154 | sem upgrade estrutural | sem confronto |
| 72 | III: Fortificacao | M 54333 | S 37757 | E 34560 | I 6037 | 1636 | 1168 | Contratou Navegador | Influencia 1636 (+55) | aldeias 7 | tropas 1168 | sem upgrade estrutural | sem confronto |
| 73 | III: Fortificacao | M 55629 | S 38643 | E 35388 | I 6180 | 1641 | 1182 | Ergueu/garantiu Maravilha 3 | Influencia 1641 (+5) | aldeias 7 | tropas 1182 | sem upgrade estrutural | sem confronto |
| 74 | III: Fortificacao | M 57112 | S 39666 | E 36338 | I 6344 | 1745 | 1196 | Sem marco novo | Influencia 1745 (+104) | aldeias 8 | tropas 1196 | sem upgrade estrutural | sem confronto |
| 75 | III: Fortificacao | M 58595 | S 40687 | E 37288 | I 6508 | 1750 | 1211 | Sem marco novo | Influencia 1750 (+5) | aldeias 8 | tropas 1211 | sem upgrade estrutural | sem confronto |
| 76 | III: Fortificacao | M 60078 | S 41708 | E 38238 | I 6672 | 1755 | 1225 | Sem marco novo | Influencia 1755 (+5) | aldeias 8 | tropas 1225 | sem upgrade estrutural | sem confronto |
| 77 | III: Fortificacao | M 61561 | S 42728 | E 39188 | I 6836 | 1759 | 1239 | Sem marco novo | Influencia 1759 (+4) | aldeias 8 | tropas 1239 | sem upgrade estrutural | sem confronto |
| 78 | III: Fortificacao | M 63044 | S 43748 | E 40138 | I 7000 | 1764 | 1253 | Sem marco novo | Influencia 1764 (+5) | aldeias 8 | tropas 1253 | sem upgrade estrutural | sem confronto |
| 79 | III: Fortificacao | M 64527 | S 44767 | E 41088 | I 7164 | 1769 | 1267 | Sem marco novo | Influencia 1769 (+5) | aldeias 8 | tropas 1267 | sem upgrade estrutural | sem confronto |
| 80 | III: Fortificacao | M 66010 | S 45785 | E 42038 | I 7328 | 1773 | 1281 | Sem marco novo | Influencia 1773 (+4) | aldeias 8 | tropas 1281 | sem upgrade estrutural | sem confronto |
| 81 | III: Fortificacao | M 67493 | S 46803 | E 42988 | I 7492 | 1778 | 1295 | Sem marco novo | Influencia 1778 (+5) | aldeias 8 | tropas 1295 | sem upgrade estrutural | sem confronto |
| 82 | III: Fortificacao | M 68976 | S 47820 | E 43938 | I 7656 | 1783 | 1309 | Sem marco novo | Influencia 1783 (+5) | aldeias 8 | tropas 1309 | sem upgrade estrutural | sem confronto |
| 83 | III: Fortificacao | M 70459 | S 48836 | E 44888 | I 7820 | 1787 | 1323 | Sem marco novo | Influencia 1787 (+4) | aldeias 8 | tropas 1323 | sem upgrade estrutural | sem confronto |
| 84 | III: Fortificacao | M 72262 | S 50132 | E 46018 | I 8084 | 1892 | 1337 | Concluiu Quest 3/3 | Influencia 1892 (+105) | aldeias 8 | tropas 1337 | sem upgrade estrutural | sem confronto |
| 85 | III: Fortificacao | M 73931 | S 51283 | E 47089 | I 8268 | 1997 | 1352 | Sem marco novo | Influencia 1997 (+105) | aldeias 9 | tropas 1352 | sem upgrade estrutural | sem confronto |
| 86 | III: Fortificacao | M 75600 | S 52434 | E 48160 | I 8452 | 2001 | 1366 | Sem marco novo | Influencia 2001 (+4) | aldeias 9 | tropas 1366 | sem upgrade estrutural | sem confronto |
| 87 | III: Fortificacao | M 77269 | S 53584 | E 49231 | I 8636 | 2006 | 1380 | Sem marco novo | Influencia 2006 (+5) | aldeias 9 | tropas 1380 | sem upgrade estrutural | sem confronto |
| 88 | III: Fortificacao | M 78938 | S 54734 | E 50302 | I 8820 | 2011 | 1394 | Sem marco novo | Influencia 2011 (+5) | aldeias 9 | tropas 1394 | sem upgrade estrutural | sem confronto |
| 89 | III: Fortificacao | M 80607 | S 55883 | E 51373 | I 9004 | 2015 | 1408 | Sem marco novo | Influencia 2015 (+4) | aldeias 9 | tropas 1408 | sem upgrade estrutural | sem confronto |
| 90 | III: Fortificacao | M 82276 | S 57031 | E 52444 | I 9188 | 2020 | 1422 | [MARCO] Gate do Portal + Chegou ao D90 com 9 aldeias + Agrupamento liberado na Capital | Influencia 2020 (+5) | aldeias 9 | tropas 1422 | sem upgrade estrutural | sem confronto |
| 91 | IV: Exodo | M 83954 | S 58194 | E 53522 | I 9372 | 2352 | 1398 | [MARCO] Inicio do Exodus + Ativou Domo da Tribo | Influencia 2352 (+332) | aldeias 9 | tropas 1398 | sem upgrade estrutural | sem confronto |
| 92 | IV: Exodo | M 85632 | S 59358 | E 54600 | I 9556 | 2353 | 1374 | Sem marco novo | Influencia 2353 (+1) | aldeias 9 | tropas 1374 | sem upgrade estrutural | sem confronto |
| 93 | IV: Exodo | M 87310 | S 60523 | E 55678 | I 9740 | 2355 | 1350 | Sem marco novo | Influencia 2355 (+2) | aldeias 9 | tropas 1350 | sem upgrade estrutural | sem confronto |
| 94 | IV: Exodo | M 88988 | S 61689 | E 56756 | I 9924 | 2357 | 1326 | Sem marco novo | Influencia 2357 (+2) | aldeias 9 | tropas 1326 | sem upgrade estrutural | sem confronto |
| 95 | IV: Exodo | M 90666 | S 62856 | E 57834 | I 10108 | 2358 | 1302 | Sem marco novo | Influencia 2358 (+1) | aldeias 9 | tropas 1302 | sem upgrade estrutural | sem confronto |
| 96 | IV: Exodo | M 92344 | S 64025 | E 58912 | I 10292 | 2360 | 1278 | Ergueu/garantiu Maravilha 4 + Sofreu pressao PvP 1/2 | Influencia 2360 (+2) | aldeias 9 | tropas 1278 | sem upgrade estrutural | 1 confronto(s) |
| 97 | IV: Exodo | M 94022 | S 65195 | E 59990 | I 10476 | 2362 | 1254 | Sem marco novo | Influencia 2362 (+2) | aldeias 9 | tropas 1254 | sem upgrade estrutural | sem confronto |
| 98 | IV: Exodo | M 95700 | S 66366 | E 61068 | I 10660 | 2363 | 1230 | Perdeu 2 cidade(s) para PvP | Influencia 2363 (+1) | aldeias 9 | tropas 1230 | sem upgrade estrutural | sem confronto |
| 99 | IV: Exodo | M 97378 | S 67538 | E 62146 | I 10844 | 2365 | 1206 | Sem marco novo | Influencia 2365 (+2) | aldeias 9 | tropas 1206 | sem upgrade estrutural | sem confronto |
| 100 | IV: Exodo | M 99056 | S 68711 | E 63224 | I 11028 | 2367 | 1182 | Sofreu pressao PvP 2/2 | Influencia 2367 (+2) | aldeias 9 | tropas 1182 | sem upgrade estrutural | 1 confronto(s) |
| 101 | IV: Exodo | M 100734 | S 69885 | E 64302 | I 11212 | 2368 | 1158 | Sem marco novo | Influencia 2368 (+1) | aldeias 9 | tropas 1158 | sem upgrade estrutural | sem confronto |
| 102 | IV: Exodo | M 102412 | S 71061 | E 65380 | I 11396 | 2370 | 1134 | Sem marco novo | Influencia 2370 (+2) | aldeias 9 | tropas 1134 | sem upgrade estrutural | sem confronto |
| 103 | IV: Exodo | M 104090 | S 72238 | E 66458 | I 11580 | 2372 | 1110 | Sem marco novo | Influencia 2372 (+2) | aldeias 9 | tropas 1110 | sem upgrade estrutural | sem confronto |
| 104 | IV: Exodo | M 105768 | S 73416 | E 67536 | I 11764 | 2373 | 1086 | Sem marco novo | Influencia 2373 (+1) | aldeias 9 | tropas 1086 | sem upgrade estrutural | sem confronto |
| 105 | IV: Exodo | M 107446 | S 74595 | E 68614 | I 11948 | 2375 | 1062 | Sem marco novo | Influencia 2375 (+2) | aldeias 9 | tropas 1062 | sem upgrade estrutural | sem confronto |
| 106 | IV: Exodo | M 108938 | S 75638 | E 69571 | I 12112 | 2277 | 1037 | Ergueu/garantiu Maravilha 5 | Influencia 2277 (-98) | aldeias 8 | tropas 1037 | sem upgrade estrutural | sem confronto |
| 107 | IV: Exodo | M 110430 | S 76683 | E 70528 | I 12276 | 2278 | 1013 | Sem marco novo | Influencia 2278 (+1) | aldeias 8 | tropas 1013 | sem upgrade estrutural | sem confronto |
| 108 | IV: Exodo | M 111922 | S 77729 | E 71485 | I 12440 | 2280 | 989 | Sem marco novo | Influencia 2280 (+2) | aldeias 8 | tropas 989 | sem upgrade estrutural | sem confronto |
| 109 | IV: Exodo | M 113414 | S 78776 | E 72442 | I 12604 | 2282 | 965 | Sem marco novo | Influencia 2282 (+2) | aldeias 8 | tropas 965 | sem upgrade estrutural | sem confronto |
| 110 | IV: Exodo | M 114906 | S 79824 | E 73399 | I 12768 | 2283 | 941 | Horda contida sem perda de aldeia | Influencia 2283 (+1) | aldeias 8 | tropas 941 | sem upgrade estrutural | 1 confronto(s) |
| 111 | IV: Exodo | M 116398 | S 80873 | E 74356 | I 12932 | 2285 | 917 | Sem marco novo | Influencia 2285 (+2) | aldeias 8 | tropas 917 | sem upgrade estrutural | sem confronto |
| 112 | IV: Exodo | M 117890 | S 81924 | E 75313 | I 13096 | 2287 | 893 | Sem marco novo | Influencia 2287 (+2) | aldeias 8 | tropas 893 | sem upgrade estrutural | sem confronto |
| 113 | IV: Exodo | M 119382 | S 82976 | E 76270 | I 13260 | 2288 | 869 | [MARCO] Marcha iniciada + Iniciou marcha ao Portal | Influencia 2288 (+1) | aldeias 8 | tropas 869 | sem upgrade estrutural | sem confronto |
| 114 | IV: Exodo | M 120874 | S 84029 | E 77227 | I 13424 | 2290 | 845 | Sem marco novo | Influencia 2290 (+2) | aldeias 8 | tropas 845 | sem upgrade estrutural | sem confronto |
| 115 | IV: Exodo | M 122366 | S 85083 | E 78184 | I 13588 | 2292 | 821 | Sem marco novo | Influencia 2292 (+2) | aldeias 8 | tropas 821 | sem upgrade estrutural | sem confronto |
| 116 | IV: Exodo | M 123858 | S 86138 | E 79141 | I 13752 | 2293 | 797 | Sem marco novo | Influencia 2293 (+1) | aldeias 8 | tropas 797 | sem upgrade estrutural | sem confronto |
| 117 | IV: Exodo | M 125350 | S 87195 | E 80098 | I 13916 | 2295 | 773 | [MARCO] Entrada no Portal + Entrou no Portal | Influencia 2295 (+2) | aldeias 8 | tropas 773 | sem upgrade estrutural | sem confronto |
| 118 | IV: Exodo | M 126842 | S 88253 | E 81055 | I 14080 | 2297 | 749 | Sem marco novo | Influencia 2297 (+2) | aldeias 8 | tropas 749 | sem upgrade estrutural | sem confronto |
| 119 | IV: Exodo | M 128334 | S 89312 | E 82012 | I 14244 | 2298 | 725 | Sem marco novo | Influencia 2298 (+1) | aldeias 8 | tropas 725 | sem upgrade estrutural | sem confronto |
| 120 | IV: Exodo | M 129826 | S 90372 | E 82969 | I 14408 | 2300 | 701 | Sem marco novo | Influencia 2300 (+2) | aldeias 8 | tropas 701 | sem upgrade estrutural | sem confronto |

### Checkpoints jogaveis do jogador em foco

| Dia | Economia | Expansao | Militar | Influencia | Risco final | Colapsos |
| ---: | --- | --- | --- | --- | --- | --- |
| 10 | estavel | ideal | estavel | abaixo da curva esperada | alto | - |
| 20 | estavel | agressiva | estavel | dentro da curva esperada | medio | - |
| 30 | estavel | agressiva | estavel | abaixo da curva esperada | alto | - |
| 60 | estavel | agressiva | estavel | dentro da curva esperada | baixo | - |
| 90 | estavel | agressiva | estavel | dentro da curva esperada | baixo | - |
| 120 | estavel | ideal | critico | dentro da curva esperada | alto | queda de aldeias por pressao da Horda; tropas gastas em confronto |

## Marcos por run

### metropole-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2300 de influencia.
- 2a aldeia: D12 | 1a aldeia 100/100: D39 | Marcha: D113 | ETA 98.1h

- Dias criticos:
- D12: 2a aldeia fundada
- D39: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D113: Marcha iniciada
- D117: Entrada no Portal
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 113 | 1 | 294 | M 1062 | S 1369 | E 960 | I 120 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 409 | 3 | 435 | M 5253 | S 4207 | E 3491 | I 669 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 30 | 553 | 4 | 576 | M 11007 | S 8043 | E 7065 | I 1171 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1430 | 6 | 999 | M 39153 | S 27342 | E 24866 | I 4361 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 90 | 2020 | 9 | 1422 | M 82276 | S 57031 | E 52444 | I 9188 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2300 | 8 | 701 | M 129826 | S 90372 | E 82969 | I 14408 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto |

### metropole-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D14 | 1a aldeia 100/100: D43 | Marcha: D110 | ETA 200.13h

- Dias criticos:
- D14: 2a aldeia fundada
- D43: 1a aldeia 100/100
- D91: Inicio do Exodus
- D110: Marcha iniciada
- D118: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 103 | 1 | 369 | M 1050 | S 1310 | E 949 | I 114 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 229 | 2 | 541 | M 4109 | S 3246 | E 2781 | I 444 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 361 | 3 | 712 | M 8911 | S 6306 | E 5737 | I 817 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 60 | 752 | 4 | 1228 | M 28597 | S 18973 | E 18067 | I 2749 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 1153 | 6 | 1743 | M 57911 | S 38000 | E 36681 | I 5829 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 1027 | 3 | 895 | M 83081 | S 54513 | E 52626 | I 8439 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

### posto-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2400 de influencia.
- 2a aldeia: D14 | 1a aldeia 100/100: D46 | Marcha: D114 | ETA 82.23h

- Dias criticos:
- D14: 2a aldeia fundada
- D46: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D114: Marcha iniciada
- D117: Entrada no Portal
- D120: tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 101 | 1 | 386 | M 1031 | S 979 | E 1215 | I 126 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 376 | 3 | 597 | M 4403 | S 3144 | E 3293 | I 604 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 461 | 3 | 808 | M 9692 | S 6558 | E 6692 | I 1084 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1414 | 6 | 1440 | M 36871 | S 24858 | E 24530 | I 4262 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 90 | 2100 | 9 | 2073 | M 79426 | S 53698 | E 52774 | I 9183 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2400 | 9 | 827 | M 129256 | S 88726 | E 86014 | I 14823 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | tropas gastas em confronto |

### posto-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D19 | 1a aldeia 100/100: D46 | Marcha: D113 | ETA 109.69h

- Dias criticos:
- D19: 2a aldeia fundada
- D46: 1a aldeia 100/100
- D91: Inicio do Exodus
- D113: Marcha iniciada
- D118: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 83 | 1 | 359 | M 1043 | S 1013 | E 1225 | I 120 | economia estavel | expansao lenta | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 284 | 2 | 540 | M 3330 | S 2407 | E 2565 | I 458 | economia estavel | expansao ideal | militar estavel | influencia acima da curva esperada | risco baixo | - |
| 30 | 406 | 3 | 721 | M 7344 | S 4921 | E 5107 | I 758 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 60 | 725 | 4 | 1265 | M 26390 | S 17369 | E 17482 | I 2813 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 1158 | 6 | 1808 | M 54848 | S 36034 | E 36232 | I 5864 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 749 | 2 | 1029 | M 76627 | S 50183 | E 50506 | I 8173 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

### bastiao-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2500 de influencia.
- 2a aldeia: D9 | 1a aldeia 100/100: D44 | Marcha: D113 | ETA 103.82h

- Dias criticos:
- D9: 2a aldeia fundada
- D44: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D113: Marcha iniciada
- D117: Entrada no Portal
- D120: tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 144 | 2 | 361 | M 1384 | S 1741 | E 1430 | I 166 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 370 | 3 | 558 | M 6176 | S 4929 | E 4409 | I 802 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 518 | 4 | 754 | M 12124 | S 8790 | E 8187 | I 1356 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1444 | 6 | 1344 | M 40052 | S 27409 | E 26201 | I 4637 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 90 | 2100 | 9 | 1933 | M 82400 | S 55744 | E 53835 | I 9541 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2500 | 10 | 1050 | M 134422 | S 91676 | E 88007 | I 15441 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | tropas gastas em confronto |

### bastiao-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D13 | 1a aldeia 100/100: D52 | Marcha: D112 | ETA 152.45h

- Dias criticos:
- D13: 2a aldeia fundada
- D52: 1a aldeia 100/100
- D91: Inicio do Exodus
- D112: Marcha iniciada
- D118: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 61 | 1 | 258 | M 1045 | S 1569 | E 1220 | I 114 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 134 | 2 | 387 | M 4242 | S 3689 | E 3188 | I 464 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 225 | 3 | 515 | M 9260 | S 7078 | E 6366 | I 1006 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 588 | 4 | 902 | M 28861 | S 20186 | E 18925 | I 3126 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 962 | 6 | 1288 | M 57563 | S 39379 | E 37534 | I 6207 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 525 | 2 | 708 | M 79039 | S 53636 | E 51362 | I 8497 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

### celeiro-perfect

- Representante: H01
- Resultado: Entrou no Portal com 2500 de influencia.
- 2a aldeia: D14 | 1a aldeia 100/100: D47 | Marcha: D115 | ETA 52.55h

- Dias criticos:
- D14: 2a aldeia fundada
- D47: 1a aldeia 100/100
- D90: Gate do Portal
- D91: Inicio do Exodus
- D115: Marcha iniciada
- D117: Entrada no Portal
- D120: tropas gastas em confronto

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 97 | 1 | 368 | M 1044 | S 1392 | E 1513 | I 126 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 367 | 3 | 544 | M 4444 | S 3591 | E 3654 | I 597 | economia estavel | expansao agressiva | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 448 | 3 | 720 | M 9764 | S 7037 | E 7158 | I 1067 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 60 | 1387 | 6 | 1248 | M 37044 | S 25462 | E 25465 | I 4236 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 90 | 2064 | 9 | 1776 | M 79739 | S 54479 | E 54417 | I 9121 | economia estavel | expansao agressiva | militar estavel | influencia dentro da curva esperada | risco baixo | - |
| 120 | 2500 | 10 | 917 | M 132603 | S 91488 | E 90469 | I 15037 | economia estavel | expansao ideal | militar critico | influencia dentro da curva esperada | risco alto | tropas gastas em confronto |

### celeiro-lazy

- Representante: H01
- Resultado: Falhou por influencia insuficiente no gate do Portal.
- 2a aldeia: D15 | 1a aldeia 100/100: D42 | Marcha: D112 | ETA 124.47h

- Dias criticos:
- D15: 2a aldeia fundada
- D42: 1a aldeia 100/100
- D91: Inicio do Exodus
- D112: Marcha iniciada
- D117: Falha por influencia insuficiente
- D120: queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score

| Dia | Infl. | Aldeias | Tropas | Recursos | Leitura jogavel | Colapsos |
| ---: | ---: | ---: | ---: | --- | --- | --- |
| 10 | 84 | 1 | 335 | M 1056 | S 1427 | E 1527 | I 114 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 20 | 188 | 2 | 482 | M 3926 | S 3267 | E 3349 | I 418 | economia estavel | expansao ideal | militar estavel | influencia abaixo da curva esperada | risco alto | - |
| 30 | 311 | 3 | 630 | M 8526 | S 6237 | E 6357 | I 762 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco medio | - |
| 60 | 637 | 4 | 1071 | M 28034 | S 19134 | E 19363 | I 2795 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 90 | 990 | 6 | 1513 | M 57149 | S 38477 | E 38996 | I 5816 | economia estavel | expansao ideal | militar estavel | influencia dentro da curva esperada | risco alto | - |
| 120 | 780 | 2 | 1173 | M 78961 | S 52581 | E 53609 | I 8058 | economia estavel | expansao lenta | militar critico | influencia dentro da curva esperada | risco alto | queda de aldeias por pressao da Horda; tropas gastas em confronto; perda territorial derrubou a base de score |

