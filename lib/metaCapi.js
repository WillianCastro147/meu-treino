// Compra na Meta pela API de Conversões, enviada pelo próprio app quando a Stripe confirma o pagamento.
// Vai com os dados que ligam a venda ao clique no anúncio (fbc, fbp, IP e navegador de quem clicou em
// "Garantir meu acesso", guardados na sessão da Stripe) e os dados do comprador (e-mail, telefone, nome,
// endereço), convertidos em hash como a Meta pede.
//
// Variáveis na Vercel:
//   META_CAPI_TOKEN        token da API de Conversões (Gerenciador de Eventos > pixel > Configurações).
//                          Sem ele, nada é enviado (a Compra continua só pela Utmify).
//   META_PIXEL_ID          opcional; padrão: pixel MOVIQ APP (2637346966711521)
//   META_TEST_EVENT_CODE   opcional; código de "Eventos de teste" para conferir sem contar como venda
//   META_GRAPH_VERSION     opcional; padrão v24.0
//
// Quiz em espanhol (compra com metadata.lang = 'es'): pixel próprio, "MOVIQ APP ES".
//   META_CAPI_TOKEN_ES       token da API de Conversões desse pixel. Sem ele, a compra em espanhol não vai
//                            para a Meta (nunca vai para o pixel do Brasil).
//   META_PIXEL_ID_ES         opcional; padrão 974150118749887
//   META_TEST_EVENT_CODE_ES  opcional; "Eventos de teste" desse pixel
//
// IMPORTANTE: ao ligar (colocar o token), desligue o envio de Compra para a Meta na Utmify. Os dois mandam
// com IDs de evento diferentes e a Meta contaria cada venda duas vezes.
//
// Sem dependências do Next (dá para testar com node --test).
import { createHash } from 'node:crypto';

export const META_PIXEL_PADRAO = '2637346966711521';
export const META_PIXEL_ES_PADRAO = '974150118749887';

// Pixel, token e código de teste da compra: o do quiz em espanhol para metadata.lang = 'es', senão o do Brasil
export function destinoMeta(session, env = process.env) {
  if (session?.metadata?.lang === 'es') {
    return { pixel: env.META_PIXEL_ID_ES || META_PIXEL_ES_PADRAO, token: env.META_CAPI_TOKEN_ES, testCode: env.META_TEST_EVENT_CODE_ES };
  }
  return { pixel: env.META_PIXEL_ID || META_PIXEL_PADRAO, token: env.META_CAPI_TOKEN, testCode: env.META_TEST_EVENT_CODE };
}

const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const limpo = (v) => String(v ?? '').trim();
const semAcento = (v) => limpo(v).normalize('NFD').replace(/[̀-ͯ]/g, '');

// Normalização pedida pela Meta antes do hash (minúsculas, sem espaços/pontuação onde se aplica)
export const normalizar = {
  email: (v) => limpo(v).toLowerCase(),
  // só dígitos, com DDI; número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55
  telefone: (v) => {
    const d = limpo(v).replace(/\D/g, '');
    if (!d) return '';
    return d.length === 10 || d.length === 11 ? `55${d}` : d;
  },
  nome: (v) => semAcento(v).toLowerCase().replace(/[^a-z\s-]/g, '').trim(),
  cidade: (v) => semAcento(v).toLowerCase().replace(/[^a-z]/g, ''),
  estado: (v) => semAcento(v).toLowerCase().replace(/[^a-z]/g, '').slice(0, 2),
  cep: (v) => limpo(v).replace(/\D/g, ''),
  pais: (v) => limpo(v).toLowerCase().slice(0, 2),
};

const hash = (tipo, v) => {
  const n = normalizar[tipo](v);
  return n ? sha256(n) : undefined;
};

const lerCookie = (cookieHeader, nome) => {
  const m = String(cookieHeader || '').match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
};

const FBC_RE = /^fb\.\d\.\d+\.\S+$/;
const FBP_RE = /^fb\.\d\.\d+\.\d+$/;

// fbc: o cookie _fbc do pixel; se não houver, monta a partir do fbclid do anúncio (formato da Meta)
export function montarFbc(cookieFbc, fbclid, agoraMs = Date.now()) {
  if (FBC_RE.test(limpo(cookieFbc))) return limpo(cookieFbc);
  const id = limpo(fbclid);
  return id ? `fb.1.${agoraMs}.${id}` : '';
}

