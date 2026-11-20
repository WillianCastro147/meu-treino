// Monta e grava o Desafio 21 dias: primeiro pelo Coach com IA (app/api/coach, kind 'challenge');
// se a IA não estiver configurada, falhar ou passar do limite diário, usa o desafio pronto do nível.
// Usado pela aba Desafio (components/ChallengeTab.js) e pela tela /preparando (quiz).
import { supabase } from '@/lib/supabase';
import { findExercise, loadCatalog } from '@/lib/catalog';
import { buildReadyChallenge } from '@/lib/challenge';
import { saveChallenge } from '@/lib/data';

// opts: { level, minutes, notes, lang, pronto, ofertaSeBloqueado }. Retorna { error, missing, plan, fromAI }
//   pronto: usa direto o desafio pronto do nível, sem chamar a IA.
//   ofertaSeBloqueado: se a conta não tem o gerador de treino com IA (extra pago), não monta nada e
//   devolve { bloqueado: true, preco } para a tela mostrar a oferta (e o desafio pronto como opção).
export async function createChallenge(userId, { level = 'beginner', minutes = 30, notes = '', lang = 'pt', pronto = false, ofertaSeBloqueado = false } = {}) {
  let built = null;
  if (!pronto) {
    try {
      const { data } = await supabase.auth.getSession();
      const auth = { Authorization: `Bearer ${data.session?.access_token || ''}` };
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ kind: 'challenge', level, minutes, notes, lang }),
      });
      if (res.ok) built = (await res.json()).challenge || null;
      else if (res.status === 403 && ofertaSeBloqueado) {
        const acesso = await fetch('/api/coach/acesso', { headers: auth })
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
        return { bloqueado: true, preco: acesso.preco || null };
      }
    } catch (e) {}
  }
  const fromAI = !!built;
  if (!built) {
    await loadCatalog();
    built = buildReadyChallenge(level, lang, (id) => findExercise({ id }));
  }
  const r = await saveChallenge(userId, built);
  return { ...r, fromAI };
}
