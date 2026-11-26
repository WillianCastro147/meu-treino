// Recuperação de venda pelo WhatsApp com o LeonaFlow (app.leonasolutions.io → Webhooks de entrada).
// O app manda um POST para o webhook de cada evento; no LeonaFlow, cada webhook liga nome/telefone/e-mail
// ao lead e dispara o fluxo daquele evento. Disparar um fluxo substitui o que estiver em andamento:
// é assim que "comprou" encerra a cobrança.
//
// Variáveis na Vercel (a URL de cada webhook, copiada do LeonaFlow; sem a variável, o evento não é enviado):
//   LEONA_WEBHOOK_LEAD          deixou nome, e-mail e WhatsApp no quiz (o fluxo espera ~15 min; se a pessoa
//                               abrir o pagamento ou comprar, o evento seguinte substitui o fluxo). O link
//                               abre a prévia do app (/previa?l=<id>); link_pagamento vai direto ao pagamento.
//   LEONA_WEBHOOK_CHECKOUT_ABERTO  abriu o pagamento (botão "Garantir meu acesso"). O fluxo espera ~10 min e,
//                                  se nada aconteceu, chama a pessoa; Pix gerado ou compra substituem o fluxo.
//   LEONA_WEBHOOK_PIX_GERADO    gerou o Pix e ainda não pagou (o fluxo espera uns minutos e lembra)
//   LEONA_WEBHOOK_PIX_EXPIRADO  o Pix venceu sem pagamento
//   LEONA_WEBHOOK_ABANDONOU     abriu o pagamento e saiu sem pagar (sessão expirou em 24 h)
//   LEONA_WEBHOOK_COMPROU       pagamento confirmado
// Só vale para o quiz em português, compra do acesso vitalício e quem informou o WhatsApp no quiz.
//
// Sem dependências do Next (dá para testar com node --test).

export const EVENTOS_LEONA = {
  lead: 'LEONA_WEBHOOK_LEAD',
  checkout_aberto: 'LEONA_WEBHOOK_CHECKOUT_ABERTO',
  pix_gerado: 'LEONA_WEBHOOK_PIX_GERADO',
  pix_expirado: 'LEONA_WEBHOOK_PIX_EXPIRADO',
  abandonou: 'LEONA_WEBHOOK_ABANDONOU',
  comprou: 'LEONA_WEBHOOK_COMPROU',
};

