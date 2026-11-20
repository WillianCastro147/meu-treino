// Depois do pagamento: devolve o e-mail e o nome da Checkout Session para a página /bem-vindo
// abrir o cadastro já preenchido. Só responde para sessões concluídas.
// Se foi a compra do acesso vitalício, devolve as ofertas dos extras que a pessoa não levou (plano alimentar,
// gerador de treino com IA), na ordem, para a /bem-vindo mostrar uma de cada vez antes do cadastro.
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

  // Ofertas em sequência (plano alimentar, depois gerador com IA): "Não, obrigado" passa para a próxima
  const upsells = [];
  if (s.metadata?.plano === PLANO_VITALICIO) {
    const levou = new Set(await Promise.all((s.line_items?.data || []).map(precoDoItem)));
    for (const e of extrasAtivos().filter((x) => !levou.has(x.price))) {
      const preco = await precoExtra(e.plano);
      if (preco) upsells.push({ plano: e.plano, nome: e.nome, preco, url: `/api/stripe/upsell?${new URLSearchParams({ s: s.id, p: e.plano })}` });
    }
  }

  return Response.json({
    email: s.customer_details?.email || s.customer_email || null,
    name: await nomeDaCompra(s),
    plano: s.metadata?.plano || null,
    upsell: upsells[0] || null,
    upsells,
  });
}
