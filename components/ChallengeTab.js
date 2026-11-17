'use client';

// Aba "Desafio" do Plano: Desafio 21 dias de calistenia (lib/challenge.js).
// Sem desafio: formulário para montar com o Coach (IA). Com desafio: 21 quadrados, um por dia,
// liberados um depois do outro; tocar num dia abre o treino dele.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { findExercise } from '@/lib/catalog';
import { useDialog } from '@/components/Dialog';
import { challengeProgress, CHALLENGE_LEVELS, CHALLENGE_MINUTES } from '@/lib/challenge';
import { createChallenge } from '@/lib/challengeCreate';
import { removeChallenge } from '@/lib/data';
import { IconCheck, IconTrophy } from '@/components/Icons';

export default function ChallengeTab({ user, plan, planMissing, routines, onChanged, onStart }) {
  const { t, tf, lang, exName } = useI18n();
  const dialog = useDialog();
  const challenge = plan.challenge || null;
  const [workouts, setWorkouts] = useState(null);
  const [form, setForm] = useState(false); // mostra o formulário mesmo com desafio (recomeçar)
  const [level, setLevel] = useState('beginner');
  const [minutes, setMinutes] = useState(30);
  const [notes, setNotes] = useState('');
  const [building, setBuilding] = useState(false);
  const [info, setInfo] = useState('');
  const [open, setOpen] = useState(null); // índice do dia aberto

  const ids = challenge ? challenge.days.map((d) => d.id) : [];
  const idsKey = ids.join(',');

  // Treinos feitos das rotinas do desafio (para marcar os dias concluídos)
  useEffect(() => {
    if (!ids.length) return setWorkouts([]);
    setWorkouts(null);
    supabase
      .from('workouts')
      .select('routine_id, started_at')
      .in('routine_id', ids)
      .then(({ data }) => setWorkouts(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const progress = challenge ? challengeProgress(challenge, workouts || []) : null;
  const routineOf = (i) => routines?.find((r) => r.id === challenge.days[i].id) || null;

  async function montar() {
    if (challenge && !(await dialog.confirm(t('chConfirmRestart'), { danger: true, confirmLabel: t('create') }))) return;
    setBuilding(true);
    setInfo('');
    const r = await createChallenge(user.id, { level, minutes, notes, lang });
    setBuilding(false);
    if (r.missing) return dialog.alert(t('planSetup'));
    if (r.error) return dialog.alert(t('saveError') + r.error.message);
    if (!r.fromAI) setInfo(t('chReadyUsed'));
    setForm(false);
    onChanged();
  }

  async function sair() {
    if (!(await dialog.confirm(t('chConfirmLeave'), { danger: true, confirmLabel: t('chLeave') }))) return;
    const r = await removeChallenge(user.id);
    if (r.error) return dialog.alert(t('saveError') + r.error.message);
    setInfo('');
    onChanged();
  }

  function tocar(i) {
    const s = progress.days[i];
    if (s === 'locked') return dialog.alert(tf('chLocked', { n: progress.next + 1 }));
    setOpen(i);
  }

  if (planMissing) {
    return (
      <div className="card">
        <p className="card-title">{t('chTitle')}</p>
        <p className="muted">{t('planSetup')}</p>
      </div>
    );
  }

  // ---------- Montar o desafio ----------
  if (!challenge || form) {
    return (
      <div className="card">
        <p className="card-title">{t('chTitle')}</p>
        <p className="muted" style={{ marginBottom: 6 }}>{t('chIntro')}</p>

        <label className="label">{t('coachLevel')}</label>
        <div className="seg">
          {CHALLENGE_LEVELS.map((l) => (
            <button key={l} className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>
              {t('level_' + l)}
            </button>
          ))}
        </div>

        <label className="label">{t('coachMinutes')}</label>
        <div className="seg">
          {CHALLENGE_MINUTES.map((m) => (
            <button key={m} className={minutes === m ? 'active' : ''} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>

        <label className="label">{t('coachNotes')}</label>
        <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('coachNotesPh')} />

        <button className="btn coach-btn" style={{ marginTop: 16 }} onClick={montar} disabled={building}>
          {building ? t('chBuilding') : t('chBuild')}
        </button>
        {challenge && (
          <button className="link-btn" style={{ display: 'block', margin: '12px auto 0' }} onClick={() => setForm(false)} disabled={building}>
            {t('back')}
          </button>
        )}
      </div>
    );
  }

  // ---------- Desafio em andamento ----------
  const day = open !== null ? routineOf(open) : null;
  return (
    <>
      <div className="card">
        <p className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconTrophy size={18} /> {t('chTitle')}
        </p>
        {challenge.summary && <p className="muted" style={{ marginBottom: 10 }}>{challenge.summary}</p>}
        {info && <p className="muted" style={{ marginBottom: 10, fontSize: 14 }}>{info}</p>}

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

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn secondary small" style={{ flex: 1 }} onClick={() => setForm(true)}>
          {t('chRestart')}
        </button>
        <button className="btn danger small" style={{ flex: 1 }} onClick={sair}>
          {t('chLeave')}
        </button>
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
