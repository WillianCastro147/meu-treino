// Cria a Checkout Session da Stripe (página de pagamento hospedada pela Stripe) e redireciona para ela.
// Chamado pela tela de planos do quiz (quiz.moviqgym.app) com um <form method="POST">: plano=12m|3m|1m|vitalicio, email e UTMs.
import { stripe, PLAN_PRICES, APP_URL, QUIZ_URL, PLANO_VITALICIO, VITALICIO_PRICE, VITALICIO_CENTAVOS } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// Parâmetros do anúncio que o quiz repassa: vão para os metadados da sessão e da assinatura na Stripe
// (é de lá que a Utmify lê a origem da venda).
const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck', 'fbclid'];
const trackingFrom = (body) =>
  Object.fromEntries(
    TRACKING_KEYS.filter((k) => typeof body[k] === 'string' && body[k].trim()).map((k) => [k, body[k].trim().slice(0, 450)])
  );

async function readBody(req) {
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) return req.json().catch(() => ({}));
  const form = await req.formData().catch(() => null);
  return form ? Object.fromEntries(form) : {};
}

export async function POST(req) {
  if (!stripe) return new Response('Pagamento ainda não configurado (STRIPE_SECRET_KEY).', { status: 503 });

  const body = await readBody(req);
  const plano = String(body.plano || '');
  const vitalicio = plano === PLANO_VITALICIO;
  const price = vitalicio ? null : PLAN_PRICES[plano];
  if (!vitalicio && !price) return new Response('Plano inválido ou sem preço configurado.', { status: 400 });
  const email = String(body.email || '').trim().toLowerCase();
  const metadata = { plano, origem: 'quiz', ...trackingFrom(body) };
  // Nome do quiz: só na sessão (não na assinatura), para o link de acesso usar ele e não o nome do cartão
  const nome = String(body.nome || '').trim().replace(/\s+/g, ' ').slice(0, 80);

  // Assinatura recorrente (planos de 12, 3 e 1 mês): só cartão/carteiras
  const assinatura = {
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: 'always', // só vale em mode "subscription"
    subscription_data: { metadata }, // também na assinatura (renovações carregam a origem)
  };
  // Acesso vitalício: pagamento único. Em mode "payment" a Stripe mostra o Pix (ativo no painel) além do cartão.
  const pagamentoUnico = {
    mode: 'payment',
    line_items: [
      VITALICIO_PRICE
        ? { price: VITALICIO_PRICE, quantity: 1 } // preço avulso cadastrado na Stripe
        : {
            quantity: 1,
            price_data: {
              currency: 'brl',
              unit_amount: VITALICIO_CENTAVOS,
              product_data: { name: 'Moviq · Acesso vitalício', description: 'Pagamento único. Sem mensalidade.' },
            },
          },
    ],
    customer_creation: 'always',
    payment_intent_data: { metadata }, // a origem também no pagamento (Utmify)
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create({
    // Configurado no Checkout Studio
    ui_mode: 'hosted_page',
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    submit_type: 'auto',
    integration_identifier: 'hosted_mobile_app_0001',
    origin_context: 'mobile_app',

    ...(vitalicio ? pagamentoUnico : assinatura),
    success_url: `${APP_URL}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: QUIZ_URL,

    // E-mail do quiz já preenchido: é por ele que o app libera o acesso e acha o plano do quiz
    ...(EMAIL_RE.test(email) && email.length <= 254 ? { customer_email: email } : {}),
    metadata: nome ? { ...metadata, nome } : metadata,
    });
  } catch (e) {
    console.error('Stripe checkout:', e.type, e.code, e.message);
    return new Response('Não foi possível abrir o pagamento agora. Volte e tente de novo em instantes.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Form POST do quiz: 303 leva o navegador direto para a página da Stripe. Fetch com JSON: devolve a URL.
  if ((req.headers.get('accept') || '').includes('application/json')) return Response.json({ url: session.url });
  return Response.redirect(session.url, 303);
}
