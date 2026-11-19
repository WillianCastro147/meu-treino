// Depois do pagamento: devolve o e-mail e o nome da Checkout Session para a página /bem-vindo
// abrir o cadastro já preenchido. Só responde para sessões concluídas.
// Se foi a compra do acesso vitalício sem o plano alimentar, devolve também a oferta do plano
// alimentar (upsell) com o valor, para a /bem-vindo mostrar antes do cadastro.
import { stripe, nomeDaCompra, PLANO_VITALICIO, PLANO_ALIMENTAR_PRICE, precoPlanoAlimentar } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!stripe) return Response.json({ error: 'not_configured' }, { status: 503 });
  const id = new URL(req.url).searchParams.get('session_id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return Response.json({ error: 'bad_request' }, { status: 400 });
  let s;
  try {
    s = await stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] });
  } catch (e) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (s.status !== 'complete') return Response.json({ error: 'not_complete' }, { status: 409 });

  let upsell = null;
  const levouPlano = (s.line_items?.data || []).some((i) => i.price?.id === PLANO_ALIMENTAR_PRICE);
  if (PLANO_ALIMENTAR_PRICE && s.metadata?.plano === PLANO_VITALICIO && !levouPlano) {
    const preco = await precoPlanoAlimentar();
    if (preco) upsell = { preco, url: `/api/stripe/upsell?s=${encodeURIComponent(s.id)}` };
  }

  return Response.json({
    email: s.customer_details?.email || s.customer_email || null,
    name: await nomeDaCompra(s),
    plano: s.metadata?.plano || null,
    upsell,
  });
}
