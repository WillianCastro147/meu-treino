// E-mails do webhook da Stripe, via Resend: boas-vindas depois da compra e (com sendEmail)
// a recuperação de Pix expirado / pagamento abandonado (texto em lib/recuperacao.js).
// Variáveis na Vercel: RESEND_API_KEY (obrigatória para enviar), EMAIL_FROM (padrão "Moviq <ola@moviqgym.app>"),
// EMAIL_REPLY_TO (opcional: para onde vão as respostas). Sem RESEND_API_KEY, nada é enviado.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// Boas-vindas em espanhol (quiz quiz.moviqgym.app/es: metadata.lang = 'es' na compra)
function buildWelcomeEmailEs({ email, name, app, host, install }) {
  const signup = `${app}/login?${new URLSearchParams({ modo: 'cadastro', lang: 'es', email: String(email || '').trim().toLowerCase(), ...(first(name) ? { name: first(name) } : {}) })}`;
  const hi = first(name) ? `¡Hola, ${esc(first(name))}!` : '¡Hola!';
  const subject = 'Tu acceso a Moviq está listo';
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moviq</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0e0f13;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:800">Moviq</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:20px;font-weight:800">${hi}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">Tu pago fue confirmado y tu plan de entrenamiento armado a partir del quiz te está esperando.</p>
<p style="margin:0 0 22px;font-size:16px;line-height:1.5">Crea tu cuenta con <b>este mismo correo</b> (${esc(email)}) para que el plan aparezca listo:</p>
<p style="margin:0 0 24px;text-align:center"><a href="${esc(signup)}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:800;font-size:17px;padding:14px 28px;border-radius:999px">Entrar a Moviq</a></p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">Guarda la dirección de la app: <a href="${esc(app)}/?lang=es" style="color:#2563eb;font-weight:700">${esc(host)}</a></p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
<p style="margin:0 0 10px;font-size:16px;font-weight:800">Pon Moviq en la pantalla de inicio del celular</p>
<p style="margin:0 0 6px;font-size:15px;line-height:1.5"><b>iPhone (Safari):</b> toca Compartir y luego "Agregar a inicio".</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><b>Android (Chrome):</b> toca el menú ⋮ y luego "Instalar app" o "Agregar a la pantalla principal".</p>
<p style="margin:0 0 6px;font-size:15px"><a href="${esc(install)}?lang=es" style="color:#2563eb">Ver el paso a paso</a></p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">Tu suscripción se renueva cada mes y puedes cancelarla cuando quieras. ¿Dudas? Solo responde este correo.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const text = [
    hi,
    '',
    'Tu pago fue confirmado y tu plan de entrenamiento te está esperando.',
    `Crea tu cuenta con este mismo correo (${email}) para que el plan aparezca listo:`,
    signup,
    '',
    `Guarda la dirección de la app: ${host}`,
    '',
    'Pon Moviq en la pantalla de inicio del celular:',
    '- iPhone (Safari): Compartir > "Agregar a inicio".',
    '- Android (Chrome): menú ⋮ > "Instalar app" o "Agregar a la pantalla principal".',
    `Paso a paso: ${install}?lang=es`,
    '',
    'Tu suscripción se renueva cada mes y puedes cancelarla cuando quieras. ¿Dudas? Solo responde este correo.',
  ].join('\n');
  return { subject, html, text };
}

// Monta assunto, HTML e texto. Função pura (testada em lib/email.test.mjs).
// lang: 'es' (quiz em espanhol) ou português (padrão).
export function buildWelcomeEmail({ email, name, appUrl = 'https://www.moviqgym.app', lang }) {
  const app = appUrl.replace(/\/+$/, '');
  const host = app.replace(/^https?:\/\//, '');
  const install = `${app}/instalar`;
  if (lang === 'es') return buildWelcomeEmailEs({ email, name, app, host, install });
  const signup = `${app}/login?${new URLSearchParams({ modo: 'cadastro', email: String(email || '').trim().toLowerCase(), ...(first(name) ? { name: first(name) } : {}) })}`;
  const hi = first(name) ? `Olá, ${esc(first(name))}!` : 'Olá!';

  const subject = 'Seu acesso ao Moviq está liberado';

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moviq</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0e0f13;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:800">Moviq</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:20px;font-weight:800">${hi}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">Seu pagamento foi confirmado e o seu plano de treino montado a partir do quiz está esperando por você.</p>
<p style="margin:0 0 22px;font-size:16px;line-height:1.5">Crie sua conta com <b>este mesmo e-mail</b> (${esc(email)}) para o plano aparecer pronto:</p>
<p style="margin:0 0 24px;text-align:center"><a href="${esc(signup)}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:800;font-size:17px;padding:14px 28px;border-radius:999px">Acessar o Moviq</a></p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">Guarde o endereço do app: <a href="${esc(app)}" style="color:#2563eb;font-weight:700">${esc(host)}</a></p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
<p style="margin:0 0 10px;font-size:16px;font-weight:800">Deixe o Moviq na tela inicial do celular</p>
<p style="margin:0 0 6px;font-size:15px;line-height:1.5"><b>iPhone (Safari):</b> toque em Compartilhar e depois em "Adicionar à Tela de Início".</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><b>Android (Chrome):</b> toque no menu ⋮ e depois em "Instalar app" ou "Adicionar à tela inicial".</p>
<p style="margin:0 0 6px;font-size:15px"><a href="${esc(install)}" style="color:#2563eb">Ver o passo a passo</a></p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">Dúvidas? É só responder este e-mail.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    hi,
    '',
    'Seu pagamento foi confirmado e o seu plano de treino está esperando por você.',
    `Crie sua conta com este mesmo e-mail (${email}) para o plano aparecer pronto:`,
    signup,
    '',
    `Guarde o endereço do app: ${host}`,
    '',
    'Deixe o Moviq na tela inicial do celular:',
    '- iPhone (Safari): Compartilhar > "Adicionar à Tela de Início".',
    '- Android (Chrome): menu ⋮ > "Instalar app" ou "Adicionar à tela inicial".',
    `Passo a passo: ${install}`,
    '',
    'Dúvidas? É só responder este e-mail.',
  ].join('\n');

  return { subject, html, text };
}

