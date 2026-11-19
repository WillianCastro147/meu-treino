// Oferta do plano alimentar logo depois da compra (botão na /bem-vindo):
//   /api/stripe/upsell?s=<id da Checkout Session do acesso vitalício já pago>
// Cria o pagamento do plano alimentar (Pix ou cartão) com o mesmo e-mail, nome e UTMs da compra
// (a Utmify atribui o upsell ao mesmo anúncio) e leva direto para a página de pagamento.
import { stripe, APP_URL, PLANO_ALIMENTAR, PLANO_ALIMENTAR_PRICE } from '@/lib/stripe';
import { criarSessaoCheckout } from '@/lib/checkout';
import { emailDaSessao } from '@/lib/recuperacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('s') || '';
  const voltar = `${APP_URL}/bem-vindo?session_id=${encodeURIComponent(id)}&sem_oferta=1`;
  if (!stripe || !PLANO_ALIMENTAR_PRICE || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return Response.redirect(voltar, 303);

  try {
    const compra = await stripe.checkout.sessions.retrieve(id);
    // Só para quem pagou a compra principal
    if (compra.status !== 'complete' || compra.payment_status !== 'paid') return Response.redirect(voltar, 303);
    const nova = await criarSessaoCheckout({
      plano: PLANO_ALIMENTAR,
      email: emailDaSessao(compra),
      nome: compra.metadata?.nome || '',
      tracking: compra.metadata || {},
      extra: { upsell_de: compra.id },
      cancelUrl: voltar, // desistiu da oferta: volta para terminar o cadastro
    });
    return Response.redirect(nova.url, 303);
  } catch (e) {
    console.error('Upsell plano alimentar:', e.type, e.code, e.message);
    return Response.redirect(voltar, 303);
  }
}
