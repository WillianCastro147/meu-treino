// Parte de servidor da recuperação (Stripe + Supabase + Resend). Só rotas de API.
import { stripe, APP_URL, VITALICIO_CENTAVOS } from '@/lib/stripe';
import { sendEmail } from '@/lib/email';
import { enviarLeona } from '@/lib/leona';
import { buildRecoveryEmail, deveRecuperar, emailDaSessao, linkRecuperacao, valorBRL, recuperacaoPorEmail } from '@/lib/recuperacao';

// Checkout Sessions criadas nos últimos `dias`, com o pagamento expandido (para saber se o Pix venceu)
export async function sessoesRecentes(dias = 3, max = 500) {
  const gte = Math.floor(Date.now() / 1000) - dias * 86400;
  const out = [];
  for await (const s of stripe.checkout.sessions.list({ created: { gte }, limit: 100, expand: ['data.payment_intent'] })) {
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// Alguém com esse e-mail já tem acesso liberado (vitalício, assinatura ativa ou cortesia)?
async function jaTemAcesso(db, email) {
  if (!db || !email) return false;
  const { data, error } = await db
    .from('assinaturas')
    .select('id')
    .eq('email', email)
    .in('status', ['active', 'trialing', 'past_due', 'cortesia'])
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

// Chamado pelo webhook: Pix expirou (checkout.session.async_payment_failed) ou o pagamento
// foi abandonado (checkout.session.expired). Avisa o LeonaFlow (WhatsApp) e, se RECUPERACAO_EMAIL=on,
// manda um e-mail com link para um checkout novo.
export async function enviarRecuperacao(db, session, sit) {
  const email = emailDaSessao(session);
  if (!email) return { skipped: 'sem_email' };
  // E-mail de recuperação só existe em português (valor em reais): quiz em outro idioma fica de fora
  if (session.metadata?.lang && session.metadata.lang !== 'pt') return { skipped: 'idioma' };
  if (await jaTemAcesso(db, email)) return { skipped: 'ja_tem_acesso' };
  // Só a tentativa mais recente da pessoa gera e-mail, e nunca para quem pagou em outra tentativa
  const recentes = await sessoesRecentes(3);
  if (!deveRecuperar(session, recentes)) return { skipped: 'nao_e_a_mais_recente_ou_ja_pagou' };

  // WhatsApp pelo LeonaFlow (quem deixou o número no quiz), com as mesmas regras do e-mail.
  // Falha aqui só é registrada: o e-mail (se ligado) sai do mesmo jeito.
  await enviarLeona(sit === 'pix_expirado' ? 'pix_expirado' : 'abandonou', session, { appUrl: APP_URL })
    .then((r) => console.log('LeonaFlow', sit, session.id, JSON.stringify(r)))
    .catch((e) => console.error('LeonaFlow:', sit, session.id, e.message));

  // E-mail de recuperação desligado (ver lib/recuperacao.js): o WhatsApp acima já saiu
  if (!recuperacaoPorEmail()) return { skipped: 'email_desligado' };

  const { subject, html, text } = buildRecoveryEmail({
    email,
    nome: session.metadata?.nome || session.customer_details?.name || '',
    situacao: sit,
    // Premium abandonado volta pelo vitalício (/api/stripe/recuperar): o e-mail mostra o valor do link novo
    valor: valorBRL(session.metadata?.plano === 'premium' ? VITALICIO_CENTAVOS : session.amount_total),
    link: linkRecuperacao(APP_URL, session.id, 'email'),
  });
  // Um e-mail por sessão perdida (a Stripe pode reenviar o mesmo aviso)
  return sendEmail({ email, subject, html, text, idempotencyKey: `recuperacao-${session.id}` });
}
