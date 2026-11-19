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

## Voltar para a Stripe
`GATEWAY: 'stripe'` no `config.js` e novo deploy. Nada mais muda.

## O que fica de fora na Hotmart
- **Upsell depois da compra** (`/bem-vindo`) e **e-mails de recuperação** de Pix vencido/carrinho abandonado
  são da Stripe. Na Hotmart, use as ferramentas dela (order bump, upsell e recuperação de vendas no painel).
