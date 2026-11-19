// Lista de recuperação para a página /admin/recuperacao: quem deixou o Pix expirar ou abandonou o
// pagamento nos últimos dias, com telefone e link pronto de WhatsApp.
// Só para administradores: conta logada no app (token do Supabase) com e-mail em ADMIN_EMAILS
// (variável na Vercel, e-mails separados por vírgula).
import { createClient } from '@supabase/supabase-js';
import { stripe, APP_URL } from '@/lib/stripe';
import { sessoesRecentes } from '@/lib/recuperacaoServer';
import { listaRecuperacao } from '@/lib/recuperacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req) {
  const admins = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!stripe || !admins.length) return json({ error: 'not_configured' }, 503);

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase.auth.getUser(token);
  const email = String(data?.user?.email || '').toLowerCase();
  if (!email) return json({ error: 'unauthorized' }, 401);
  if (!admins.includes(email)) return json({ error: 'forbidden' }, 403);

  const dias = Math.min(Math.max(Number(new URL(req.url).searchParams.get('dias')) || 7, 1), 30);
  try {
    const sessoes = await sessoesRecentes(dias, 1000);
    return json({ dias, linhas: listaRecuperacao(sessoes, { appUrl: APP_URL }) });
  } catch (e) {
    console.error('Admin recuperação:', e.message);
    return json({ error: 'stripe_error' }, 502);
  }
}
