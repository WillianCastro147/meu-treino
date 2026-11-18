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
};

// Acesso vitalício: pagamento único (Pix ou cartão), sem assinatura.
// O valor cobrado é o do preço avulso cadastrado na Stripe (STRIPE_PRICE_VITALICIO na Vercel,
// produto "Moviq App", R$ 37,00), não o que o quiz mostra na tela.
// Sem essa variável, cobra VITALICIO_CENTAVOS (padrão 3700 = R$ 37,00) com um preço montado na hora.
export const PLANO_VITALICIO = 'vitalicio';
export const VITALICIO_PRICE = process.env.STRIPE_PRICE_VITALICIO || null;
export const VITALICIO_CENTAVOS = Number(process.env.VITALICIO_CENTAVOS) || 3700;

export const APP_URL =(process.env.NEXT_PUBLIC_APP_URL || 'https://www.moviqgym.app').replace(/\/+$/, '');

// Para onde volta quem desiste na página de pagamento
export const QUIZ_URL = process.env.QUIZ_URL || 'https://quiz.moviqgym.app';

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