// WhatsApp do Brasil digitado no quiz → só dígitos com o 55 (5562999998888). Inválido → ''.
export function normalizarWhatsApp(v) {
  let d = String(v || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return '';
  if (d[0] === '0') return '';
  if (d.length === 11 && d[2] !== '9') return ''; // celular com 11 dígitos começa com 9 depois do DDD
  return '55' + d;
}

const app = (u) => String(u || 'https://www.moviqgym.app').replace(/\/+$/, '');
const valorBRL = (centavos) => 'R$ ' + (Number(centavos || 0) / 100).toFixed(2).replace('.', ',');

// Checkout da Hotmart do acesso vitalício (R$ 37): alternativa para quem pode ter desconfiado da página da
// Stripe ou do recebedor do Pix. O webhook da Hotmart (app/api/hotmart/webhook) libera o acesso pelo e-mail
// da compra, por isso o link já vai com o e-mail e o nome do quiz. sck marca a origem nos relatórios da Hotmart.
// Vercel: HOTMART_CHECKOUT_VITALICIO (opcional; padrão = o mesmo link do quiz, public/quiz-site/config.js).
export const HOTMART_CHECKOUT_PADRAO = 'https://pay.hotmart.com/B108579304F?checkoutMode=10';
export function linkHotmart({ email, nome, evento }, env = {}) {
  const u = new URL(env.HOTMART_CHECKOUT_VITALICIO || HOTMART_CHECKOUT_PADRAO);
  if (email) u.searchParams.set('email', email);
  if (nome) u.searchParams.set('name', nome);
  u.searchParams.set('sck', `whatsapp_${evento}`);
  return u.toString();
}

// Dados enviados ao LeonaFlow (o mesmo formato para todos os eventos). Nas mensagens: {link} é o próximo
// passo (pagar, ou criar a conta depois da compra) e {previa} abre a prévia do app com o plano da pessoa.
// {link_oferta} paga a condição especial (R$ 19,90) e {previa_oferta} é a prévia com esse preço no botão;
// {link_hotmart} paga os R$ 37 pela Hotmart.
export function payloadLeona(evento, session, { appUrl, env = process.env } = {}) {
  const md = session?.metadata || {};
  const email = String(session?.customer_details?.email || session?.customer_email || '').trim().toLowerCase();
  const nome = String(md.nome || session?.customer_details?.name || '').trim();
  const base = app(appUrl);
  // checkout_aberto: a mesma página de pagamento (vale 24 h); comprou: cadastro; o resto: pagamento novo
  const link =
    evento === 'comprou'
      ? `${base}/login?${new URLSearchParams({ modo: 'cadastro', email })}`
      : evento === 'checkout_aberto' && session?.url
        ? session.url
        : `${base}/api/stripe/recuperar?${new URLSearchParams({ s: session.id, c: 'whatsapp' })}`;
  return {
    evento,
    nome,
    primeiro_nome: nome.split(/\s+/)[0] || '',
    telefone: normalizarWhatsApp(md.whatsapp),
    email,
    valor: valorBRL(session?.amount_total),
    produto: 'Moviq',
    link,
    // prévia do app com o plano do quiz (dá confiança a quem ficou com medo de pagar e não receber);
    // o botão de compra dela abre um pagamento novo
    previa: evento === 'comprou' ? '' : `${base}/previa?${new URLSearchParams({ s: session.id })}`,
    previa_oferta: evento === 'comprou' ? '' : `${base}/previa?${new URLSearchParams({ s: session.id, o: '1' })}`,
    link_oferta:
      evento === 'comprou' ? '' : `${base}/api/stripe/recuperar?${new URLSearchParams({ s: session.id, c: 'whatsapp', o: '1' })}`,
    link_hotmart: evento === 'comprou' ? '' : linkHotmart({ email, nome, evento }, env),
    session_id: session.id,
  };
}

// Deve avisar o LeonaFlow sobre esta sessão? Quiz em português, acesso vitalício (ou Premium) e WhatsApp válido.
export function deveAvisarLeona(session) {
  const md = session?.metadata || {};
  if (md.lang && md.lang !== 'pt') return false;
  if (md.plano !== 'vitalicio' && md.plano !== 'premium') return false;
  return !!normalizarWhatsApp(md.whatsapp);
}

async function postLeona(url, payload, opts = {}) {
  const fetchImpl = opts.fetch ?? fetch;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  // não registra a URL (tem o código secreto do webhook) nem dados do comprador: só o resultado
  if (!res.ok) throw new Error(`LeonaFlow ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return { ok: true };
}

// Envia o evento. Sem a URL do webhook ou sem WhatsApp: não faz nada. Nunca deve impedir a liberação
// do acesso (quem chama trata o erro).
export async function enviarLeona(evento, session, opts = {}) {
  const env = opts.env ?? process.env;
  const url = env[EVENTOS_LEONA[evento]];
  if (!url) return { skipped: 'sem_webhook' };
  if (!deveAvisarLeona(session)) return { skipped: 'fora_do_publico' };
  return postLeona(url, payloadLeona(evento, session, opts), opts);
}

// ---------- Compra pela Hotmart ----------
// O fluxo "comprou" também vale para quem pagou na Hotmart (link do WhatsApp ou checkout do quiz): manda a
// confirmação com o link de cadastro e encerra a cobrança em andamento, como na Stripe.
// a: aviso já lido por lib/hotmart.js (lerAviso). whatsappQuiz/nomeQuiz: do quiz com o mesmo e-mail; o
// WhatsApp do quiz vem antes do celular do checkout, porque é o número que recebeu as mensagens.
export function deveAvisarCompraHotmart(a) {
  if (!a || a.evento !== 'PURCHASE_APPROVED' || a.renovacao || a.orderBump) return false;
  if (a.lang && a.lang !== 'pt') return false;
  return a.plano === 'vitalicio';
}

export function payloadCompraHotmart(a, { appUrl, whatsappQuiz = '', nomeQuiz = '' } = {}) {
  const nome = String(nomeQuiz || a?.nome || '').trim();
  const email = String(a?.email || '').trim().toLowerCase();
  return {
    evento: 'comprou',
    nome,
    primeiro_nome: nome.split(/\s+/)[0] || '',
    telefone: normalizarWhatsApp(whatsappQuiz) || normalizarWhatsApp(a?.telefone),
    email,
    valor: valorBRL(a?.valorCentavos),
    produto: 'Moviq',
    link: `${app(appUrl)}/login?${new URLSearchParams({ modo: 'cadastro', email })}`,
    previa: '',
    previa_oferta: '',
    link_oferta: '',
    link_hotmart: '',
    session_id: a?.transacao || null,
  };
}

export async function enviarCompraHotmartLeona(a, opts = {}) {
  const env = opts.env ?? process.env;
  const url = env[EVENTOS_LEONA.comprou];
  if (!url) return { skipped: 'sem_webhook' };
  if (!deveAvisarCompraHotmart(a)) return { skipped: 'fora_do_publico' };
  const payload = payloadCompraHotmart(a, opts);
  if (!payload.telefone) return { skipped: 'sem_whatsapp' };
  return postLeona(url, payload, opts);
}

// ---------- Lead do quiz (ainda sem pagamento aberto) ----------
// lead: linha de quiz_leads ({ id, email, name, answers: { whatsapp }, updated_at, claimed_at })

// Só avisa um lead que acabou de ser salvo (evita que a rota pública dispare mensagem para números antigos
// ou aleatórios), ainda não usado no app e com WhatsApp válido.
export function leadRecente(lead, { agoraMs = Date.now(), janelaMs = 10 * 60 * 1000 } = {}) {
  if (!lead || lead.claimed_at) return false;
  if (!normalizarWhatsApp(lead.answers?.whatsapp)) return false;
  const quando = Date.parse(lead.updated_at || lead.created_at || '');
  return Number.isFinite(quando) && agoraMs - quando >= 0 && agoraMs - quando <= janelaMs;
}

export function payloadLead(lead, { appUrl, valor = 'R$ 37,00', env = process.env } = {}) {
  const nome = String(lead?.name || '').trim();
  const email = String(lead?.email || '').trim().toLowerCase();
  const base = app(appUrl);
  return {
    evento: 'lead',
    nome,
    primeiro_nome: nome.split(/\s+/)[0] || '',
    telefone: normalizarWhatsApp(lead?.answers?.whatsapp),
    email,
    valor,
    produto: 'Moviq',
    // link: prévia do app com o plano da pessoa (tudo bloqueado, com o botão de compra);
    // link_pagamento: direto para o pagamento
    link: `${base}/previa?${new URLSearchParams({ l: lead.id })}`,
    link_pagamento: `${base}/api/stripe/pagar?${new URLSearchParams({ l: lead.id })}`,
    previa: `${base}/previa?${new URLSearchParams({ l: lead.id })}`,
    // condição especial (R$ 19,90): prévia com esse preço no botão e o pagamento direto
    previa_oferta: `${base}/previa?${new URLSearchParams({ l: lead.id, o: '1' })}`,
    link_oferta: `${base}/api/stripe/pagar?${new URLSearchParams({ l: lead.id, o: '1' })}`,
    link_hotmart: linkHotmart({ email, nome, evento: 'lead' }, env),
    session_id: null,
  };
}

export async function enviarLeadLeona(lead, opts = {}) {
  const env = opts.env ?? process.env;
  const url = env[EVENTOS_LEONA.lead];
  if (!url) return { skipped: 'sem_webhook' };
  if (!leadRecente(lead, opts)) return { skipped: 'fora_do_publico' };
  return postLeona(url, payloadLead(lead, opts), opts);
}
