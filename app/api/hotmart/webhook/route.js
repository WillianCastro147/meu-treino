// Avisos da Hotmart (webhook versão 2.0.0): mantém a tabela assinaturas (migrações 006 e 007) igual às compras
// na Hotmart. Faz pela Hotmart o mesmo que /api/stripe/webhook faz pela Stripe: libera o acesso pelo e-mail
// da compra e manda o e-mail de boas-vindas.
// Eventos (cadastre na Hotmart): Compra aprovada, Compra completa, Compra reembolsada, Chargeback,
// Compra cancelada e Cancelamento de assinatura. Os outros são ignorados.
import { supabaseAdmin, nomeDaCompra, APP_URL, EXTRAS } from '@/lib/stripe';
import { sendWelcomeEmail, sendExtraEmail } from '@/lib/email';
import { lerAviso, hottokValido } from '@/lib/hotmart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRODUTOS_DO_APP = ['vitalicio', 'assinatura']; // liberam o app (os outros são extras)

// Compra aprovada: uma linha 'active' por e-mail + plano (avisos repetidos não duplicam a linha)
async function liberar(db, a) {
  if (!a.email) throw new Error(`compra ${a.transacao} sem e-mail`);
  const row = {
    status: 'active',
    plano: a.plano,
    gateway: 'hotmart',
    hotmart_transacao: a.transacao,
    hotmart_assinante: a.assinante,
    // assinatura: vale até a próxima cobrança (renovação aprovada empurra a data); compra única não vence
    current_period_end: a.plano === 'assinatura' ? a.fimDoPeriodo : null,
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };
  const { data: existente, error: readError } = await db
    .from('assinaturas')
    .select('id')
    .eq('email', a.email)
    .eq('plano', a.plano)
    .maybeSingle();
  if (readError) throw readError;
  const { error } = existente
    ? await db.from('assinaturas').update(row).eq('id', existente.id)
    : await db.from('assinaturas').insert({ ...row, email: a.email });
  if (error) throw error;
}

// E-mail só na primeira aprovação (não na renovação nem na "compra completa", que chega dias depois).
// Order bump não manda e-mail próprio: o de boas-vindas da compra principal já leva ao app.
async function avisarComprador(db, a) {
  if (a.evento !== 'PURCHASE_APPROVED' || a.renovacao || a.orderBump) return;
  const name = await nomeDaCompra({ metadata: {}, customer_email: a.email, customer_details: { name: a.nome } }, db);
  const enviar = PRODUTOS_DO_APP.includes(a.plano)
    ? sendWelcomeEmail({ email: a.email, name, appUrl: APP_URL, idempotencyKey: `welcome-hotmart-${a.transacao}` })
    : sendExtraEmail({
        email: a.email,
        name,
        extra: EXTRAS.find((e) => e.plano === a.plano),
        appUrl: APP_URL,
        idempotencyKey: `${a.plano}-hotmart-${a.transacao}`,
      });
  // falha no e-mail não refaz o aviso (só registra), para não reenviar em loop
  await enviar.catch((e) => console.error('Hotmart e-mail:', a.plano, e.message));
}

// Reembolso, chargeback ou compra cancelada: só a linha daquela compra perde o acesso
async function cortar(db, a) {
  if (!a.transacao) return;
  const { data, error } = await db
    .from('assinaturas')
    .update({ status: a.status, updated_at: new Date().toISOString() })
    .eq('hotmart_transacao', a.transacao)
    .select('id');
  if (error) throw error;
  if (!data?.length) console.log('Hotmart:', a.evento, a.transacao, 'sem linha (compra nunca aprovada)');
}

// Assinatura cancelada: continua valendo até a data da próxima cobrança (tem_acesso, migração 007)
async function cancelarAssinatura(db, a) {
  if (!a.email && !a.assinante) return;
  let q = db
    .from('assinaturas')
    .update({ status: 'canceled', cancel_at_period_end: true, current_period_end: a.fimDoPeriodo, updated_at: new Date().toISOString() })
    .eq('gateway', 'hotmart');
  q = a.assinante ? q.eq('hotmart_assinante', a.assinante) : q.eq('email', a.email).eq('plano', 'assinatura');
  const { error } = await q;
  if (error) throw error;
}

export async function POST(req) {
  const db = supabaseAdmin();
  if (!db || !process.env.HOTMART_HOTTOK) return new Response('not_configured', { status: 503 });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response('bad_request', { status: 400 });
  }
  // A Hotmart manda o hottok no cabeçalho (versão 2.0.0) e, em contas antigas, também no corpo
  if (!hottokValido(req.headers.get('x-hotmart-hottok') || body?.hottok)) {
    console.error('Hotmart webhook: hottok inválido');
    return new Response('invalid_hottok', { status: 401 });
  }

  const a = lerAviso(body);
  if (!a) return new Response('ok', { status: 200 }); // evento que o app não usa
  if (!a.plano) {
    // produto sem variável HOTMART_PRODUTO_* na Vercel: registra e responde 200 para a Hotmart não repetir
    console.error('Hotmart webhook: produto sem plano configurado', a.produtoId, a.evento);
    return new Response('ok', { status: 200 });
  }

  try {
    if (a.acao === 'liberar') {
      await liberar(db, a);
      await avisarComprador(db, a);
    } else if (a.acao === 'cortar') {
      await cortar(db, a);
    } else if (a.acao === 'cancelar_assinatura') {
      await cancelarAssinatura(db, a);
    }
  } catch (e) {
    // 500 faz a Hotmart tentar de novo mais tarde
    console.error('Hotmart webhook:', a.evento, a.transacao || a.assinante, e.message);
    return new Response('error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
}
