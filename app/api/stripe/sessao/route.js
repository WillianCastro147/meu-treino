// Depois do pagamento: devolve o e-mail e o nome da Checkout Session para a página /bem-vindo
// abrir o cadastro já preenchido. Só responde para sessões concluídas.
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!stripe) return Response.json({ error: 'not_configured' }, { status: 503 });
  const id = new URL(req.url).searchParams.get('session_id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return Response.json({ error: 'bad_request' }, { status: 400 });
  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    if (s.status !== 'complete') return Response.json({ error: 'not_complete' }, { status: 409 });
    return Response.json({ email: s.customer_details?.email || s.customer_email || null, name: s.customer_details?.name || null });
  } catch (e) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
}
