// Oferta de um extra logo depois da compra (botão na /bem-vindo):
//   /api/stripe/upsell?s=<id da Checkout Session do acesso vitalício já pago>&p=plano_alimentar|gerador_ia
// Cria o pagamento do extra (Pix ou cartão) com o mesmo e-mail, nome e UTMs da compra
// (a Utmify atribui o upsell ao mesmo anúncio) e leva direto para a página de pagamento.
import { stripe, APP_URL, extraDoPlano } from '@/lib/stripe';
import { criarSessaoCheckout } from '@/lib/checkout';
import { emailDaSessao } from '@/lib/recuperacao';
import { dadosDoNavegador, dadosDoClique } from '@/lib/metaCapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('s') || '';
  const extra = extraDoPlano(url.searchParams.get('p') || 'plano_alimentar');
  // Desistiu no pagamento da oferta: volta para a /bem-vindo, que segue para a oferta seguinte (ou o cadastro)
  const voltar = `${APP_URL}/bem-vindo?session_id=${encodeURIComponent(id)}&depois=${encodeURIComponent(extra?.plano || '')}`;
  if (!stripe || !extra || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return Response.redirect(voltar, 303);

  try {
    const compra = await stripe.checkout.sessions.retrieve(id);
    // Só para quem pagou a compra principal
    if (compra.status !== 'complete' || compra.payment_status !== 'paid') return Response.redirect(voltar, 303);
    const nova = await criarSessaoCheckout({
      plano: extra.plano,
      email: emailDaSessao(compra),
      nome: compra.metadata?.nome || '',
      whatsapp: compra.metadata?.whatsapp,
      tracking: compra.metadata || {},
      extra: { upsell_de: compra.id, ...dadosDoClique(compra.metadata, dadosDoNavegador({ headers: req.headers })) },
      cancelUrl: voltar, // desistiu da oferta: volta para terminar o cadastro
    });
    return Response.redirect(nova.url, 303);
  } catch (e) {
    console.error('Upsell', extra.plano, e.type, e.code, e.message);
    return Response.redirect(voltar, 303);
  }
}
