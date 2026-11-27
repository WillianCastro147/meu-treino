'use client';

// Primeira entrada depois da compra: procura o quiz feito com o e-mail da conta,
// preenche o perfil (nome, altura, peso, meta), monta o plano com o Coach com IA
// (ou um plano pronto, se a IA não estiver disponível) e leva para o app.
// Sem quiz pendente, vai direto para o Início. Funções do banco em supabase/migrations/005_quiz.sql.
// Quiz feito com outro e-mail (trocou no checkout): acha pela marca que o quiz deixou no cookie
// moviq_quiz (migração 008, adopt_quiz_lead).

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { fetchPlan, logBodyWeight, saveRoutinesAsWeek } from '@/lib/data';
import { findExercise, loadCatalog } from '@/lib/catalog';
import { buildStarterPlan, STARTER_PLANS } from '@/lib/starter';
import { normalizeChallenge } from '@/lib/challenge';
import { createChallenge } from '@/lib/challengeCreate';
import { firstName, toCoachInput, toChallengeInput, starterFor } from '@/lib/quiz';
import { IconLogo } from '@/components/Icons';
import { isStandalone } from '@/lib/install';

const MARCA_COOKIE = 'moviq_quiz';

function lerMarca() {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${MARCA_COOKIE}=([A-Za-z0-9-]{16,64})`));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Quiz usado: a marca não serve mais (num aparelho compartilhado, não vale para outra conta)
function apagarMarca() {
  try {
    const dominio = /(^|\.)moviqgym\.app$/.test(window.location.hostname) ? '; domain=.moviqgym.app' : '';
    document.cookie = `${MARCA_COOKIE}=; path=/; max-age=0${dominio}`;
    if (dominio) document.cookie = `${MARCA_COOKIE}=; path=/; max-age=0`;
  } catch {}
}

async function meuQuiz() {
  const { data, error } = await supabase.rpc('get_my_quiz_lead');
  return !error && Array.isArray(data) ? data[0] || null : null;
}

// Depois do plano pronto, quem ainda não instalou o app passa pela tela de instalação
const afterPlan = (dest) => (isStandalone() ? dest : `/instalar?next=${encodeURIComponent(dest)}`);

export default function PreparandoPage() {
  return <AuthGuard>{(user) => <Preparando user={user} />}</AuthGuard>;
}

function Preparando({ user }) {
  const router = useRouter();
  const started = useRef(false);
  const [lead, setLead] = useState(null);
  const [phase, setPhase] = useState('check'); // check | profile | plan | done | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    // 1) Tem quiz para este e-mail? (se a migração 005 não rodou, segue sem quiz)
    let found = await meuQuiz();
    // Não tem: o quiz pode ter sido feito com outro e-mail neste navegador (marca do cookie)
    const marca = found ? null : lerMarca();
    if (marca) {
      const { data: adotou } = await supabase.rpc('adopt_quiz_lead', { p_marca: marca });
      if (adotou === true) found = await meuQuiz();
    }
    if (!found) return router.replace('/inicio');
    setLead(found);
    const a = found.answers || {};

    // 2) Perfil
    setPhase('profile');
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
    const patch = { updated_at: new Date().toISOString() };
    if (!profile?.name && found.name) patch.name = found.name;
    if (a.altura) patch.height_cm = a.altura;
    if (a.peso) patch.weight_kg = a.peso;
    await supabase.from('profiles').update(patch).eq('id', user.id);
    if (a.pesoMeta) await supabase.from('profiles').update({ goal_weight_kg: a.pesoMeta }).eq('id', user.id); // coluna da migração 002
    if (a.peso) await logBodyWeight(user.id, a.peso).catch(() => {});

    // 3) Plano (só se a conta ainda não tem rotinas)
    setPhase('plan');
    const { count } = await supabase.from('routines').select('id', { count: 'exact', head: true });
    if (!count) {
      const ok = (await planFromCoach(a)) || (await planFromStarter(a));
      if (!ok) {
        setError('Não conseguimos montar seu plano agora. Você pode criar pelo Coach na aba Plano.');
        setPhase('error');
        await supabase.rpc('claim_quiz_lead', { p_id: found.id });
        apagarMarca();
        return;
      }
    }

    // 4) Desafio 21 dias de calistenia, se a pessoa quis no quiz (e ainda não tem um)
    const challengeInput = toChallengeInput(a);
    if (challengeInput) {
      setPhase('challenge');
      const current = await fetchPlan(user.id).catch(() => ({ plan: null }));
      if (!normalizeChallenge(current.plan?.challenge)) await createChallenge(user.id, challengeInput).catch(() => {});
    }

    // 5) Marca o quiz como usado
    await supabase.rpc('claim_quiz_lead', { p_id: found.id });
    apagarMarca();
    setPhase('done');
  }

  async function planFromCoach(a) {
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
        body: JSON.stringify(toCoachInput(a)),
      });
      if (!res.ok) return false;
      const body = await res.json();
      const { error: err } = await saveRoutinesAsWeek(user.id, body.plan.routines);
      return !err;
    } catch (e) {
      return false;
    }
  }

  async function planFromStarter(a) {
    try {
      await loadCatalog();
      const id = starterFor(a);
      const built = buildStarterPlan(id, 'pt', (exId) => findExercise({ id: exId }));
      const dayOf = Object.fromEntries(STARTER_PLANS[id].schedule.map(([day, key]) => [key, day]));
      const { error: err } = await saveRoutinesAsWeek(
        user.id,
        built.routines.map((r) => ({ name: r.name, exercises: r.exercises, day: dayOf[r.key] }))
      );
      return !err;
    } catch (e) {
      return false;
    }
  }

  const name = firstName(lead?.name);
  const items = [
    ['profile', 'Salvando suas medidas'],
    ['plan', 'Montando seus treinos da semana'],
    ...(toChallengeInput(lead?.answers) ? [['challenge', 'Montando seu Desafio 21 dias de calistenia']] : []),
  ];
  const order = ['check', 'profile', 'plan', 'challenge', 'done'];
  const at = order.indexOf(phase === 'error' ? 'done' : phase);

  if (!lead) {
    return (
      <div className="auth-wrap">
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ textAlign: 'center' }}>
        <IconLogo size={44} />
        <h1 className="quiz-title" style={{ marginTop: 14 }}>
          {phase === 'done' ? `${name ? name + ', s' : 'S'}eu plano está pronto!` : `Preparando seu plano${name ? ', ' + name : ''}…`}
        </h1>
        {phase !== 'done' && phase !== 'error' && (
          <p className="quiz-sub">Usamos as respostas do seu quiz. Leva alguns segundos.</p>
        )}
        <ul className="quiz-steps" style={{ textAlign: 'left', margin: '22px 0' }}>
          {items.map(([key, label]) => {
            const k = order.indexOf(key);
            return (
              <li key={key} className={at > k ? 'done' : at === k ? 'doing' : ''}>
                {label}
              </li>
            );
          })}
        </ul>
        {error && <p className="error-msg">{error}</p>}
        {(phase === 'done' || phase === 'error') && (
          <button className="btn" onClick={() => router.replace(afterPlan(phase === 'done' ? '/treino' : '/coach'))}>
            {phase === 'done' ? 'Ver meu plano' : 'Abrir o Coach'}
          </button>
        )}
      </div>
    </div>
  );
}
