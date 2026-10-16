'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useDialog } from '@/components/Dialog';
import ActiveBanner from '@/components/ActiveBanner';
import { fmtDuration, fmtKg, weekStreak, weeklySummary, workoutSets, workoutVolume } from '@/lib/stats';
import { setLabels } from '@/lib/sets';
import { IconTimer, IconSets, IconVolume, IconDumbbell, IconTrash, IconGear } from '@/components/Icons';

export default function InicioPage() {
  return (
    <AuthGuard>
      {(user) => <Accueil user={user} />}
    </AuthGuard>
  );
}

function Accueil({ user }) {
  const [workouts, setWorkouts] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const { t, locale, exName } = useI18n();
  const dialog = useDialog();

  useEffect(() => {
    supabase
      .from('workouts')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setWorkouts(data || []));
  }, []);

  async function supprimer(id) {
    if (!(await dialog.confirm(t('confirmDeleteWorkout'), { danger: true, confirmLabel: t('delete') }))) return;
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(workouts.filter((w) => w.id !== id));
  }

  const week = workouts ? weeklySummary(workouts, 1)[0] : null;
  // Sequência calculada com os 50 treinos mais recentes já carregados
  const streak = workouts ? weekStreak(workouts) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('tabHome')}</h1>
        <Link href="/perfil" className="round-btn" aria-label={t('settings')}>
          <IconGear size={20} />
        </Link>
      </div>

      <ActiveBanner userId={user.id} />

      {week && workouts.length > 0 && (
        <div className="card">
          <p className="card-title">{t('thisWeek')}</p>
          <div className="stat-grid" style={{ marginBottom: 0 }}>
            <div className="stat" style={{ background: 'var(--card2)' }}>
              <b>{week.workouts}</b>
              <span className="muted">{t('sessions')}</span>
            </div>
            <div className="stat" style={{ background: 'var(--card2)' }}>
              <b>{fmtDuration(week.minutes)}</b>
              <span className="muted">{t('trainingTime')}</span>
            </div>
            <div className="stat" style={{ background: 'var(--card2)' }}>
              <b>{streak}</b>
              <span className="muted">{t('weekStreak')}</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            {t('volume')}: <b style={{ color: 'var(--text)' }}>{fmtKg(week.volume, locale)} kg</b> · {week.sets} {t('sets')}
          </p>
        </div>
      )}

      {workouts && workouts.length > 0 && <p className="section-title" style={{ marginTop: 8 }}>{t('recentWorkouts')}</p>}

      {workouts === null && <p className="muted">{t('loading')}</p>}

      {workouts && workouts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <IconDumbbell size={48} color="var(--accent)" />
          </div>
          <p style={{ fontWeight: 700, margin: '8px 0 4px', fontSize: 17 }}>
            {t('noWorkouts')}
          </p>
          <p className="muted">{t('noWorkoutsHint')}</p>
        </div>
      )}

      {workouts &&
        workouts.map((w) => {
          const exs = w.exercises || [];
          const volume = workoutVolume(w);
          const totalSets = workoutSets(w);
          const isOpen = expanded === w.id;

          return (
            <div key={w.id} className="card">
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : w.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: 18 }}>{w.name}</b>
                  <span className="muted">{formatDate(w.started_at, locale)}</span>
                </div>

                <p className="muted stat-line">
                  <IconTimer /> {w.duration_min} min
                  <IconSets /> {totalSets} {t('sets')}
                  <IconVolume /> {fmtKg(volume, locale)} kg
                </p>

                {/* Miniatures des exercices de la routine */}
                <div className="thumb-strip">
                  {exs.slice(0, 5).map(
                    (ex, i) =>
                      ex.gif && (
                        <img key={i} src={ex.gif} alt={exName(ex)} className="strip-thumb" loading="lazy" />
                      )
                  )}
                  {exs.length > 5 && <span className="strip-more">+{exs.length - 5}</span>}
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {exs.map((ex, i) => (
                    <div key={i} className="ex-row">
                      {ex.gif && <img src={ex.gif} alt="" className="ex-thumb" loading="lazy" />}
                      <div>
                        <p className="ex-name">{exName(ex)}</p>
                        <p className="muted">
                          {(() => {
                            const labels = setLabels(ex.sets);
                            // W / D / F na frente das séries especiais (aquecimento, drop, falha)
                            return ex.sets
                              .map((s, si) => (s.done ? `${/\d/.test(labels[si]) ? '' : labels[si] + ' '}${s.weight || 0}kg × ${s.reps || 0}` : null))
                              .filter(Boolean)
                              .join('  ·  ');
                          })() || t('noSetsDone')}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button className="btn danger small" style={{ marginTop: 10 }} onClick={() => supprimer(w.id)}>
                    <IconTrash /> {t('delete')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

      <BottomNav />
    </div>
  );
}

function formatDate(iso, locale) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  );
}
