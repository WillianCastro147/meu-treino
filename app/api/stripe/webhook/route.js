// Avisos da Stripe: mantém a tabela assinaturas (migração 006) igual à assinatura na Stripe.
// Eventos (cadastre na Stripe): checkout.session.completed, checkout.session.async_payment_succeeded (Pix),
// checkout.session.async_payment_failed (Pix expirou) e checkout.session.expired (pagamento abandonado):
// estes dois mandam o e-mail de recuperação (lib/recuperacaoServer.js),
// customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
import { stripe, supabaseAdmin, nomeDaCompra, APP_URL, PLANO_VITALICIO, PLANO_ALIMENTAR, PLANO_ALIMENTAR_PRICE } from '@/lib/stripe';
import { sendWelcomeEmail, sendPlanoAlimentarEmail } from '@/lib/email';
import { enviarRecuperacao } from '@/lib/recuperacaoServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const iso = (s) => (s ? new Date(s * 1000).toISOString() : null);

async function customerEmail(customer) {
  if (!customer) return null;
  if (typeof customer === 'object' && customer.email) return customer.email;
  const c = await stripe.customers.retrieve(typeof customer === 'string' ? customer : customer.id);
  return c && !c.deleted ? c.email : null;
}

async function saveSubscription(db, sub, email) {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  const row = {
    status: sub.status,
    plano: price?.recurring ? `${price.recurring.interval_count} ${price.recurring.interval}` : null,
    stripe_price_id: price?.id || null,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
    stripe_subscription_id: sub.id,
    // nas versões novas da API o fim do período fica no item da assinatura
    current_period_end: iso(sub.current_period_end ?? item?.current_period_end),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };
  const mail = (email || (await customerEmail(sub.customer)) || '').trim().toLowerCase();
  if (mail) {
    const { error } = await db.from('assinaturas').upsert({ ...row, email: mail }, { onConflict: 'stripe_subscription_id' });
    if (error) throw error;
  } else {
    // sem e-mail (cliente apagado na Stripe): só atualiza a linha que já existe
    const { error } = await db.from('assinaturas').update(row).eq('stripe_subscription_id', sub.id);
    if (error) throw error;
  }
}

// Compra avulsa (pagamento único): uma linha 'active' com o plano ('vitalicio' ou 'plano_alimentar'),
// sem assinatura. Só grava com o pagamento confirmado: no cartão já no checkout.session.completed; no Pix,
// que é assíncrono, no checkout.session.async_payment_succeeded. Avisos repetidos não duplicam a linha.
async function saveCompraAvulsa(db, session, plano) {
  const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (!email) throw new Error(`sessão ${session.id} sem e-mail`);
  const row = {
    status: 'active',
    plano,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
    current_period_end: null,
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };
  const { data: existente, error: readError } = await db
    .from('assinaturas')
    .select('id')
    .eq('email', email)
    .eq('plano', plano)
    .maybeSingle();
  if (readError) throw readError;
  const { error } = existente
    ? await db.from('assinaturas').update(row).eq('id', existente.id)
    : await db.from('assinaturas').insert({ ...row, email });
  if (error) throw error;
  return email;
}

// Pagamento único confirmado. Sessão de plano_alimentar sozinho (oferta depois da compra ou dentro do app)
// libera só o plano alimentar. Sessão do vitalício libera o app e, se a pessoa marcou o order bump,
// também o plano alimentar.
async function liberarPagamentoUnico(db, session) {
  if (session.metadata?.plano === PLANO_ALIMENTAR) {
    const email = await saveCompraAvulsa(db, session, PLANO_ALIMENTAR);
    const name = await nomeDaCompra(session, db);
    await sendPlanoAlimentarEmail({ email, name, appUrl: APP_URL, idempotencyKey: `alimentar-${session.id}` }).catch((e) =>
      console.error('E-mail do plano alimentar:', e.message)
    );
    return;
  }
  const email = await saveCompraAvulsa(db, session, PLANO_VITALICIO);
  if (PLANO_ALIMENTAR_PRICE) {
    const itens = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    if (itens.data.some((i) => i.price?.id === PLANO_ALIMENTAR_PRICE)) await saveCompraAvulsa(db, session, PLANO_ALIMENTAR);
  }
  await welcome(db, session, email);
}

async function welcome(db, session, email) {
  // E-mail de boas-vindas com o link do app (uma vez por compra; falha no e-mail não refaz o aviso)
  const name = await nomeDaCompra(session, db);
  await sendWelcomeEmail({ email, name, appUrl: APP_URL, idempotencyKey: `welcome-${session.id}` }).catch((e) =>
    console.error('E-mail de boas-vindas:', e.message)
  );
}

export async function POST(req) {
  const db = supabaseAdmin();
  if (!stripe || !db || !process.env.STRIPE_WEBHOOK_SECRET) return new Response('not_configured', { status: 503 });

  // A assinatura do aviso é conferida com o corpo cru, antes de qualquer leitura
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') || '', process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Stripe webhook: assinatura inválida', e.message);
    return new Response('invalid_signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
          const email = session.customer_details?.email || session.customer_email;
          await saveSubscription(db, sub, email);
          await welcome(db, session, email);
        } else if (session.mode === 'payment' && session.payment_status === 'paid') {
          // cartão: pago na hora. Pix chega aqui como 'unpaid' e é liberado no aviso abaixo.
          await liberarPagamentoUnico(db, session);
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.mode === 'payment') await liberarPagamentoUnico(db, session);
        break;
      }
      // Recuperação: Pix venceu sem pagamento / pagamento aberto e abandonado (sessão expirou em 24 h).
      // Falha no e-mail não refaz o aviso (só registra), para não reenviar em loop.
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        const sit = event.type === 'checkout.session.expired' ? 'abandonado' : 'pix_expirado';
        await enviarRecuperacao(db, session, sit)
          .then((r) => console.log('Recuperação', sit, session.id, JSON.stringify(r)))
          .catch((e) => console.error('Recuperação:', sit, session.id, e.message));
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await saveSubscription(db, event.data.object);
        break;
      default:
        break; // outros eventos: ignorados
    }
  } catch (e) {
    // 500 faz a Stripe tentar de novo mais tarde
    console.error('Stripe webhook:', event.type, e.message);
    return new Response('error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
}
