// Link pessoal da mensagem de WhatsApp para quem deixou o lead e não abriu o pagamento:
//   /api/stripe/pagar?l=<id do lead em quiz_leads>
// Cria a página de pagamento do acesso vitalício com o nome, e-mail, WhatsApp e UTMs do quiz (a Utmify
// continua atribuindo a venda ao anúncio de origem) e leva a pessoa direto para ela. Se o e-mail já tem
// acesso, vai para o app. Abre no navegador do WhatsApp, que não tem as respostas do quiz salvas: por isso
// o link não volta para o quiz.
import { waitUntil } from '@vercel/functions';
import { stripe, supabaseAdmin, APP_URL, QUIZ_URL, PLANO_VITALICIO } from '@/lib/stripe';
import { criarSessaoCheckout } from '@/lib/checkout';
import { dadosDoNavegador } from '@/lib/metaCapi';
import { enviarLeona } from '@/lib/leona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('l') || '';
  const db = supabaseAdmin();
  if (!stripe || !db || !UUID_RE.test(id)) return Response.redirect(QUIZ_URL, 303);

  const { data: lead } = await db.from('quiz_leads').select('id, email, name, answers, utm').eq('id', id).maybeSingle();
  if (!lead?.email) return Response.redirect(QUIZ_URL, 303);

  // Já tem acesso: vai para o app em vez de cobrar de novo
  const { data: acesso } = await db
    .from('assinaturas')
    .select('id')
    .eq('email', lead.email)
    .in('status', ['active', 'trialing', 'past_due', 'cortesia'])
    .limit(1);
  if ((acesso || []).length) return Response.redirect(`${APP_URL}/login?${new URLSearchParams({ email: lead.email })}`, 303);

  let session;
  try {
    session = await criarSessaoCheckout({
      plano: PLANO_VITALICIO,
      email: lead.email,
      nome: lead.name || '',
      whatsapp: lead.answers?.whatsapp,
      tracking: lead.utm || {},
      extra: { recuperacao: 'whatsapp_lead', ...dadosDoNavegador({ headers: req.headers }) },
    });
  } catch (e) {
    console.error('Pagar (lead): checkout falhou', e.type, e.code, e.message);
    return Response.redirect(QUIZ_URL, 303);
  }

  // Abriu o pagamento pelo link: o fluxo de "pagamento aberto" substitui o do lead
  waitUntil(
    enviarLeona('checkout_aberto', session, { appUrl: APP_URL })
      .then((r) => !r?.skipped && console.log('LeonaFlow checkout_aberto', session.id, JSON.stringify(r)))
      .catch((e) => console.error('LeonaFlow: checkout_aberto', session.id, e.message))
  );
  return Response.redirect(session.url, 303);
}
