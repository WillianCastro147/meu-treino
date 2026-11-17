# Stripe: o que falta configurar

Integração com **Stripe Checkout hospedado** (a pessoa é levada para a página de pagamento da Stripe), em modo **assinatura**.
Este arquivo é a lista única do que falta. O código já está pronto; faltam valores e configurações nas contas.

## Values to Replace

Os valores abaixo ficam em **variáveis de ambiente da Vercel** (nada de chave no código). Enquanto não forem preenchidos, o endpoint de pagamento responde "Pagamento ainda não configurado".

**Arquivos que leem esses valores:**
- [lib/stripe.js](lib/stripe.js)
- [app/api/stripe/checkout/route.js](app/api/stripe/checkout/route.js)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `subscription` | Já definido: os planos de 12, 3 e 1 mês são cobrança recorrente. Use `payment` só se um dia vender acesso avulso. |
| success_url | `https://moviqapp.vercel.app/bem-vindo?session_id={CHECKOUT_SESSION_ID}` | Já é o endereço real do app. Se o domínio mudar, defina `NEXT_PUBLIC_APP_URL` na Vercel. Mantenha o `{CHECKOUT_SESSION_ID}`. |
| cancel_url | `QUIZ_URL` (padrão `https://quiz.moviqgym.app`) | Só defina `QUIZ_URL` na Vercel se o endereço do quiz mudar. |
| line_items[].price (12 meses) | `STRIPE_PRICE_12M` (vazio) | Price ID do plano anual, ex.: `price_1Qabc...` |
| line_items[].price (3 meses) | `STRIPE_PRICE_3M` (vazio) | Price ID do plano trimestral |
| line_items[].price (1 mês) | `STRIPE_PRICE_1M` (vazio) | Price ID do plano mensal |

## Configured Parameters

Configurados no Checkout Studio e já colocados exatamente assim.

**Arquivo:**
- [app/api/stripe/checkout/route.js](app/api/stripe/checkout/route.js)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` (SDK `stripe` 23.1.0 instalado; a partir da 21.0.0 o valor é `hosted_page`) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` (só vale em `mode: subscription`, que é o caso) |
| submit_type | `auto` |
| integration_identifier | `hosted_mobile_app_0001` |
| origin_context | `mobile_app` |

Além desses, a sessão leva `customer_email` (o e-mail digitado no quiz, para a compra, a conta do app e o plano do quiz baterem) e `metadata.plano`.

## Setup

### 1. Stripe (comece no **modo de teste**)
1. **Produtos:** em *Product catalog*, crie o produto "Moviq" com 3 preços **recorrentes** em BRL:
   - a cada 12 meses (ex.: R$ 119,99), a cada 3 meses (ex.: R$ 89,99) e mensal (ex.: R$ 34,99).
   - Copie o **Price ID** (`price_...`) de cada um.
