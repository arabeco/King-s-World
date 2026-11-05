# Produtos para o teste Android

## Identificadores

Pacote Android: `com.kingsworld.app`. Não mudar esses IDs depois que compras reais existirem.

| Produto | ID | Tipo pretendido | Situação no código |
|---|---|---|---|
| Premium mensal | `premium_monthly` | Assinatura; plano `monthly` | Cliente, verificador e SQL implementados; venda desativada |
| 50 Gemas | `gems_50` | Compra consumível | Crédito e consumo testados localmente. Venda desativada |
| 100 Gemas | `gems_100` | Compra consumível | Crédito e consumo testados localmente. Venda desativada |
| 250 Gemas | `gems_250` | Compra consumível | Crédito e consumo testados localmente. Venda desativada |
| 500 Gemas | `gems_500` | Compra consumível | Crédito e consumo testados localmente. Venda desativada |

Os valores em dinheiro serão definidos no cadastro. O app deve mostrar o preço localizado retornado pela Play, sem preço fictício. Os pacotes atuais na interface continuam desativados. Não confundir a carteira/loja interna com Gemas já funcionais com a compra de Gemas por dinheiro real.

Premium: cinco mundos simultâneos em vez de um, criação com senha, visual e benefício sem propaganda. Não existe season pass. Anúncios não estão integrados nesta versão; não apresentar “remover anúncios” como funcionalidade já testada. O Premium não aumenta o bônus ou o prêmio de uma mesma ação/mundo; jogar mais mundos pode acelerar a coleção por calendário.

## Ordem de liberação

1. Publicar o código web validado na URL usada pelo Android. `/api/release` precisa responder com o mesmo `codeRevision` calculado por `scripts/release-fingerprint.mjs`.
2. Conferir o próximo versionCode/versionName e gerar o AAB de teste. `npm run android:bundle` sincroniza o shell e recusa continuar se a identidade online não corresponder.
3. Cadastrar os produtos e configurar a conta/credencial de teste da Play; sem cobrança real antes da validação.
4. Configurar e publicar o verificador Play com credencial de servidor. Validar compra, restauração, cancelamento, expiração e resposta perdida.
5. Ligar o checkout à loja, configurar a conciliação automática de estornos e validar o fluxo completo com contas de teste da Play antes de ativar as vendas.

A migração 75 foi aplicada no King’s World Game10. O ensaio com rollback e o teste após a aplicação confirmaram crédito único, estorno e permissões. Os saldos anteriores e a contagem do inventário foram preservados. O cadastro dos produtos, a publicação do verificador e o teste de compra na Play estão pendentes.
