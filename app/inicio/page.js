'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import WeekStrip from '@/components/WeekStrip';
import StartSheet from '@/components/StartSheet';
import BodyWeightCard from '@/components/BodyWeightCard';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { useDialog } from '@/components/Dialog';
import { fetchAllWorkouts, fetchPlan } from '@/lib/data';
import { todaysRoutine } from '@/lib/plan';
import { loadActive, activeUrl } from '@/lib/activeWorkout';
import { activityByDay, fmtKg, weekStreak, weeklySummary, workoutSets, workoutVolume } from '@/lib/stats';
import { setLabels } from '@/lib/sets';
import { IconTimer, IconSets, IconVolume, IconDumbbell, IconTrash, IconGear, IconFlame } from '@/components/Icons';

export default function InicioPage() {
  return (
    <AuthGuard>
      {(user) => <Accueil user={user} />}
    </AuthGuard>
  );
}

function Accueil({ user }) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [active, setActive] = useState(null);
  const [showStart, setShowStart] = useState(false);
  const [planInfo, setPlanInfo] = useState(null);
  const { t, tf, locale, exName } = useI18n();
  const dialog = useDialog();

  useEffect(() => {
    fetchAllWorkouts()
      .then(setWorkouts)
      .catch(() => setWorkouts([]));
    // Rotina de hoje pelo plano (semana fixa ou rotação)
    Promise.all([fetchPlan(user.id).catch(() => ({ plan: null })), supabase.from('routines').select('id, name')])
      .then(([p, r]) => setPlanInfo({ plan: p.plan, routines: r.data || [] }))
      .catch(() => {});
    const a = loadActive();
    if (a && a.userId === user.id) setActive(a);
  }, [user.id]);

  async function supprimer(id) {
    if (!(await dialog.confirm(t('confirmDeleteWorkout'), { danger: true, confirmLabel: t('delete') }))) return;
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(workouts.filter((w) => w.id !== id));
  }

  const week = workouts ? weeklySummary(workouts, 1)[0] : null;
  const todayId =
    planInfo?.plan && workouts
      ? todaysRoutine(planInfo.plan, { workouts, routineIds: planInfo.routines.map((r) => r.id) })
      : null;
  const todayRoutine = planInfo?.routines.find((r) => r.id === todayId) || null;
  const isRestDay = !!planInfo?.plan && planInfo.plan.mode !== 'rotation' && !todayRoutine;
  const streak = workouts ? weekStreak(workouts) : 0;
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <PageHeader
        title="Moviq"
        sub={today.charAt(0).toUpperCase() + today.slice(1)}
        action={
          <Link href="/perfil" className="round-btn" aria-label={t('settings')}>
            <IconGear size={24} />
          </Link>
        }
      />

      {/* Semana atual + treino de hoje */}
      <div className="card">
        <p className="muted" style={{ textAlign: 'center', fontSize: 17 }}>{t('thisWeek')}</p>
        <WeekStrip byDay={workouts ? activityByDay(workouts) : new Map()} locale={locale} />
        <button
          className="today-row"
          onClick={() =>
            active ? router.push(activeUrl(active)) : todayRoutine ? router.push(`/treino/executar?id=${todayRoutine.id}`) : setShowStart(true)
          }
        >
          <span className="today-icon">
            <IconDumbbell size={24} color="#fff" />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="today-kicker">{active ? t('workoutInProgress') : t('today')}</span>
            <span className="ellipsis" style={{ fontSize: 19, fontWeight: 600 }}>
              {active ? active.routineName : todayRoutine ? todayRoutine.name : isRestDay ? t('restDayToday') : t('noRoutineToday')}
            </span>
          </span>
          <span className="pill">{active ? t('continueWorkout') : t('startPill')}</span>
        </button>
      </div>

      <BodyWeightCard user={user} />

      {/* Sequência de semanas */}
      {workouts && workouts.length > 0 && (
        <div className="card">
          <p className="streak-title">
            <IconFlame size={26} color="var(--accent)" /> {tf(streak === 1 ? 'streakOne' : 'streakMany', { n: streak })}
          </p>
          <p className="muted" style={{ fontSize: 16, marginTop: 4 }}>
            {tf('streakSub', { week: week.workouts, total: workouts.length })} · {fmtKg(week.volume, locale)} kg
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
        workouts.slice(0, 20).map((w) => {
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
                  <button className="btn secondary small" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => router.push(`/treino/registro?id=${w.id}`)}>
                    {t('edit')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

      <BottomNav />
      {showStart && <StartSheet onClose={() => setShowStart(false)} />}
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
