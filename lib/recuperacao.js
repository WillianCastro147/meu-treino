// Recuperação de quem deixou o Pix expirar ou abandonou o pagamento.
// Funções puras (sem Stripe nem rede), testadas em lib/recuperacao.test.mjs.
// Quem usa: o webhook da Stripe (e-mail automático) e a página /admin/recuperacao (lista com WhatsApp).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';
export const emailDaSessao = (s) => String(s?.customer_details?.email || s?.customer_email || '').trim().toLowerCase();
export const valorBRL = (centavos) => 'R$ ' + (Number(centavos || 0) / 100).toFixed(2).replace('.', ',');

// Link que gera um checkout novo, com o mesmo plano, e-mail e UTMs da sessão perdida
export const linkRecuperacao = (appUrl, sessionId, canal) =>
  `${String(appUrl).replace(/\/+$/, '')}/api/stripe/recuperar?${new URLSearchParams({ s: sessionId, c: canal })}`;

// Situação de uma Checkout Session (com payment_intent expandido, quando houver):
//   pago         → já pagou (não recuperar)
//   pix_pendente → gerou o Pix e ainda pode pagar
//   pix_expirado → gerou o Pix e ele venceu sem pagamento
//   abandonado   → abriu o pagamento e a sessão expirou sem pagar
//   aberto       → pagamento aberto, ainda dentro do prazo (24 h)
export function situacao(s) {
  if (!s) return null;
  if (s.payment_status === 'paid' || s.payment_status === 'no_payment_required') return 'pago';
  if (s.status === 'expired') return 'abandonado';
  if (s.status === 'open') return 'aberto';
  if (s.status === 'complete') {
    const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent.status : null;
    if (pi === 'requires_action' || pi === 'processing') return 'pix_pendente';
    if (pi === 'succeeded') return 'pago';
    return 'pix_expirado';
  }
  return null;
}

// Deve mandar recuperação para esta sessão? Só se ela for a mais recente da pessoa e ninguém
// com esse e-mail tiver pago (evita mandar para quem tentou de novo e comprou).
export function deveRecuperar(sessao, recentes = []) {
  const email = emailDaSessao(sessao);
  if (!email) return false;
  const daPessoa = recentes.filter((s) => emailDaSessao(s) === email);
  if (daPessoa.some((s) => situacao(s) === 'pago')) return false;
  return !daPessoa.some((s) => s.id !== sessao.id && s.created > sessao.created);
}

// Lista para a página de recuperação: uma linha por pessoa (a sessão mais recente),
// sem quem pagou e sem quem ainda está com o Pix dentro do prazo.
// minAbertoSeg: só mostra pagamento "aberto" depois desse tempo parado (padrão 1 h).
export function listaRecuperacao(sessoes = [], { agora = Date.now() / 1000, minAbertoSeg = 3600, appUrl = 'https://www.moviqgym.app' } = {}) {
  const porEmail = new Map();
  for (const s of sessoes) {
    const email = emailDaSessao(s);
    if (!email) continue;
    if (!porEmail.has(email)) porEmail.set(email, []);
    porEmail.get(email).push(s);
  }
  const linhas = [];
  for (const [email, lista] of porEmail) {
    if (lista.some((s) => situacao(s) === 'pago')) continue;
    const s = lista.reduce((a, b) => (b.created > a.created ? b : a));
    const sit = situacao(s);
    if (!['pix_expirado', 'abandonado', 'aberto'].includes(sit)) continue;
    if (sit === 'aberto' && agora - s.created < minAbertoSeg) continue;
    const nome = s.metadata?.nome || s.customer_details?.name || '';
    const telefone = s.customer_details?.phone || s.metadata?.whatsapp || ''; // WhatsApp do quiz, se não houver o da Stripe
    const link = linkRecuperacao(appUrl, s.id, 'whatsapp');
    linhas.push({
      id: s.id,
      email,
      nome,
      telefone,
      situacao: sit,
      valor: valorBRL(s.amount_total),
      criado: s.created,
      tentativas: lista.length,
      campanha: s.metadata?.utm_campaign || '',
      link,
      whatsapp: linkWhatsApp(telefone, mensagemWhatsApp({ nome, situacao: sit, valor: valorBRL(s.amount_total), link })),
    });
  }
  return linhas.sort((a, b) => b.criado - a.criado);
}

// Telefone da Stripe (+5562999998888) ou digitado (62 99999-8888) → só dígitos com o 55 do Brasil
export function telefoneWhatsApp(phone) {
  const raw = String(phone || '').trim();
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (raw.startsWith('+')) return d;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

export function mensagemWhatsApp({ nome, situacao: sit, valor = 'R$ 37,00', link }) {
  const oi = first(nome) ? `Oi, ${first(nome)}!` : 'Oi!';
  if (sit === 'pix_expirado') {
    return `${oi} Aqui é do Moviq. Vi que o seu Pix de ${valor} expirou antes do pagamento. Seu plano de treino continua salvo. Gerei um link novo pra você: ${link}`;
  }
  return `${oi} Aqui é do Moviq. Vi que você montou seu plano de treino mas não finalizou o pagamento. Ficou alguma dúvida? Se quiser liberar o acesso, é por aqui: ${link}`;
}

export function linkWhatsApp(phone, mensagem) {
  const tel = telefoneWhatsApp(phone);
  return tel ? `https://wa.me/${tel}?${new URLSearchParams({ text: mensagem })}` : '';
}

// E-mail automático de recuperação (enviado pelo webhook quando o Pix expira ou o pagamento é abandonado)
export function buildRecoveryEmail({ email, nome, situacao: sit, valor = 'R$ 37,00', link }) {
  const hi = first(nome) ? `Olá, ${esc(first(nome))}!` : 'Olá!';
  const pix = sit === 'pix_expirado';
  const subject = pix ? 'Seu Pix do Moviq expirou' : 'Seu plano de treino ficou esperando';
  const linha1 = pix
    ? `O Pix de ${valor} para liberar o seu acesso ao Moviq expirou antes do pagamento.`
    : 'Você montou seu plano de treino no Moviq, mas não chegou a finalizar o pagamento.';
  const linha2 = `Seu plano continua salvo com o e-mail ${email}. ${pix ? 'É só gerar um Pix novo:' : 'Para liberar o acesso:'}`;
  const botao = pix ? 'Gerar novo Pix' : 'Finalizar e liberar meu plano';

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Moviq</title></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0e0f13;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:800">Moviq</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:20px;font-weight:800">${hi}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${esc(linha1)}</p>
<p style="margin:0 0 22px;font-size:16px;line-height:1.5">${esc(linha2)}</p>
<p style="margin:0 0 24px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:800;font-size:17px;padding:14px 28px;border-radius:999px">${esc(botao)}</a></p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">Pagamento único de ${esc(valor)} no Pix ou no cartão. Sem mensalidade.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0">
<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">Se você já pagou, pode ignorar este e-mail. Dúvidas? É só responder.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [hi, '', linha1, linha2, link, '', `Pagamento único de ${valor} no Pix ou no cartão. Sem mensalidade.`, '', 'Se você já pagou, pode ignorar este e-mail. Dúvidas? É só responder.'].join('\n');
  return { subject, html, text };
}
