// Cria a Checkout Session da Stripe (página de pagamento hospedada pela Stripe) e redireciona para ela.
// Chamado pela tela de planos do quiz (quiz.moviqgym.app) com um <form method="POST">: plano=12m|3m|1m|vitalicio|premium, email e UTMs.
// A sessão em si é montada em lib/checkout.js (a mesma usada pelo link de recuperação).
import { waitUntil } from '@vercel/functions';
import { stripe, APP_URL } from '@/lib/stripe';
import { enviarLeona } from '@/lib/leona';
import { criarSessaoCheckout, planoValido } from '@/lib/checkout';
import { dadosDoNavegador } from '@/lib/metaCapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (!planoValido(plano)) return new Response('Plano inválido ou sem preço configurado.', { status: 400 });

  let session;
  try {
    session = await criarSessaoCheckout({
      plano,
      email: body.email,
      nome: body.nome,
      lang: body.lang, // 'es' no quiz em espanhol
      whatsapp: body.whatsapp, // opcional, digitado no quiz (recuperação pelo LeonaFlow)
      tracking: body,
      // fbp/fbc (cookies do pixel, mesmo domínio), IP e navegador de quem clicou: vão na Compra para a Meta
      // (lib/metaCapi.js), que assim liga a venda ao clique no anúncio
      extra: dadosDoNavegador({ headers: req.headers, body }),
    });
  } catch (e) {
    console.error('Stripe checkout:', e.type, e.code, e.message);
    return new Response('Não foi possível abrir o pagamento agora. Volte e tente de novo em instantes.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // WhatsApp pelo LeonaFlow: "abriu o pagamento" (o fluxo espera ~10 min e chama quem não seguiu).
  // waitUntil: sai depois da resposta, sem atrasar a abertura da página da Stripe.
  waitUntil(
    enviarLeona('checkout_aberto', session, { appUrl: APP_URL })
      .then((r) => !r?.skipped && console.log('LeonaFlow checkout_aberto', session.id, JSON.stringify(r)))
      .catch((e) => console.error('LeonaFlow: checkout_aberto', session.id, e.message))
  );

  // Form POST do quiz: 303 leva o navegador direto para a página da Stripe. Fetch com JSON: devolve a URL.
  if ((req.headers.get('accept') || '').includes('application/json')) return Response.json({ url: session.url });
  return Response.redirect(session.url, 303);
}
