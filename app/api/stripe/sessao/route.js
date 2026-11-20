// Depois do pagamento: devolve o e-mail e o nome da Checkout Session para a página /bem-vindo
// abrir o cadastro já preenchido. Só responde para sessões concluídas.
// Se foi a compra do acesso vitalício e a pessoa não levou algum extra (plano alimentar, gerador de treino
// com IA), devolve a oferta do primeiro que ficou de fora (upsell), para a /bem-vindo mostrar antes do cadastro.
import { stripe, nomeDaCompra, PLANO_VITALICIO, extrasAtivos, precoExtra, precoDoItem } from '@/lib/stripe';

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
  if (s.metadata?.plano === PLANO_VITALICIO) {
    const levou = new Set(await Promise.all((s.line_items?.data || []).map(precoDoItem)));
    const faltou = extrasAtivos().find((e) => !levou.has(e.price));
    const preco = faltou ? await precoExtra(faltou.plano) : null;
    if (faltou && preco) {
      upsell = { plano: faltou.plano, nome: faltou.nome, preco, url: `/api/stripe/upsell?${new URLSearchParams({ s: s.id, p: faltou.plano })}` };
    }
  }

  return Response.json({
    email: s.customer_details?.email || s.customer_email || null,
    name: await nomeDaCompra(s),
    plano: s.metadata?.plano || null,
    upsell,
  });
}
