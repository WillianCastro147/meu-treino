// Recuperação de venda pelo WhatsApp com o LeonaFlow (app.leonasolutions.io → Webhooks de entrada).
// O app manda um POST para o webhook de cada evento; no LeonaFlow, cada webhook liga nome/telefone/e-mail
// ao lead e dispara o fluxo daquele evento. Disparar um fluxo substitui o que estiver em andamento:
// é assim que "comprou" encerra a cobrança.
//
// Variáveis na Vercel (a URL de cada webhook, copiada do LeonaFlow; sem a variável, o evento não é enviado):
//   LEONA_WEBHOOK_PIX_GERADO    gerou o Pix e ainda não pagou (o fluxo espera uns minutos e lembra)
//   LEONA_WEBHOOK_PIX_EXPIRADO  o Pix venceu sem pagamento
//   LEONA_WEBHOOK_ABANDONOU     abriu o pagamento e saiu sem pagar (sessão expirou em 24 h)
//   LEONA_WEBHOOK_COMPROU       pagamento confirmado
// Só vale para o quiz em português, compra do acesso vitalício e quem informou o WhatsApp no quiz.
//
// Sem dependências do Next (dá para testar com node --test).

export const EVENTOS_LEONA = {
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
  const link =
    evento === 'comprou'
      ? `${base}/login?${new URLSearchParams({ modo: 'cadastro', email })}`
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

// Envia o evento. Sem a URL do webhook ou sem WhatsApp: não faz nada. Nunca deve impedir a liberação
// do acesso (quem chama trata o erro).
export async function enviarLeona(evento, session, opts = {}) {
  const env = opts.env ?? process.env;
  const url = env[EVENTOS_LEONA[evento]];
  if (!url) return { skipped: 'sem_webhook' };
  if (!deveAvisarLeona(session)) return { skipped: 'fora_do_publico' };
  const fetchImpl = opts.fetch ?? fetch;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadLeona(evento, session, opts)),
    signal: AbortSignal.timeout(10000),
  });
  // não registra a URL (tem o código secreto do webhook) nem dados do comprador: só o resultado
  if (!res.ok) throw new Error(`LeonaFlow ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return { ok: true };
}
