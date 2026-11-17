'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { startUrl } from '@/lib/circuit';
import { fetchPlan } from '@/lib/data';
import { normalizeChallenge, challengeProgress } from '@/lib/challenge';
import { IconCheck, IconPlay, IconPlus, IconTrophy } from '@/components/Icons';

// Folha do botão central "Iniciar": treino livre, os dias do Desafio 21 dias (se houver) e as rotinas.
// Os dias do desafio ficam numa seção própria, em ordem (1 a 21): feitos (✓, dá para refazer),
// o próximo (destacado) e os que ainda não abriram (apagados). Depois, separadas, as outras rotinas.
export default function StartSheet({ onClose }) {
  const router = useRouter();
  const { t, tf, exName } = useI18n();
  const [routines, setRoutines] = useState(null);
  const [challengeDays, setChallengeDays] = useState(null); // [{ n, routine, status }]

  useEffect(() => {
    (async () => {
      const [{ data }, session] = await Promise.all([
        supabase.from('routines').select('*').order('created_at', { ascending: false }),
        supabase.auth.getSession(),
      ]);
      const all = data || [];
      const userId = session.data.session?.user?.id;
      const plan = userId ? await fetchPlan(userId).catch(() => ({ plan: null })) : { plan: null };
      const challenge = normalizeChallenge(plan.plan?.challenge);
      if (!challenge) return setRoutines(all);
      const ids = new Set(challenge.days.map((d) => d.id));
      setRoutines(all.filter((r) => !ids.has(r.id)));
      const { data: done } = await supabase.from('workouts').select('routine_id, started_at').in('routine_id', [...ids]);
      const p = challengeProgress(challenge, done || []);
      setChallengeDays(
        challenge.days
          .map((d, i) => ({ n: i + 1, routine: all.find((r) => r.id === d.id) || null, status: p.days[i] }))
          .filter((d) => d.routine)
      );
    })().catch(() => setRoutines((r) => r || []));
  }, []);

  const go = (url) => {
    onClose();
    router.push(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }}>{t('startWorkout')}</b>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <button className="start-option" onClick={() => go('/treino/executar?livre=1')}>
            <span className="start-option-icon">
              <IconPlus size={20} />
            </span>
            <span style={{ textAlign: 'left' }}>
              <b style={{ display: 'block' }}>{t('emptyWorkout')}</b>
              <span className="muted">{t('emptyWorkoutHint')}</span>
            </span>
          </button>

          {challengeDays && challengeDays.length > 0 && (
            <>
              <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconTrophy size={16} /> {t('chTitle')}
              </p>
              {challengeDays.map(({ n, routine, status }) => {
                const locked = status === 'locked';
                return (
                  <button
                    key={routine.id}
                    className={`start-option ${locked ? 'ch-locked' : ''} ${status === 'next' ? 'ch-next' : ''}`}
                    onClick={() => !locked && go(startUrl(routine))}
                    disabled={locked}
                    aria-label={`${routine.name} (${status})`}
                  >
                    <span className={`start-option-icon ${status === 'locked' ? 'ch-num' : 'accent'}`}>
                      {status === 'done' ? <IconCheck size={18} color="#fff" /> : status === 'next' ? <IconPlay size={18} color="#fff" /> : n}
                    </span>
                    <span style={{ textAlign: 'left', minWidth: 0 }}>
                      <b style={{ display: 'block' }}>{routine.name}</b>
                      <span className="muted ellipsis">{(routine.exercises || []).map((e) => exName(e)).join(' · ')}</span>
                    </span>
                  </button>
                );
              })}
              <div className="start-divider" />
            </>
          )}

          <p className="section-title">{t('chooseRoutine')}</p>
          {routines === null && <p className="muted">{t('loading')}</p>}
          {routines && routines.length === 0 && <p className="muted">{t('noRoutines')}</p>}
          {routines &&
            routines.map((r) => (
              <button key={r.id} className="start-option" onClick={() => go(startUrl(r))}>
                <span className="start-option-icon accent">
                  <IconPlay size={18} color="#fff" />
                </span>
                <span style={{ textAlign: 'left', minWidth: 0 }}>
                  <b style={{ display: 'block' }}>{r.name}</b>
                  <span className="muted ellipsis">{(r.exercises || []).map((e) => exName(e)).join(' · ')}</span>
                </span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
