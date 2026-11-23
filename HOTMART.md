# Vendas pela Hotmart

O quiz pode mandar a pessoa para a **Stripe** (como sempre) ou para a **Hotmart**. A troca é uma linha em
`public/quiz-site/config.js` (`GATEWAY`). As duas continuam funcionando no app ao mesmo tempo: quem comprou
pela Stripe segue liberado pelo `/api/stripe/webhook`, quem comprou pela Hotmart pelo `/api/hotmart/webhook`.
O acesso é liberado pelo **e-mail da compra**, na mesma tabela `assinaturas`.

## Fluxo

Anúncio → quiz → botão "Garantir meu acesso" → **link de pagamento da Hotmart** (com e-mail, nome e UTMs no link)
→ Hotmart avisa `/api/hotmart/webhook` → linha `active` em `assinaturas` + e-mail de boas-vindas
→ página de obrigado `/bem-vindo` → cadastro com o mesmo e-mail.

## Passo a passo

### 1. Supabase
SQL Editor → cole `supabase/migrations/007_hotmart.sql` → Run.

### 2. Hotmart: produto
- Cadastre o Moviq como **aplicativo/software** (é o que ele é), com o preço da oferta (vitalício R$ 37,00).
- Order bumps (opcional): plano alimentar e gerador de treino com IA como produtos próprios, ligados ao
  checkout do vitalício.
- **Página de obrigado** (externa): `https://www.moviqgym.app/bem-vindo`
- Copie o **ID de cada produto** e o **link do checkout** de cada um.

### 3. Hotmart: webhook
Ferramentas → Webhook (API e notificações) → nova configuração:
- URL: `https://www.moviqgym.app/api/hotmart/webhook`
- Versão: **2.0.0**
- Eventos: Compra aprovada, Compra completa, Compra reembolsada, Chargeback, Compra cancelada,
  Cancelamento de assinatura.
- Copie o **hottok**.

### 4. Vercel (Environment Variables) e novo deploy
| Variável | Valor |
|---|---|
| `HOTMART_HOTTOK` | o hottok do passo 3 |
| `HOTMART_PRODUTO_VITALICIO` | ID do produto do app |
| `HOTMART_PRODUTO_PLANO_ALIMENTAR` | ID do order bump (opcional) |
| `HOTMART_PRODUTO_GERADOR_IA` | ID do order bump (opcional) |
| `HOTMART_PRODUTO_ASSINATURA` | ID do produto de assinatura (só se vender os planos 12m/3m/1m na Hotmart) |

Cada variável aceita vários IDs separados por vírgula. Sem a variável, valem os IDs já cadastrados
(em `lib/hotmart.js`, `PRODUTOS_PADRAO`):

| Produto na Hotmart | ID | Preço | Entrega (PDF) |
|---|---|---|---|
| Moviq: App de Treino Personalizado | 9022148 | R$ 37,00 | `docs/hotmart/acesso-moviq.pdf` |
| Moviq: Plano Alimentar (order bump) | 9022748 | R$ 19,90 | `docs/hotmart/plano-alimentar.pdf` |
| Moviq: Gerador de Treino com IA (order bump) | 9022760 | R$ 27,90 | `docs/hotmart/gerador-ia.pdf` |
| Moviq: App de Entrenamiento Personalizado (quiz `/es`) | 9053615 | US$ 9,90 | `docs/hotmart/acceso-moviq-es.pdf` |

Os order bumps ficam na página "Em Branco" do Checkout Builder do produto 9022148 (Ferramentas > Order Bump),
publicada como padrão. Essa página só abre com `?checkoutMode=10` no link e **sem** `off=`: por isso o link do
vitalício em `HOTMART_LINKS` é `https://pay.hotmart.com/B108579304F?checkoutMode=10`.

Os order bumps precisam estar também na configuração do webhook "MOVIQ APP - libera acesso" na Hotmart
(senão o app não recebe o aviso da compra deles).

