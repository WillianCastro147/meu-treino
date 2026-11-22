// O quiz avisa aqui que acabou de salvar um lead com WhatsApp (tela do e-mail).
//   POST /api/lead  { email }
// O app confere na tabela quiz_leads que esse lead foi salvo agora há pouco, ainda não foi usado e tem
// WhatsApp válido, e só então manda o evento "lead" ao LeonaFlow (lib/leona.js). Assim a rota, que é
// pública, não serve para disparar mensagem a números antigos ou aleatórios.
// Responde na hora (204): o envio sai depois, sem prender o quiz.
import { waitUntil } from '@vercel/functions';
import { supabaseAdmin, APP_URL } from '@/lib/stripe';
import { enviarLeadLeona, EVENTOS_LEONA } from '@/lib/leona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

async function avisar(email) {
  const db = supabaseAdmin();
  if (!db) return;
  const { data: lead, error } = await db
    .from('quiz_leads')
    .select('id, email, name, answers, created_at, updated_at, claimed_at')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  const r = await enviarLeadLeona(lead, { appUrl: APP_URL });
  if (!r?.skipped) console.log('LeonaFlow lead', lead.id, JSON.stringify(r));
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return new Response(null, { status: 400 });
  if (process.env[EVENTOS_LEONA.lead]) {
    waitUntil(avisar(email).catch((e) => console.error('LeonaFlow: lead', e.message)));
  }
  return new Response(null, { status: 204 });
}
