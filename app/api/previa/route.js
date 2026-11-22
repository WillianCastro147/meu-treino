// Dados da prévia do app (/previa?l=<id do lead>): nome, resumo do plano e qual plano pronto mostrar.
//   GET /api/previa?l=<id do lead em quiz_leads>
// Sem login: o id do lead (uuid) só chega pela mensagem de WhatsApp da pessoa. Devolve só o necessário
// para a tela (nada de e-mail, telefone ou respostas cruas).
import { supabaseAdmin } from '@/lib/stripe';
import { planSummary, starterFor, firstName } from '@/lib/quiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// /previa?l=demo: exemplo fixo, para ver a página sem dados de nenhum lead
const DEMO = {
  sexo: 'm', objetivo: 'massa', experiencia: '6m-2a', recente: '3-4', dias: 4, minutos: 60,
  foco: ['peito', 'bracos'], limites: ['nenhuma'], desafio: 'sim', local: 'academia',
};

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('l') || '';
  if (id === 'demo') {
    return json({ nome: 'Carlos', resumo: planSummary(DEMO), plano: starterFor(DEMO), desafio: true, minutos: 60 });
  }
  const db = supabaseAdmin();
  if (!db || !UUID_RE.test(id)) return json({ error: 'not_found' }, 404);
  const { data: lead } = await db.from('quiz_leads').select('name, answers').eq('id', id).maybeSingle();
  if (!lead) return json({ error: 'not_found' }, 404);
  const a = lead.answers || {};
  return json({
    nome: firstName(lead.name),
    resumo: planSummary(a),
    plano: starterFor(a),
    desafio: a.desafio === 'sim' || Number(a.dias) === 7,
    minutos: Number(a.minutos) || 60,
  });
}