### 5. Quiz
Em `public/quiz-site/config.js`:
```js
GATEWAY: 'hotmart',
HOTMART_LINKS: { vitalicio: 'https://pay.hotmart.com/XXXXXXXX', ... },
```
O script de UTMs da Utmify troca de modo sozinho (Hotmart: só `data-utmify-prevent-subids`, igual ao código
que a Utmify gera para Hotmart). Na Utmify, ligue a integração com a Hotmart para as vendas aparecerem.

### 6. Teste antes de anunciar
1. Faça o quiz até o fim e clique no botão: deve abrir a Hotmart com e-mail e nome preenchidos.
2. Na Hotmart, use "Enviar teste" no webhook: nos logs da Vercel deve aparecer o aviso sem erro de hottok.
3. Uma compra real de baixo valor (e reembolso depois) confere o ciclo todo: linha em `assinaturas` com
   `gateway = 'hotmart'`, e-mail de boas-vindas e, depois do reembolso, `status = 'refunded'`.

## Quiz em espanhol (quiz.moviqgym.app/es): acesso vitalício pela Hotmart

Até 23/11/2026 o quiz em espanhol vendia assinatura de US$ 5/mês pela Stripe (só cartão internacional, em dólar):
4 vendas com R$ 357 de anúncio em 3 dias. A troca para pagamento único pela Hotmart abre os meios de pagamento
locais e a moeda de cada país. A troca é **só o link** em `public/quiz-site/es.html` (`HOTMART_ES`): vazio, segue a
assinatura pela Stripe.

Produto criado em 23/11/2026: **9053615** (Aplicativo para celular, espanhol, México como país principal,
US$ 9,90 à vista com conversão automática de moeda, página externa `https://quiz.moviqgym.app/es`, entrega
`docs/hotmart/acceso-moviq-es.pdf`), já no webhook "MOVIQ APP - libera acesso" e em
`HOTMART_PRODUTO_VITALICIO_ES` na Vercel.

1. **Hotmart: produto novo, em espanhol** (não use o 9022148, que é em português e em reais):
   - Nome, descrição e página de entrega em espanhol; idioma do produto: espanhol.
   - Preço: o de `VITALICIO_ES_USD` em `es.html` (padrão US$ 9,90), em dólar. A Hotmart mostra na moeda local.
   - **Página de obrigado** (externa): `https://www.moviqgym.app/bem-vindo?lang=es` (o `lang=es` deixa o
     aviso, o cadastro e o app em espanhol).
   - **Pixel**: em Ferramentas/Rastreamento do produto, ligue o pixel da Meta **974150118749887** ("MOVIQ APP ES"),
     com o token da API de Conversões se a Hotmart pedir. É ele que marca a Compra para os anúncios em espanhol
     (o webhook do app não manda Compra à Meta).
   - No webhook "MOVIQ APP - libera acesso", inclua este produto.
2. **Vercel**: `HOTMART_PRODUTO_VITALICIO_ES` = ID do produto novo → novo deploy. Libera o acesso como
   `vitalicio` e manda o e-mail de boas-vindas em espanhol.
3. **Quiz**: em `es.html`, `HOTMART_ES = 'https://pay.hotmart.com/XXXXXXXX'` (link do checkout do produto novo)
   e confira `VITALICIO_ES_USD` igual ao preço da Hotmart → deploy.
4. **Utmify**: a integração com a Hotmart já ligada leva as vendas ES junto (UTMs no link).
5. **Teste**: quiz em `/es` até o fim → botão abre a Hotmart com e-mail e nome → compra de teste/reembolso →
   linha em `assinaturas` (`gateway = 'hotmart'`, `plano = 'vitalicio'`) e e-mail de boas-vindas em espanhol.

Sem recuperação automática de carrinho no app para a Hotmart: use a recuperação de vendas do painel da Hotmart.

## Voltar para a Stripe
`GATEWAY: 'stripe'` no `config.js` e novo deploy. Nada mais muda.

## O que fica de fora na Hotmart
- **Upsell depois da compra** (`/bem-vindo`) e **e-mails de recuperação** de Pix vencido/carrinho abandonado
  são da Stripe. Na Hotmart, use as ferramentas dela (order bump, upsell e recuperação de vendas no painel).
