// Quem pode usar o Coach com IA (gerar treino ou Desafio pela IA). Só servidor.
//
// O gerador de treino com IA é um extra pago (lib/stripe.js GERADOR_IA). Com o preço configurado na
// Vercel (STRIPE_PRICE_GERADOR_IA), a IA fica liberada para:
//   - quem comprou o gerador (linha 'gerador_ia' ativa na tabela assinaturas); e
//   - quem ainda está montando o primeiro plano a partir do quiz (quiz do e-mail ainda não usado:
//     /preparando gera o plano e o Desafio e só depois marca o quiz como usado).
// Sem o preço configurado, ninguém é bloqueado (o Coach funciona como antes).
import { supabaseAdmin, GERADOR_IA, GERADOR_IA_PRICE, temExtra, precoExtra } from '@/lib/stripe';

async function quizPendente(db, email) {
  const { data, error } = await db.from('quiz_leads').select('id').eq('email', email).is('claimed_at', null).limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

// { liberado, motivo } · motivo: 'sem_bloqueio' | 'gerador' | 'primeiro_plano' | 'bloqueado'
export async function acessoCoach(email) {
  const db = supabaseAdmin();
  if (!GERADOR_IA_PRICE || !db) return { liberado: true, motivo: 'sem_bloqueio' };
  const mail = String(email || '').toLowerCase();
  if (!mail) return { liberado: false, motivo: 'bloqueado' };
  if (await temExtra(db, mail, GERADOR_IA)) return { liberado: true, motivo: 'gerador' };
  if (await quizPendente(db, mail)) return { liberado: true, motivo: 'primeiro_plano' };
  return { liberado: false, motivo: 'bloqueado' };
}

export const precoGerador = () => precoExtra(GERADOR_IA);
