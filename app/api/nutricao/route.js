// Dados do plano alimentar para a página /alimentacao (conta logada, token do Supabase).
// Devolve se o plano alimentar está liberado (linha 'plano_alimentar' ativa na tabela assinaturas) e as
// respostas do quiz feitas com o e-mail da conta (sexo, idade, objetivo, dias), com altura e peso mais
// recentes do perfil. O cálculo e o cardápio são feitos na página (lib/nutricao.js).
// Sem compra, devolve a oferta (valor) para a página mostrar o botão de compra.
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, PLANO_ALIMENTAR, precoPlanoAlimentar } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req) {
  const db = supabaseAdmin();
  if (!db) return json({ error: 'not_configured' }, 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await anon.auth.getUser(token);
  const user = auth?.user;
  const email = String(user?.email || '').toLowerCase();
  if (!user || !email) return json({ error: 'unauthorized' }, 401);

  const { data: compra, error } = await db
    .from('assinaturas')
    .select('id')
    .eq('email', email)
    .eq('plano', PLANO_ALIMENTAR)
    .eq('status', 'active')
    .limit(1);
  if (error) return json({ error: 'db_error' }, 502);
  if (!(compra || []).length) return json({ liberado: false, oferta: { preco: await precoPlanoAlimentar() } });

  const [{ data: lead }, { data: perfil }] = await Promise.all([
    db.from('quiz_leads').select('answers').eq('email', email).maybeSingle(),
    db.from('profiles').select('height_cm, weight_kg').eq('id', user.id).maybeSingle(),
  ]);
  const a = lead?.answers || {};
  return json({
    liberado: true,
    dados: {
      sexo: a.sexo || null,
      idade: a.idade || null,
      objetivo: a.objetivo || null,
      dias: a.dias || null,
      altura: perfil?.height_cm || a.altura || null,
      peso: perfil?.weight_kg || a.peso || null,
    },
  });
}
