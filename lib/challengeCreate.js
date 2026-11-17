// Monta e grava o Desafio 21 dias: primeiro pelo Coach com IA (app/api/coach, kind 'challenge');
// se a IA não estiver configurada, falhar ou passar do limite diário, usa o desafio pronto do nível.
// Usado pela aba Desafio (components/ChallengeTab.js) e pela tela /preparando (quiz).
import { supabase } from '@/lib/supabase';
import { findExercise, loadCatalog } from '@/lib/catalog';
import { buildReadyChallenge } from '@/lib/challenge';
import { saveChallenge } from '@/lib/data';

// opts: { level, minutes, notes, lang }. Retorna { error, missing, plan, fromAI }
export async function createChallenge(userId, { level = 'beginner', minutes = 30, notes = '', lang = 'pt' } = {}) {
  let built = null;
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify({ kind: 'challenge', level, minutes, notes, lang }),
    });
    if (res.ok) built = (await res.json()).challenge || null;
  } catch (e) {}
  const fromAI = !!built;
  if (!built) {
    await loadCatalog();
    built = buildReadyChallenge(level, lang, (id) => findExercise({ id }));
  }
  const r = await saveChallenge(userId, built);
  return { ...r, fromAI };
}
