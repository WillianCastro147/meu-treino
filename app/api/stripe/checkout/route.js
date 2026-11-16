// Cria a Checkout Session da Stripe (página de pagamento hospedada pela Stripe) e redireciona para ela.
// Chamado pela tela de planos do quiz (Hostinger) com um <form method="POST">: plano=12m|3m|1m e email.
import { stripe, PLAN_PRICES, APP_URL } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

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
  const price = PLAN_PRICES[plano];
  if (!price) return new Response('Plano inválido ou sem preço configurado.', { status: 400 });
  const email = String(body.email || '').trim().toLowerCase();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
    // Configurado no Checkout Studio
    ui_mode: 'hosted_page',
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    payment_method_collection: 'always', // só vale em mode "subscription"
    submit_type: 'auto',
    integration_identifier: 'hosted_mobile_app_0001',
    origin_context: 'mobile_app',

    // Assinatura recorrente (planos de 12, 3 e 1 mês)
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${APP_URL}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: process.env.QUIZ_URL || APP_URL,

    // E-mail do quiz já preenchido: é por ele que o app libera o acesso e acha o plano do quiz
    ...(EMAIL_RE.test(email) && email.length <= 254 ? { customer_email: email } : {}),
    metadata: { plano, origem: 'quiz' },
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
