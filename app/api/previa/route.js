// Dados da prévia do app (/previa): nome, resumo do plano e qual plano pronto mostrar.
//   GET /api/previa?l=<id do lead em quiz_leads>       mensagem do lead (ainda não abriu o pagamento)
//   GET /api/previa?s=<id da sessão de pagamento>      mensagens de recuperação (abriu o pagamento, Pix
//                                                      gerado/vencido, abandonou): acha o quiz pelo e-mail
// Sem login: o id só chega pela mensagem de WhatsApp da pessoa. Devolve só o necessário para a tela
// (nada de e-mail, telefone ou respostas cruas) e o id do lead, que o botão de compra usa.
import { stripe, supabaseAdmin } from '@/lib/stripe';
import { planSummary, starterFor, firstName } from '@/lib/quiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSAO_RE = /^cs_(live|test)_[A-Za-z0-9]+$/;

async function leadDaSessao(db, sessionId) {
  if (!stripe || !SESSAO_RE.test(sessionId)) return null;
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    return null;
  }
  const email = String(session?.customer_details?.email || session?.customer_email || '').trim().toLowerCase();
  if (!email) return null;
  const { data } = await db
    .from('quiz_leads')
    .select('id, name, answers')
    .eq('email', email)
    .order('updated_at', { ascending: false })
    .limit(1);
  const lead = data?.[0];
  if (!lead) return null;
  // o nome digitado no quiz vai na sessão; vale se o lead não tiver
  return { ...lead, name: lead.name || session.metadata?.nome || '' };
}
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// /previa?l=demo: exemplo fixo, para ver a página sem dados de nenhum lead
const DEMO = {
  sexo: 'm', objetivo: 'massa', experiencia: '6m-2a', recente: '3-4', dias: 4, minutos: 60,
  foco: ['peito', 'bracos'], limites: ['nenhuma'], desafio: 'sim', local: 'academia',
};

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const id = params.get('l') || '';
  if (id === 'demo') {
    return json({ l: 'demo', nome: 'Carlos', resumo: planSummary(DEMO), plano: starterFor(DEMO), desafio: true, minutos: 60 });
  }
  const db = supabaseAdmin();
  if (!db) return json({ error: 'not_found' }, 404);
  let lead = null;
  if (UUID_RE.test(id)) {
    ({ data: lead } = await db.from('quiz_leads').select('id, name, answers').eq('id', id).maybeSingle());
  } else if (params.get('s')) {
    lead = await leadDaSessao(db, params.get('s'));
  }
  if (!lead) return json({ error: 'not_found' }, 404);
  const a = lead.answers || {};
  return json({
    l: lead.id,
    nome: firstName(lead.name),
    resumo: planSummary(a),
    plano: starterFor(a),
    desafio: a.desafio === 'sim' || Number(a.dias) === 7,
    minutos: Number(a.minutos) || 60,
  });
}
