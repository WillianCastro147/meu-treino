// Stripe e Supabase "admin": só para as rotas de servidor (app/api/stripe/*). Nunca importe isto numa página.
// Variáveis na Vercel: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_12M, STRIPE_PRICE_3M, STRIPE_PRICE_1M,
// SUPABASE_SERVICE_ROLE_KEY, QUIZ_URL (para onde volta quem desiste no pagamento) e, opcional, NEXT_PUBLIC_APP_URL.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Sem versão de API fixa: usa a versão padrão do SDK instalado
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Plano escolhido no quiz -> preço (Price ID) da Stripe
export const PLAN_PRICES = {
  '12m': process.env.STRIPE_PRICE_12M,
  '3m': process.env.STRIPE_PRICE_3M,
  '1m': process.env.STRIPE_PRICE_1M,
  // Quiz em espanhol (quiz.moviqgym.app/es): assinatura mensal em dólar, US$ 5,00
  // (produto "Moviq · Plan mensual", price_1Ue1NBQfnCdLHlDYBsYb2hPk em 20/11/2026)
  '1m_usd': process.env.STRIPE_PRICE_1M_USD,
};

// Acesso vitalício: pagamento único (Pix ou cartão), sem assinatura.
// O valor cobrado é o do preço avulso cadastrado na Stripe (STRIPE_PRICE_VITALICIO na Vercel,
// produto "Moviq App", R$ 37,00), não o que o quiz mostra na tela.
// Sem essa variável, cobra VITALICIO_CENTAVOS (padrão 3700 = R$ 37,00) com um preço montado na hora.
export const PLANO_VITALICIO = 'vitalicio';
export const VITALICIO_PRICE = process.env.STRIPE_PRICE_VITALICIO || null;
export const VITALICIO_CENTAVOS = Number(process.env.VITALICIO_CENTAVOS) || 3700;
// Condição especial do WhatsApp (LeonaFlow: lead do quiz e quem abandonou o pagamento): o mesmo acesso
// vitalício por R$ 19,90 (46% de desconto). Só pelo link pessoal da mensagem (?o=1 em /api/stripe/pagar e
// /api/stripe/recuperar); a sessão leva metadata.oferta. Preço da Stripe em STRIPE_PRICE_OFERTA, ou montado na hora.
export const OFERTA_PRICE = process.env.STRIPE_PRICE_OFERTA || null;
export const OFERTA_CENTAVOS = Number(process.env.OFERTA_CENTAVOS) || 1990;

// Produtos extras (pagamento único), vendidos como order bump no checkout do vitalício, como oferta
// depois da compra (/bem-vindo) e dentro do app. Cada um tem o preço avulso cadastrado na Stripe numa
// variável da Vercel; sem a variável, aquele extra fica desligado. A ordem é a da oferta depois da compra.
export const PLANO_ALIMENTAR = 'plano_alimentar';
export const GERADOR_IA = 'gerador_ia';
export const PLANO_ALIMENTAR_PRICE = process.env.STRIPE_PRICE_PLANO_ALIMENTAR || null;
export const GERADOR_IA_PRICE = process.env.STRIPE_PRICE_GERADOR_IA || null;
// Guia de Treino Feminino (ebook em PDF, 95 páginas): produto "Guia de Treino Feminino" (prod_VgN7IirZf7119Y),
// preço price_1Uf4ftQfnCdLHlDYJZc01YzC, R$ 19,90 único (23/11/2026; antes price_1Uf0N5QfnCdLHlDYNmooYkew, R$ 27,00).
// STRIPE_PRICE_GUIA_FEMININO na Vercel troca o preço.
export const GUIA_FEMININO = 'guia_feminino';
export const GUIA_FEMININO_PRICE = process.env.STRIPE_PRICE_GUIA_FEMININO || 'price_1Uf4ftQfnCdLHlDYJZc01YzC';
// posCompra: oferecido na /bem-vindo depois da compra (upsell). sexo: só para quem marcou esse sexo no quiz.
// Desde 23/11/2026 o plano alimentar e o gerador com IA não são mais oferecidos depois da compra (estão no
// Premium e seguem à venda dentro do app); a oferta depois da compra é o guia de treino do sexo da pessoa.
export const EXTRAS = [
  { plano: PLANO_ALIMENTAR, price: PLANO_ALIMENTAR_PRICE, nome: 'Plano alimentar', link: '/alimentacao', posCompra: false },
  { plano: GERADOR_IA, price: GERADOR_IA_PRICE, nome: 'Gerador de treino com IA', link: '/coach', posCompra: false },
  { plano: GUIA_FEMININO, price: GUIA_FEMININO_PRICE, nome: 'Guia de Treino Feminino', link: '/guia', posCompra: true, sexo: 'f' },
];
export const extrasAtivos = () => EXTRAS.filter((e) => e.price);
// Ofertas depois da compra para quem marcou `sexo` ('m' | 'f') no quiz: só os extras do sexo da pessoa
// (ou sem sexo definido). Sem sexo no quiz, nenhum guia.
export const ofertasPosCompra = (sexo) => extrasAtivos().filter((e) => e.posCompra && (!e.sexo || e.sexo === sexo));

