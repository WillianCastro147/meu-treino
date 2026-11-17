// Leituras e gravações usadas por várias telas
import { supabase } from '@/lib/supabase';
import { normalizeChallenge, withChallenge } from '@/lib/challenge';

const PAGE = 1000;

// Todos os treinos do usuário (paginado: o Supabase devolve no máximo 1000 por vez)
export async function fetchAllWorkouts() {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
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

// Coluna nova ainda não existe no banco (migração 003 não rodou)
export const isMissingColumn = (error) =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(error.message || ''));

// Plano do usuário (profiles.plan). { plan, missing: true } se a migração 003 não rodou
export async function fetchPlan(userId) {
  const { data, error } = await supabase.from('profiles').select('plan').eq('id', userId).single();
  if (isMissingColumn(error)) return { plan: null, missing: true };
  if (error) throw error;
  return { plan: data?.plan || null, missing: false };
}

export async function savePlan(userId, plan) {
  const { error } = await supabase.from('profiles').update({ plan }).eq('id', userId);
  return { error, missing: isMissingColumn(error) };
}

// Grava um treino; se a coluna routine_id ainda não existir, grava sem ela
export async function insertWorkout(workout) {
  let res = await supabase.from('workouts').insert(workout).select('id').single();
  if (isMissingColumn(res.error) && 'routine_id' in workout) {
    const { routine_id, ...rest } = workout;
    res = await supabase.from('workouts').insert(rest).select('id').single();
  }
  return res;
}

// Desafio 21 dias: grava os 21 treinos como rotinas e guarda o desafio no plano (lib/challenge.js).
// Se já havia um desafio, as rotinas dele são apagadas. built: { summary, days: [{ name, notes, exercises }] }
export async function saveChallenge(userId, built) {
  const current = await fetchPlan(userId).catch((error) => ({ error }));
  if (current.error) return { error: current.error };
  if (current.missing) return { error: null, missing: true };
  const { data, error } = await supabase
    .from('routines')
    .insert(built.days.map((d) => ({ user_id: userId, name: d.name, exercises: d.exercises })))
    .select('id');
  if (error) return { error };
  const old = normalizeChallenge(current.plan?.challenge);
  const plan = withChallenge(current.plan, data.map((r) => r.id), built);
  const res = await savePlan(userId, plan);
  if (res.error) return res;
  if (old) await supabase.from('routines').delete().in('id', old.days.map((d) => d.id));
  return { error: null, plan };
}

// Sai do desafio: apaga as rotinas dele (os treinos feitos continuam no histórico)
export async function removeChallenge(userId) {
  const current = await fetchPlan(userId).catch((error) => ({ error }));
  if (current.error || current.missing) return { error: current.error || null };
  const old = normalizeChallenge(current.plan?.challenge);
  const { challenge, ...plan } = current.plan || {};
  const res = await savePlan(userId, plan);
  if (res.error) return res;
  if (old) await supabase.from('routines').delete().in('id', old.days.map((d) => d.id));
  return { error: null, plan };
}

// Grava rotinas [{ name, exercises, day }] e monta a semana com elas (day: 1 = segunda ... 7 = domingo)
export async function saveRoutinesAsWeek(userId, routines) {
  const { data, error } = await supabase
    .from('routines')
    .insert(routines.map((r) => ({ user_id: userId, name: r.name, exercises: r.exercises })))
    .select('id');
  if (error) return { error };
  const current = await fetchPlan(userId).catch(() => ({ plan: null, missing: true }));
  if (!current.missing) {
    const week = Object.fromEntries(routines.map((r, i) => [r.day, data[i].id]).filter(([day]) => day));
    const p = current.plan && typeof current.plan === 'object' ? current.plan : {};
    await savePlan(userId, { rotation: [], ...p, mode: 'week', week });
  }
  return { error: null };
}
