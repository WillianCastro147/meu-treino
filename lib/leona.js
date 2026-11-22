// Recuperação de venda pelo WhatsApp com o LeonaFlow (app.leonasolutions.io → Webhooks de entrada).
// O app manda um POST para o webhook de cada evento; no LeonaFlow, cada webhook liga nome/telefone/e-mail
// ao lead e dispara o fluxo daquele evento. Disparar um fluxo substitui o que estiver em andamento:
// é assim que "comprou" encerra a cobrança.
//
// Variáveis na Vercel (a URL de cada webhook, copiada do LeonaFlow; sem a variável, o evento não é enviado):
//   LEONA_WEBHOOK_LEAD          deixou nome, e-mail e WhatsApp no quiz (o fluxo espera ~15 min; se a pessoa
//                               abrir o pagamento ou comprar, o evento seguinte substitui o fluxo). O link
//                               abre o pagamento direto (/api/stripe/pagar?l=<id do lead>).
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

// Dados enviados ao LeonaFlow (o mesmo formato para todos os eventos)
export function payloadLeona(evento, session, { appUrl } = {}) {
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
    session_id: session.id,
  };
}

// Deve avisar o LeonaFlow sobre esta sessão? Quiz em português, acesso vitalício e WhatsApp válido.
export function deveAvisarLeona(session) {
  const md = session?.metadata || {};
  if (md.lang && md.lang !== 'pt') return false;
  if (md.plano !== 'vitalicio') return false;
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

export function payloadLead(lead, { appUrl, valor = 'R$ 37,00' } = {}) {
  const nome = String(lead?.name || '').trim();
  return {
    evento: 'lead',
    nome,
    primeiro_nome: nome.split(/\s+/)[0] || '',
    telefone: normalizarWhatsApp(lead?.answers?.whatsapp),
    email: String(lead?.email || '').trim().toLowerCase(),
    valor,
    produto: 'Moviq',
    link: `${app(appUrl)}/api/stripe/pagar?${new URLSearchParams({ l: lead.id })}`,
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
