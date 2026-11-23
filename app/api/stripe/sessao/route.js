// Depois do pagamento: devolve o e-mail e o nome da Checkout Session para a página /bem-vindo
// abrir o cadastro já preenchido. Só responde para sessões concluídas.
// Se foi a compra do app (vitalício ou Premium), devolve as ofertas depois da compra (lib/stripe.js
// ofertasPosCompra) que a pessoa ainda não tem: hoje, o guia de treino do sexo marcado no quiz
// (Guia de Treino Feminino para quem marcou feminino). A /bem-vindo mostra uma de cada vez antes do cadastro.
import { stripe, supabaseAdmin, nomeDaCompra, PLANO_VITALICIO, PLANO_PREMIUM, ofertasPosCompra, precoExtra, precoDoItem, temExtra } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sexo marcado no quiz feito com este e-mail ('m' | 'f' | null)
async function sexoDoQuiz(db, email) {
  if (!db || !email) return null;
  try {
    const { data } = await db.from('quiz_leads').select('answers').eq('email', email).maybeSingle();
    const s = data?.answers?.sexo;
    return s === 'f' || s === 'm' ? s : null;
  } catch (e) {
    return null;
  }
}

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

  const email = String(s.customer_details?.email || s.customer_email || '').trim().toLowerCase();

  // Ofertas em sequência: "Não, obrigado" passa para a próxima (ou para o cadastro)
  const upsells = [];
  if ((s.metadata?.plano === PLANO_VITALICIO || s.metadata?.plano === PLANO_PREMIUM) && !s.metadata?.lang) {
    const db = supabaseAdmin();
    const levou = new Set(await Promise.all((s.line_items?.data || []).map(precoDoItem)));
    for (const e of ofertasPosCompra(await sexoDoQuiz(db, email))) {
      if (levou.has(e.price)) continue;
      if (await temExtra(db, email, e.plano).catch(() => false)) continue; // já comprou antes
      const preco = await precoExtra(e.plano);
      if (preco) upsells.push({ plano: e.plano, nome: e.nome, preco, url: `/api/stripe/upsell?${new URLSearchParams({ s: s.id, p: e.plano })}` });
    }
  }

  return Response.json({
    email: email || null,
    name: await nomeDaCompra(s),
    plano: s.metadata?.plano || null,
    upsell: upsells[0] || null,
    upsells,
  });
}
