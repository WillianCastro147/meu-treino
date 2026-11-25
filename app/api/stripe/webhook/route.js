// Avisos da Stripe: mantém a tabela assinaturas (migração 006) igual à assinatura na Stripe.
// Eventos (cadastre na Stripe): checkout.session.completed, checkout.session.async_payment_succeeded (Pix),
// checkout.session.async_payment_failed (Pix expirou) e checkout.session.expired (pagamento abandonado):
// estes dois disparam a recuperação pelo WhatsApp/LeonaFlow (lib/recuperacaoServer.js; o e-mail de
// recuperação está desligado, só com RECUPERACAO_EMAIL=on),
// customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
// charge.refunded (reembolso tira o acesso), charge.dispute.created e charge.dispute.closed (contestação).
import { stripe, supabaseAdmin, nomeDaCompra, APP_URL, PLANO_VITALICIO, PLANO_PREMIUM, extrasAtivos, extraDoPlano, precoDoItem } from '@/lib/stripe';
import { planosDaCompra, planosDoReembolso, PLANOS_DO_PREMIUM } from '@/lib/reembolso';
import { sendWelcomeEmail, sendExtraEmail } from '@/lib/email';
import { enviarRecuperacao } from '@/lib/recuperacaoServer';
import { enviarCompraMeta } from '@/lib/metaCapi';
import { enviarLeona } from '@/lib/leona';

export const runtime = 'nodejs';

// WhatsApp pelo LeonaFlow (lib/leona.js): Pix gerado e compra confirmada. Pix expirado e pagamento
// abandonado saem junto com o e-mail de recuperação (lib/recuperacaoServer.js). Falha só é registrada.
async function avisarLeona(evento, session) {
  try {
    const r = await enviarLeona(evento, session, { appUrl: APP_URL });
    if (!r?.skipped) console.log('LeonaFlow', evento, session.id, JSON.stringify(r));
  } catch (e) {
    console.error('LeonaFlow:', evento, session.id, e.message);
  }
}
export const dynamic = 'force-dynamic';

// Compra na Meta (API de Conversões) com os dados do clique no anúncio. Só envia com META_CAPI_TOKEN na Vercel.
// Falha aqui só é registrada: nunca impede liberar o acesso nem faz a Stripe repetir o aviso.
async function compraNaMeta(session) {
  try {
    const r = await enviarCompraMeta(session);
    if (!r?.skipped) console.log('Meta Purchase', session.id, JSON.stringify(r));
  } catch (e) {
    console.error('Meta Purchase:', session.id, e.message);
  }
}

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

// Compra avulsa (pagamento único): uma linha 'active' com o plano ('vitalicio', 'plano_alimentar', 'gerador_ia'),
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

// Pagamento único confirmado. Sessão de um extra sozinho (oferta depois da compra ou dentro do app)
// libera só aquele extra. Premium libera o app e os dois extras. Sessão do vitalício libera o app e os
// extras marcados como order bump.
async function liberarPagamentoUnico(db, session) {
  const avulso = extraDoPlano(session.metadata?.plano);
  if (avulso) {
    const email = await saveCompraAvulsa(db, session, avulso.plano);
    const name = await nomeDaCompra(session, db);
    await sendExtraEmail({ email, name, extra: avulso, appUrl: APP_URL, idempotencyKey: `${avulso.plano}-${session.id}` }).catch((e) =>
      console.error('E-mail do extra:', avulso.plano, e.message)
    );
    return;
  }
  // Premium (pop-up do quiz): app + plano alimentar + gerador de treino com IA
  if (session.metadata?.plano === PLANO_PREMIUM) {
    let email = null;
    for (const plano of PLANOS_DO_PREMIUM) email = await saveCompraAvulsa(db, session, plano);
    await welcome(db, session, email);
    return;
  }
  const email = await saveCompraAvulsa(db, session, PLANO_VITALICIO);
  if (extrasAtivos().length) {
    const itens = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    const precos = new Set(await Promise.all(itens.data.map(precoDoItem)));
    for (const e of extrasAtivos()) if (precos.has(e.price)) await saveCompraAvulsa(db, session, e.plano);
  }
  await welcome(db, session, email);
}

// Reembolso e contestação: acha a compra (Checkout Session) pelo pagamento e muda o status das linhas que ela
// liberou. 'reembolsado' e 'contestado' não dão acesso (tem_acesso e temExtra só aceitam linhas ativas).
async function compraDoPagamento(paymentIntent) {
  const pi = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
  if (!pi) return null;
  const { data } = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
  const session = data[0];
  if (!session || session.mode !== 'payment') return null; // assinatura: os avisos customer.subscription.* cuidam
  const email = String(session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
  if (!email) return null;
  const itens = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  return {
    session,
    email,
    plano: session.metadata?.plano,
    itens: await Promise.all(itens.data.map(async (i) => ({ price: await precoDoItem(i), amount_total: i.amount_total }))),
    extras: extrasAtivos().map((e) => ({ plano: e.plano, price: e.price })),
  };
}

async function mudarStatus(db, email, planos, status, deStatus = 'active') {
  if (!planos.length) return;
  const { error } = await db.from('assinaturas').update({ status, updated_at: new Date().toISOString() }).eq('email', email).in('plano', planos).eq('status', deStatus);
  if (error) throw error;
}

async function welcome(db, session, email) {
  // E-mail de boas-vindas com o link do app (uma vez por compra; falha no e-mail não refaz o aviso)
  const name = await nomeDaCompra(session, db);
  await sendWelcomeEmail({ email, name, appUrl: APP_URL, lang: session.metadata?.lang, idempotencyKey: `welcome-${session.id}` }).catch((e) =>
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
          await compraNaMeta(session);
        } else if (session.mode === 'payment' && session.payment_status === 'paid') {
          // cartão: pago na hora. Pix chega aqui como 'unpaid' e é liberado no aviso abaixo.
          await liberarPagamentoUnico(db, session);
          await compraNaMeta(session);
          await avisarLeona('comprou', session);
        } else if (session.mode === 'payment' && session.payment_status === 'unpaid') {
          // Pix gerado, ainda não pago: o fluxo do LeonaFlow espera uns minutos e lembra
          await avisarLeona('pix_gerado', session);
        }
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.mode === 'payment') {
          await liberarPagamentoUnico(db, session);
          await compraNaMeta(session);
          await avisarLeona('comprou', session);
        }
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
      // Reembolso (garantia de 7 dias): total tira tudo o que a compra liberou; parcial, só o bump do mesmo valor
      case 'charge.refunded': {
        const charge = event.data.object;
        const compra = await compraDoPagamento(charge.payment_intent);
        if (!compra) break;
        const planos = planosDoReembolso({ ...compra, total: charge.amount, reembolsado: charge.amount_refunded });
        await mudarStatus(db, compra.email, planos, 'reembolsado');
        console.log('Reembolso', compra.session.id, charge.amount_refunded, '/', charge.amount, planos.length ? `tirou ${planos.join(', ')}` : 'parcial: conferir à mão');
        break;
      }
      // Contestação (chargeback): tira o acesso na abertura; se a disputa for ganha, devolve
      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const disputa = event.data.object;
        const compra = await compraDoPagamento(disputa.payment_intent);
        if (!compra) break;
        const planos = planosDaCompra(compra);
        if (event.type === 'charge.dispute.created') await mudarStatus(db, compra.email, planos, 'contestado');
        else if (disputa.status === 'won') await mudarStatus(db, compra.email, planos, 'active', 'contestado');
        console.log('Contestação', compra.session.id, event.type === 'charge.dispute.created' ? 'aberta' : disputa.status, planos.join(', '));
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
