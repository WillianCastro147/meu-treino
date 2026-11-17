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

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.moviqgym.app').replace(/\/+$/, '');

// Para onde volta quem desiste na página de pagamento
export const QUIZ_URL = process.env.QUIZ_URL || 'https://quiz.moviqgym.app';

// Grava na tabela assinaturas (migração 006) ignorando RLS
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