2. **Chave da API:** em *Developers → API keys*, copie a **Secret key** (`sk_test_...`). Uma *restricted key* também serve, com escrita em *Checkout Sessions* e leitura em *Customers* e *Subscriptions*.
3. **Webhook:** em *Developers → Webhooks → Add endpoint*:
   - URL: `https://moviqapp.vercel.app/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copie o **Signing secret** (`whsec_...`).
4. **Portal do cliente** (para "Cancele quando quiser"): em *Settings → Billing → Customer portal*, ative o portal e copie o link de login. Ver "Próximos passos".

### 2. Supabase
1. No **SQL Editor**, rode [supabase/migrations/006_assinaturas.sql](supabase/migrations/006_assinaturas.sql) (cria a tabela `assinaturas` e a função `tem_acesso()`).
2. Copie a chave **service_role** (*Project Settings → API Keys*). Ela é secreta: só vai na Vercel, nunca no quiz nem no app.
3. **Antes de ligar o bloqueio**, libere as contas que já existem (você e testes), com o trecho "LIBERAR CONTAS À MÃO" no fim da migração 006.

### 3. Vercel (*Settings → Environment Variables*, Production e Preview)

| Variável | Valor |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` (depois `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_12M` / `STRIPE_PRICE_3M` / `STRIPE_PRICE_1M` | os Price IDs |
| `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role |
| `QUIZ_URL` | opcional (padrão `https://quiz.moviqgym.app`) |
| `NEXT_PUBLIC_PLANOS_URL` | o mesmo endereço do quiz (botão "Ver planos" de quem está sem assinatura) |
| `NEXT_PUBLIC_EXIGIR_ASSINATURA` | **deixe sem** até testar tudo; depois `1` para ligar o bloqueio |

Depois de criar ou alterar variáveis: *Deployments → Redeploy*.

### 4. Quiz (`public/quiz-site`, em quiz.moviqgym.app)
Em `config.js` do quiz:
- `STRIPE_CHECKOUT_URL` já aponta para `https://moviqapp.vercel.app/api/stripe/checkout`;
- os `total` de `PLANOS` são **só o que aparece na tela**: precisam ser iguais aos preços cadastrados na Stripe.

## Arquivos novos

```
app/api/stripe/checkout/route.js   cria a Checkout Session e redireciona para a Stripe (POST do quiz)
app/api/stripe/webhook/route.js    recebe os avisos da Stripe (assinatura conferida) e atualiza a tabela assinaturas
app/api/stripe/sessao/route.js     devolve e-mail/nome de uma sessão concluída (usado por /bem-vindo)
app/bem-vindo/page.js              volta da Stripe: abre o cadastro com o e-mail da compra
lib/stripe.js                      cliente Stripe, preços por plano e Supabase com service_role (só servidor)
supabase/migrations/006_assinaturas.sql
```
Alterados: `components/AuthGuard.js` (bloqueio por assinatura, desligado por padrão) e `app/api/coach/route.js` (o Coach com IA confere a assinatura quando o bloqueio está ligado).

## Como funciona

1. **Quiz** → tela de planos → **Continuar** envia `plano` (12m/3m/1m) e `email` para `/api/stripe/checkout`.
2. O app cria a **Checkout Session** (assinatura, e-mail preenchido) e redireciona para a página da Stripe.
3. A pessoa paga. A Stripe:
   - avisa `/api/stripe/webhook` → linha `active` na tabela `assinaturas` com o e-mail da compra;
   - redireciona para `/bem-vindo` → cadastro com o e-mail preenchido.
4. A pessoa confirma o e-mail e entra → `/preparando` monta o plano do quiz.
5. Com `NEXT_PUBLIC_EXIGIR_ASSINATURA=1`, toda página logada confere `tem_acesso()`:
   - `active`, `trialing`, `past_due` e `cortesia` entram;
   - `canceled` e `unpaid` veem a tela "Sua assinatura não está ativa".
   Renovação, falha de pagamento e cancelamento chegam pelo webhook e atualizam a linha sozinhos.

## Testes (modo de teste da Stripe)

Na página de pagamento de teste:

| Cartão | Resultado |
|--------|-----------|
| `4242 4242 4242 4242` | pagamento aprovado |
| `4000 0025 0000 3155` | pede autenticação 3D Secure |
| `4000 0000 0000 9995` | recusado (saldo insuficiente) |

Use qualquer data futura, qualquer CVC e qualquer CEP. Roteiro:
1. Faça o quiz com um e-mail seu → escolha um plano → pague com `4242...`.
2. Confira a linha em *Table Editor → assinaturas* (status `active`).
3. Crie a conta no `/bem-vindo` → confirme o e-mail → veja o plano montado.
4. Cancele a assinatura no painel da Stripe → a linha vira `canceled`. Com o bloqueio ligado, a conta mostra a tela de assinatura inativa.

Para ver os avisos chegando: *Developers → Webhooks → (seu endpoint) → Event deliveries*.

**Atenção:** os parâmetros do Checkout Studio (`ui_mode: hosted_page`, `integration_identifier`, `origin_context`) só foram conferidos pela Stripe com uma chave de verdade. O teste local foi feito com chave falsa. Se a Stripe recusar algum deles, o erro aparece nos logs da Vercel como `Stripe checkout: ...`.

## Próximos passos
- **Botão "Gerenciar assinatura"** no Perfil do app, com o link do portal do cliente da Stripe. Ele permite cancelar e trocar o cartão, e é o que sustenta o "Cancele quando quiser".
- **Termos de uso e Política de privacidade:** preencha `TERMOS_URL` e `PRIVACIDADE_URL` no `config.js` do quiz.
- **Ir para produção:** troque as chaves e os Price IDs pelos do modo *live* e crie o webhook também no modo *live*. Ele tem outro `whsec_...`.

## Ajuda
- https://support.stripe.com
- https://docs.stripe.com/mcp
