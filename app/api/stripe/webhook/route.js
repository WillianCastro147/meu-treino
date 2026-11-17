// Avisos da Stripe: mantém a tabela assinaturas (migração 006) igual à assinatura na Stripe.
// Eventos (cadastre na Stripe): checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted.
import { stripe, supabaseAdmin, nomeDaCompra, APP_URL } from '@/lib/stripe';
import { sendWelcomeEmail } from '@/lib/email';

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
          // E-mail de boas-vindas com o link do app (uma vez por compra; falha no e-mail não refaz o aviso)
          const name = await nomeDaCompra(session, db);
          await sendWelcomeEmail({ email, name, appUrl: APP_URL, idempotencyKey: `welcome-${session.id}` }).catch((e) =>
            console.error('E-mail de boas-vindas:', e.message)
          );
        }
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
