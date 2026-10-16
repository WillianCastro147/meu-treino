// Leituras e gravações usadas por várias telas
import { supabase } from '@/lib/supabase';

const PAGE = 1000;

// Todos os treinos do usuário (paginado: o Supabase devolve no máximo 1000 por vez)
export async function fetchAllWorkouts() {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, name, started_at, duration_min, exercises')
      .order('started_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) return all;
  }
}

// A tabela body_weights ainda não foi criada (migração 002 não rodou)
export const isMissingTable = (error) =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message || ''));

// { rows: [{ measured_on, weight_kg }] mais antigo primeiro, missing: true se falta a tabela }
export async function fetchBodyWeights() {
  const { data, error } = await supabase
    .from('body_weights')
    .select('id, measured_on, weight_kg')
    .order('measured_on', { ascending: true });
  if (isMissingTable(error)) return { rows: [], missing: true };
  if (error) throw error;
  return { rows: data || [], missing: false };
}

// Registra o peso do dia (substitui se já houver um no mesmo dia) e atualiza o perfil
export async function logBodyWeight(userId, weightKg, date = new Date()) {
  const d = new Date(date);
  const measured_on = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { error } = await supabase
    .from('body_weights')
    .upsert({ user_id: userId, measured_on, weight_kg: weightKg }, { onConflict: 'user_id,measured_on' });
  if (error) return { error };
  await supabase.from('profiles').update({ weight_kg: weightKg, updated_at: new Date().toISOString() }).eq('id', userId);
  return { error: null };
}