// Moviq Premium: o app vitalício + plano alimentar + gerador de treino com IA num pagamento único (R$ 57),
// oferecido num pop-up depois do botão "Garantir meu acesso" do quiz. Libera as três linhas de acesso.
// Valor: preço da Stripe em STRIPE_PRICE_PREMIUM (Vercel), ou PREMIUM_CENTAVOS (padrão 5700) montado na hora.
// Produto "Moviq Premium" (prod_Vg44mMMNBAZYrz), preço price_1Uehw7QfnCdLHlDY3ryshsWH, R$ 57,00 único (22/11/2026).
export const PLANO_PREMIUM = 'premium';
export const PREMIUM_PRICE = process.env.STRIPE_PRICE_PREMIUM || null;
export const PREMIUM_CENTAVOS = Number(process.env.PREMIUM_CENTAVOS) || 5700;
// Quais acessos o Premium libera: PLANOS_DO_PREMIUM em lib/reembolso.js
export const extraDoPlano = (plano) => extrasAtivos().find((e) => e.plano === plano) || null;

// Valor de um extra para mostrar nas telas (lido da Stripe e guardado por 10 min)
const precoCache = new Map();
export async function precoExtra(plano) {
  const extra = extraDoPlano(plano);
  if (!stripe || !extra) return null;
  const c = precoCache.get(extra.price);
  if (c && Date.now() - c.at < 10 * 60 * 1000) return c.valor;
  try {
    const p = await stripe.prices.retrieve(extra.price);
    const valor = 'R$ ' + ((p.unit_amount || 0) / 100).toFixed(2).replace('.', ',');
    precoCache.set(extra.price, { at: Date.now(), valor });
    return valor;
  } catch (e) {
    console.error('Preço do extra', plano, e.message);
    return null;
  }
}
export const precoPlanoAlimentar = () => precoExtra(PLANO_ALIMENTAR);

// Preço do extra que um item da compra representa. Compara pelo produto da Stripe, não só pelo Price ID:
// quem abriu o pagamento antes de o valor do extra mudar (Price ID novo na Vercel) paga o preço antigo do
// mesmo produto e continua recebendo o extra. Item que não é extra devolve o próprio Price ID.
const produtoCache = new Map();
async function produtoDoPreco(price) {
  if (!produtoCache.has(price)) {
    try {
      const p = await stripe.prices.retrieve(price);
      produtoCache.set(price, typeof p.product === 'string' ? p.product : p.product?.id || null);
    } catch (e) {
      console.error('Produto do preço', price, e.message);
      return null;
    }
  }
  return produtoCache.get(price);
}
export async function precoDoItem(item) {
  const id = item?.price?.id || null;
  const produto = typeof item?.price?.product === 'string' ? item.price.product : item?.price?.product?.id || null;
  for (const e of extrasAtivos()) {
    if (e.price === id) return e.price;
    if (stripe && produto && produto === (await produtoDoPreco(e.price))) return e.price;
  }
  return id;
}

// A conta (e-mail) tem este extra liberado? Linha ativa na tabela assinaturas (migração 006).
export async function temExtra(db, email, plano) {
  if (!db || !email) return false;
  const { data, error } = await db.from('assinaturas').select('id').eq('email', String(email).toLowerCase()).eq('plano', plano).eq('status', 'active').limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export const APP_URL =(process.env.NEXT_PUBLIC_APP_URL || 'https://www.moviqgym.app').replace(/\/+$/, '');

// Para onde volta quem desiste na página de pagamento
export const QUIZ_URL = process.env.QUIZ_URL || 'https://quiz.moviqgym.app';

// Marca de cada oferta na página de pagamento (branding_settings da Checkout Session).
// Fica por sessão, e não só em Configurações > Marca da Stripe, para uma oferta nova
// (outro produto na mesma conta) ter nome e ícone próprios sem mudar as outras.
// Campos aceitos: display_name, icon/logo ({ type: 'url', url }), background_color, button_color,
// font_family, border_style.
export const MARCA_MOVIQ = {
  display_name: 'Moviq',
  icon: { type: 'url', url: 'https://www.moviqgym.app/icon-maskable-512.png' },
};
export const MARCA_POR_PLANO = {
  '12m': MARCA_MOVIQ,
  '3m': MARCA_MOVIQ,
  '1m': MARCA_MOVIQ,
  '1m_usd': MARCA_MOVIQ,
  vitalicio: MARCA_MOVIQ,
  premium: MARCA_MOVIQ,
  plano_alimentar: MARCA_MOVIQ,
  gerador_ia: MARCA_MOVIQ,
};

// Nome da pessoa para o link de acesso / e-mail de boas-vindas, em ordem de preferência:
// 1) o nome digitado no quiz que veio no checkout (metadata.nome);
// 2) o nome salvo no quiz com o mesmo e-mail (compras feitas antes desse campo existir);
// 3) só então o nome que a Stripe pegou no pagamento (titular do cartão, que pode ser outra pessoa).
export async function nomeDaCompra(session, db = supabaseAdmin()) {
  const doQuiz = String(session?.metadata?.nome || '').trim();
  if (doQuiz) return doQuiz;
  const email = String(session?.customer_details?.email || session?.customer_email || '').trim().toLowerCase();
  if (db && email) {
    try {
      const { data } = await db.from('quiz_leads').select('name').eq('email', email).maybeSingle();
      const salvo = String(data?.name || '').trim();
      if (salvo) return salvo;
    } catch (e) {}
  }
  return session?.customer_details?.name || null;
}

// Grava na tabela assinaturas (migração 006) ignorando RLS
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
