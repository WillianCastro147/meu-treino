// E-mails do webhook da Stripe, via Resend: boas-vindas depois da compra e (com sendEmail)
// a recuperação de Pix expirado / pagamento abandonado (texto em lib/recuperacao.js).
// Variáveis na Vercel: RESEND_API_KEY (obrigatória para enviar), EMAIL_FROM (padrão "Moviq <ola@moviqgym.app>"),
// EMAIL_REPLY_TO (opcional: para onde vão as respostas). Sem RESEND_API_KEY, nada é enviado.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// Monta assunto, HTML e texto. Função pura (testada em lib/email.test.mjs).
export function buildWelcomeEmail({ email, name, appUrl = 'https://www.moviqgym.app' }) {
  const app = appUrl.replace(/\/+$/, '');
  const host = app.replace(/^https?:\/\//, '');
  const signup = `${app}/login?${new URLSearchParams({ modo: 'cadastro', email: String(email || '').trim().toLowerCase(), ...(first(name) ? { name: first(name) } : {}) })}`;
  const install = `${app}/instalar`;
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
export async function sendWelcomeEmail({ email, name, appUrl, idempotencyKey }) {
  if (!process.env.RESEND_API_KEY || !email) return { skipped: true };
  return sendEmail({ email, idempotencyKey, ...buildWelcomeEmail({ email, name, appUrl }) });
}

// Envio genérico pelo Resend (boas-vindas, recuperação de Pix/pagamento)
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