// Dados do navegador de quem clicou no botão de pagamento, para guardar nos metadados da sessão da Stripe.
// Os metadados da Stripe aceitam no máximo 500 caracteres por valor.
export function dadosDoNavegador({ headers, body = {}, agoraMs = Date.now() }) {
  const get = (n) => (typeof headers?.get === 'function' ? headers.get(n) : headers?.[n]) || '';
  const cookie = get('cookie');
  const fbp = lerCookie(cookie, '_fbp') || limpo(body.fbp);
  const ip = limpo(get('x-forwarded-for').split(',')[0]) || limpo(get('x-real-ip'));
  const dados = {
    meta_fbp: FBP_RE.test(fbp) ? fbp : '',
    meta_fbc: montarFbc(lerCookie(cookie, '_fbc') || body.fbc, body.fbclid, agoraMs),
    meta_ip: ip.slice(0, 64),
    meta_ua: limpo(get('user-agent')).slice(0, 490),
    meta_url: limpo(get('referer')).split('?')[0].slice(0, 490),
  };
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v));
}

// Para checkouts criados a partir de outro (link de recuperação, upsell): mantém os dados do clique original
// no anúncio; o navegador atual só completa o que faltar.
export function dadosDoClique(metadataAntiga = {}, atual = {}) {
  const antigos = Object.fromEntries(Object.entries(metadataAntiga || {}).filter(([k, v]) => k.startsWith('meta_') && v));
  return { ...atual, ...antigos };
}

const semVazios = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null));

// Evento de Compra a partir da Checkout Session paga (como vem no aviso da Stripe)
export function eventoCompra(session, { agoraMs = Date.now() } = {}) {
  const md = session?.metadata || {};
  const cd = session?.customer_details || {};
  const end = cd.address || {};
  const email = cd.email || session?.customer_email || '';
  const [primeiro, ...resto] = limpo(md.nome || cd.name).split(/\s+/);
  const fbc = md.meta_fbc || montarFbc('', md.fbclid, (session?.created || agoraMs / 1000) * 1000);

  const user_data = semVazios({
    em: hash('email', email) && [hash('email', email)],
    ph: hash('telefone', cd.phone) && [hash('telefone', cd.phone)],
    fn: hash('nome', primeiro),
    ln: hash('nome', resto.join(' ')),
    ct: hash('cidade', end.city),
    st: hash('estado', end.state),
    zp: hash('cep', end.postal_code),
    // país do endereço; sem ele, Brasil (quiz em português; no espanhol fica sem país)
    country: hash('pais', end.country || (md.lang === 'es' ? '' : 'BR')),
    external_id: hash('email', email) && [hash('email', email)],
    client_ip_address: md.meta_ip,
    client_user_agent: md.meta_ua,
    fbc,
    fbp: md.meta_fbp,
  });

  return {
    event_name: 'Purchase',
    event_time: Math.floor(agoraMs / 1000),
    // mesmo ID para o mesmo pagamento: aviso repetido da Stripe não conta duas vezes
    event_id: `purchase_${session.id}`,
    action_source: 'website',
    event_source_url: md.meta_url || (md.lang === 'es' ? 'https://quiz.moviqgym.app/es' : 'https://quiz.moviqgym.app/'),
    user_data,
    custom_data: semVazios({
      currency: String(session?.currency || 'brl').toUpperCase(),
      value: Number(session?.amount_total || 0) / 100,
      content_name: md.plano ? `moviq-${md.plano}` : undefined,
      content_type: 'product',
      order_id: session.id,
    }),
  };
}

// Envia a Compra. Sem token: não faz nada. Nunca deve impedir a liberação do acesso (quem chama trata o erro).
export async function enviarCompraMeta(session, opts = {}) {
  const destino = destinoMeta(session, opts.env ?? process.env);
  const token = opts.token ?? destino.token;
  if (!token) return { skipped: 'sem_token' };
  if (!session?.id || !(Number(session.amount_total) > 0)) return { skipped: 'sem_valor' };
  const pixel = opts.pixelId ?? destino.pixel;
  const versao = opts.versao ?? (process.env.META_GRAPH_VERSION || 'v24.0');
  const testCode = opts.testCode ?? destino.testCode;
  const fetchImpl = opts.fetch ?? fetch;

  const corpo = { data: [eventoCompra(session, opts)], ...(testCode ? { test_event_code: testCode } : {}) };
  const res = await fetchImpl(`https://graph.facebook.com/${versao}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const resposta = await res.json().catch(() => ({}));
  // não registra o token nem dados do comprador: só o resultado
  if (!res.ok) throw new Error(`Meta ${res.status}: ${resposta?.error?.message || 'erro'}`);
  return { ok: true, recebidos: resposta.events_received, trace: resposta.fbtrace_id };
}
