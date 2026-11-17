'use client';

// Quadro do Desafio 21 dias (lib/challenge.js): barra de progresso, 21 quadradinhos (foto do primeiro
// exercício do dia ao fundo, número por cima) e a folha com o treino do dia.
// Usado na aba Desafio do Plano (components/ChallengeTab.js) e na tela Início.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { findExercise } from '@/lib/catalog';
import { useDialog } from '@/components/Dialog';
import { challengeProgress } from '@/lib/challenge';
import { IconCheck, IconTrophy } from '@/components/Icons';

// challenge: plan.challenge normalizado; routines: rotinas do usuário (com exercises);
// onStart(routineId): começa o treino do dia; children: texto extra abaixo do título
export default function ChallengeBoard({ challenge, routines, onStart, children }) {
  const { t, tf, exName } = useI18n();
  const dialog = useDialog();
  const [workouts, setWorkouts] = useState(null);
  const [open, setOpen] = useState(null); // índice do dia aberto

  const ids = challenge.days.map((d) => d.id);
  const idsKey = ids.join(',');

  // Treinos feitos das rotinas do desafio (para marcar os dias concluídos)
  useEffect(() => {
    setWorkouts(null);
    supabase
      .from('workouts')
      .select('routine_id, started_at')
      .in('routine_id', ids)
      .then(({ data }) => setWorkouts(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const progress = challengeProgress(challenge, workouts || []);
  const routineOf = (i) => routines?.find((r) => r.id === challenge.days[i].id) || null;

  function tocar(i) {
    if (progress.days[i] === 'locked') return dialog.alert(tf('chLocked', { n: progress.next + 1 }));
    setOpen(i);
  }

  const day = open !== null ? routineOf(open) : null;
  return (
    <>
      <div className="card">
        <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconTrophy size={18} /> {t('chTitle')}
        </p>
        {children}

        <div className="ch-bar" aria-hidden="true">
          <span style={{ width: `${((progress?.done || 0) / 21) * 100}%` }} />
        </div>
        <p style={{ fontWeight: 700, margin: '8px 0 14px' }}>{workouts === null ? t('loading') : tf('chProgress', { n: progress.done })}</p>

        <div className="ch-grid">
          {challenge.days.map((d, i) => {
            const s = progress?.days[i] || 'locked';
            // Foto do primeiro exercício do dia no fundo, transparente, com o número por cima
            const first = routineOf(i)?.exercises?.[0];
            const img = first ? findExercise(first)?.gif || first.gif : null;
            return (
              <button key={d.id} className={`ch-cell ${s}`} onClick={() => tocar(i)} aria-label={`${tf('chDay', { n: i + 1 })} (${s})`}>
                {img && <img src={img} alt="" className="ch-cell-img" loading="lazy" />}
                <b className="ch-cell-num">{i + 1}</b>
                {s === 'done' && (
                  <span className="ch-cell-check">
                    <IconCheck size={11} color="#fff" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {progress?.finished && (
          <p className="ch-finished">
            <IconTrophy size={18} /> {t('chFinished')}
          </p>
        )}

        {progress && !progress.finished && workouts !== null && (
          <button className="btn" style={{ marginTop: 16 }} onClick={() => setOpen(progress.next)}>
            {tf('chStartDay', { n: progress.next + 1 })}
          </button>
        )}
      </div>

      {open !== null && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <b style={{ fontSize: 18 }} className="ellipsis">
                {day?.name || tf('chDay', { n: open + 1 })}
              </b>
              <button onClick={() => setOpen(null)} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {challenge.days[open].notes && <p className="muted" style={{ marginBottom: 10 }}>{challenge.days[open].notes}</p>}
              {(day?.exercises || []).map((x, k) => (
                <div key={x.id + k} className="row-link" style={{ cursor: 'default' }}>
                  <img src={findExercise(x)?.gif || x.gif} alt="" className="ex-thumb" loading="lazy" />
                  <span style={{ minWidth: 0 }}>
                    <span className="ex-name ellipsis">{exName(x)}</span>
                    <span className="muted">
                      {x.sets} × {x.reps} · {x.rest}s
                    </span>
                  </span>
                </div>
              ))}
              {day && (
                <button className="btn" style={{ marginTop: 14 }} onClick={() => onStart(day.id)}>
                  {progress.days[open] === 'done' ? t('chRedoDay') : tf('chStartDay', { n: open + 1 })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
