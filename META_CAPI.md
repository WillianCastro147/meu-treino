# Compra na Meta pela API de Conversões (enviada pelo app)

## Por quê
A Compra chegava à Meta só pela Utmify, **sem fbc, fbp, IP e navegador** do comprador (qualidade de
correspondência 3,5/10). A Meta não conseguia ligar a venda ao clique no anúncio: de 17 vendas na Stripe,
a campanha mostrava 11. Em campanha de bid cap isso pesa: a Meta vê um custo por compra maior que o real
e segura a entrega.

## Como funciona
1. **Clique em "Garantir meu acesso"** (`/api/stripe/checkout`): o app guarda nos metadados da sessão da
   Stripe os cookies do pixel (`_fbp`, `_fbc`; sem `_fbc`, monta pelo `fbclid` do anúncio), o IP, o
   navegador e a página (`meta_fbp`, `meta_fbc`, `meta_ip`, `meta_ua`, `meta_url`). Links de recuperação e
   o upsell da `/bem-vindo` mantêm os dados do clique original.
2. **Pagamento confirmado** (`/api/stripe/webhook`: cartão na hora, Pix quando cai, assinatura): o app manda
   a **Compra** para a Meta (`lib/metaCapi.js`) com esses dados + e-mail, telefone, nome e endereço em hash,
   valor total (com os bumps) e `event_id = purchase_<id da sessão>` (aviso repetido não conta duas vezes).
3. Falha no envio só é registrada no log da Vercel; nunca impede liberar o acesso.

## Ligar (os dois passos juntos, para a venda não contar duas vezes)
1. **Token**: Gerenciador de Eventos → pixel **MOVIQ APP** → Configurações → API de Conversões →
   **Gerar token de acesso**. Na Vercel: `META_CAPI_TOKEN` = o token. Novo deploy.
2. **Utmify**: desligue o envio do evento de **Compra** para o pixel da Meta (a Utmify continua mostrando
   as vendas no painel dela). Sem isso, cada venda chega duas vezes à Meta (IDs de evento diferentes).

## Conferir antes de contar como venda (opcional)
Gerenciador de Eventos → **Eventos de teste** → copie o código (ex.: `TEST12345`) → Vercel:
`META_TEST_EVENT_CODE` = o código e novo deploy. A próxima compra aparece só em "Eventos de teste", com a
lista de parâmetros. Depois **apague** `META_TEST_EVENT_CODE` (com ela, as compras não contam na campanha).

## Variáveis
| Variável | Para quê |
|---|---|
| `META_CAPI_TOKEN` | obrigatório para enviar |
| `META_PIXEL_ID` | opcional (padrão `2637346966711521`, MOVIQ APP) |
| `META_TEST_EVENT_CODE` | opcional, só para teste |
| `META_GRAPH_VERSION` | opcional (padrão `v24.0`) |

## Desligar
Apague `META_CAPI_TOKEN` na Vercel (e religue a Compra na Utmify).