// Envia pelo Resend. idempotencyKey evita e-mail repetido quando a Stripe reenvia o mesmo aviso.
export async function sendWelcomeEmail({ email, name, appUrl, idempotencyKey, lang }) {
  if (!process.env.RESEND_API_KEY || !email) return { skipped: true };
  return sendEmail({ email, idempotencyKey, ...buildWelcomeEmail({ email, name, appUrl, lang }) });
}

// Extra comprado à parte (oferta depois da compra ou dentro do app): plano alimentar, gerador de treino com IA
// ou guia de treino (ebook).
// extra: { plano, nome, link } (lib/stripe.js EXTRAS)
const TEXTO_EXTRA = {
  plano_alimentar: {
    subject: 'Seu plano alimentar do Moviq está liberado',
    corpo: 'Pagamento confirmado. Seu plano alimentar já está no app, com as calorias e as refeições calculadas a partir das suas respostas do quiz.',
    botao: 'Ver meu plano alimentar',
  },
  gerador_ia: {
    subject: 'Seu gerador de treino com IA está liberado',
    corpo: 'Pagamento confirmado. Agora você pode criar treinos novos com a IA do Moviq sempre que quiser variar ou mudar de objetivo.',
    botao: 'Criar um treino com IA',
  },
  guia_feminino: {
    subject: 'Seu Guia de Treino Feminino chegou',
    corpo: 'Pagamento confirmado. Seu Guia de Treino Feminino (ebook de 95 páginas, com +83 exercícios ilustrados passo a passo) já está liberado: entre no app e toque em "Baixar o guia" para salvar o PDF no celular.',
    botao: 'Baixar meu guia',
  },
};

export function buildExtraEmail({ name, extra, appUrl = 'https://www.moviqgym.app' }) {
  const app = appUrl.replace(/\/+$/, '');
  const link = `${app}${extra?.link || '/inicio'}`;
  const t = TEXTO_EXTRA[extra?.plano] || { subject: `${extra?.nome || 'Sua compra'} liberado no Moviq`, corpo: 'Pagamento confirmado. Já está liberado no app.', botao: 'Abrir o Moviq' };
  const hi = first(name) ? `Olá, ${esc(first(name))}!` : 'Olá!';
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moviq</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0e0f13;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:800">Moviq</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:20px;font-weight:800">${hi}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${esc(t.corpo)}</p>
<p style="margin:0 0 24px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:800;font-size:17px;padding:14px 28px;border-radius:999px">${esc(t.botao)}</a></p>
<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">Se ainda não criou sua conta, use o mesmo e-mail da compra. Dúvidas? É só responder este e-mail.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  const text = [hi, '', t.corpo, link, '', 'Se ainda não criou sua conta, use o mesmo e-mail da compra.'].join('\n');
  return { subject: t.subject, html, text };
}

export async function sendExtraEmail({ email, name, extra, appUrl, idempotencyKey }) {
  if (!process.env.RESEND_API_KEY || !email) return { skipped: true };
  return sendEmail({ email, idempotencyKey, ...buildExtraEmail({ name, extra, appUrl }) });
}

// Envio genérico pelo Resend (boas-vindas, recuperação de Pix/pagamento, extras)
export async function sendEmail({ email, subject, html, text, idempotencyKey }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !email) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Moviq <ola@moviqgym.app>',
      to: [email],
      subject,
      html,
      text,
      ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { sent: true };
}
