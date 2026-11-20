// Link de recuperação (do e-mail automático ou da mensagem de WhatsApp):
//   /api/stripe/recuperar?s=<id da Checkout Session perdida>&c=email|whatsapp
// Gera um checkout novo com o mesmo plano, e-mail, nome e UTMs (a Utmify continua atribuindo a venda
// ao anúncio de origem) e leva a pessoa direto para a página de pagamento.
import { stripe, supabaseAdmin, APP_URL, QUIZ_URL } from '@/lib/stripe';
import { criarSessaoCheckout, planoValido } from '@/lib/checkout';
import { emailDaSessao, situacao } from '@/lib/recuperacao';
import { dadosDoNavegador, dadosDoClique } from '@/lib/metaCapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANAIS = ['email', 'whatsapp'];

export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('s') || '';
  const canal = CANAIS.includes(url.searchParams.get('c')) ? url.searchParams.get('c') : 'link';
  if (!stripe || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return Response.redirect(QUIZ_URL, 303);

  let antiga;
  try {
    antiga = await stripe.checkout.sessions.retrieve(id, { expand: ['payment_intent'] });
  } catch (e) {
    return Response.redirect(QUIZ_URL, 303);
  }

  // Já pagou (nesta sessão ou o acesso já está liberado): vai para o app em vez de cobrar de novo
  const email = emailDaSessao(antiga);
  let pago = situacao(antiga) === 'pago';
  const db = supabaseAdmin();
  if (!pago && db && email) {
    const { data } = await db.from('assinaturas').select('id').eq('email', email).in('status', ['active', 'trialing', 'past_due', 'cortesia']).limit(1);
    pago = (data || []).length > 0;
  }
  if (pago) return Response.redirect(`${APP_URL}/login?${new URLSearchParams({ email })}`, 303);

  const plano = antiga.metadata?.plano;
  if (!planoValido(plano)) return Response.redirect(QUIZ_URL, 303);

  try {
    const nova = await criarSessaoCheckout({
      plano,
      email,
      nome: antiga.metadata?.nome || '',
      tracking: antiga.metadata || {},
      extra: {
        recuperacao: canal,
        recuperado_de: antiga.id,
        ...dadosDoClique(antiga.metadata, dadosDoNavegador({ headers: req.headers })),
      },
    });
    return Response.redirect(nova.url, 303);
  } catch (e) {
    console.error('Recuperação: checkout novo falhou', e.type, e.code, e.message);
    return Response.redirect(QUIZ_URL, 303);
  }
}
