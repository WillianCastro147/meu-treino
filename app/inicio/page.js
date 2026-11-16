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
import { fetchAllWorkouts, fetchBodyWeights, fetchPlan } from '@/lib/data';
import { findExercise, useCatalog } from '@/lib/catalog';
import { levelInfo, monthlyChallenges, recoveryNote, weekLeft } from '@/lib/engage';
import { RecoveryCard, ChallengesCard } from '@/components/HomeCards';
import { todaysRoutine } from '@/lib/plan';
import { startUrl, resultOfWorkout } from '@/lib/circuit';
import { useCircuitText } from '@/lib/circuitText';
import { loadActive, activeUrl } from '@/lib/activeWorkout';
import { activityByDay, dayKey, fmtKg, weekStart, weekStreak, workoutSets, workoutVolume } from '@/lib/stats';
import { setLabels } from '@/lib/sets';
import { IconTimer, IconSets, IconVolume, IconDumbbell, IconTrash, IconGear, IconFlame, IconChevron } from '@/components/Icons';

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
  const [weighins, setWeighins] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [hidden, setHidden] = useState({});
  const { t, tf, locale, exName } = useI18n();
  const { ready: catalogReady } = useCatalog();
  const dialog = useDialog();
  const ctext = useCircuitText();

  useEffect(() => {
    fetchAllWorkouts()
      .then(setWorkouts)
      .catch(() => setWorkouts([]));
    // Rotina de hoje pelo plano (semana fixa ou rotação)
    Promise.all([fetchPlan(user.id).catch(() => ({ plan: null })), supabase.from('routines').select('id, name, exercises')])
      .then(([p, r]) => setPlanInfo({ plan: p.plan, routines: r.data || [] }))
      .catch(() => {});
    // Pesagens (para o desafio "dias com pesagem"); sem a tabela, o desafio não aparece
    fetchBodyWeights()
      .then((r) => setWeighins(r.missing ? null : r.rows))
      .catch(() => setWeighins(null));
    setHidden(readHidden());
    const a = loadActive();
    if (a && a.userId === user.id) setActive(a);
    // Quiz feito com este e-mail e ainda não usado (ex.: entrou pelo link de confirmação): monta o plano
    Promise.resolve(supabase.rpc('get_my_quiz_lead'))
      .then(({ data }) => {
        if (Array.isArray(data) && data[0]) router.replace('/preparando');
      })
      .catch(() => {});
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function supprimer(id) {
    if (!(await dialog.confirm(t('confirmDeleteWorkout'), { danger: true, confirmLabel: t('delete') }))) return;
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(workouts.filter((w) => w.id !== id));
  }

  // Esconde um cartão até o próximo dia (recuperação) ou mês (desafios)
  function hide(card) {
    const next = { ...hidden, [card]: hideStamp(card) };
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, JSON.stringify(next));
    } catch {}
  }

  const plan = planInfo?.plan || null;
  const todayId =
    plan && workouts ? todaysRoutine(plan, { workouts, routineIds: planInfo.routines.map((r) => r.id) }) : null;
  const todayRoutine = planInfo?.routines.find((r) => r.id === todayId) || null;
  const isRestDay = !!plan && plan.mode !== 'rotation' && !todayRoutine;
  const streak = workouts ? weekStreak(workouts) : 0;
  const today = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  // Semana mostrada (setas): resumo e rótulo
  const shownStart = weekStart(new Date());
  shownStart.setDate(shownStart.getDate() + weekOffset * 7);
  const shownEnd = new Date(shownStart);
  shownEnd.setDate(shownStart.getDate() + 7);
  const shownWs = (workouts || []).filter((w) => {
    const x = new Date(w.started_at).getTime();
    return x >= shownStart.getTime() && x < shownEnd.getTime();
  });
  const shownVolume = shownWs.reduce((s, w) => s + workoutVolume(w), 0);
  const lastDay = new Date(shownEnd);
  lastDay.setDate(lastDay.getDate() - 1);
  const weekLabel =
    weekOffset === 0
      ? t('thisWeek')
      : weekOffset === -1
        ? t('lastWeek')
        : `${shownStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${lastDay.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
  const left = weekOffset === 0 && workouts ? weekLeft(plan, workouts) : null;
  const plannedDays = new Set(plan && plan.mode !== 'rotation' ? Object.keys(plan.week || {}).map(Number) : []);

  // Recuperação e desafios (o catálogo diz o músculo de cada exercício)
  const recovery =
    workouts && catalogReady && hidden.recovery !== hideStamp('recovery')
      ? recoveryNote(workouts, findExercise, { todayExercises: todayRoutine?.exercises || [] })
      : null;
  const challenges =
    workouts && workouts.length > 0 && hidden.challenges !== hideStamp('challenges')
      ? monthlyChallenges(workouts, weighins)
      : null;

  const todayCount = todayRoutine?.exercises?.length || 0;

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

      {/* Semana (com setas) + treino de hoje */}
      <div className="card">
        <WeekStrip
          byDay={workouts ? activityByDay(workouts) : new Map()}
          locale={locale}
          offset={weekOffset}
          onOffset={setWeekOffset}
          planned={plannedDays}
          label={weekLabel}
        />
        <p className="week-line">
          {left
            ? left.left === 0
              ? t('weekAllDone')
              : tf(left.left === 1 ? 'weekLeftOne' : 'weekLeftMany', { n: left.left, total: left.planned })
            : weekOffset === 0
              ? tf(shownWs.length === 1 ? 'weekDoneOne' : 'weekDoneMany', { n: shownWs.length })
              : tf(shownWs.length === 1 ? 'nWorkoutsOne' : 'nWorkoutsMany', { n: shownWs.length })}
          {shownVolume > 0 && <span className="muted"> · {fmtKg(shownVolume, locale)} kg</span>}
        </p>
        {left && (
          <div className="week-bar">
            <span style={{ width: `${((left.planned - left.left) / left.planned) * 100}%` }} />
          </div>
        )}
        {weekOffset === 0 && (
          <>
            <button
              className="today-row"
              onClick={() =>
                active ? router.push(activeUrl(active)) : todayRoutine ? router.push(startUrl(todayRoutine)) : setShowStart(true)
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
                {!active && todayRoutine && todayCount > 0 && (
                  <span className="muted" style={{ display: 'block', fontSize: 15 }}>
                    {tf(todayCount === 1 ? 'nExercisesOne' : 'nExercisesMany', { n: todayCount })}
                  </span>
                )}
              </span>
              <span className="pill">{active ? t('continueWorkout') : t('startPill')}</span>
            </button>
            {!active && (todayRoutine || isRestDay) && (
              <button className="link-btn" onClick={() => setShowStart(true)}>
                {t('pickOtherWorkout')}
              </button>
            )}
          </>
        )}
      </div>

      <RecoveryCard note={recovery} onClose={() => hide('recovery')} />
      <ChallengesCard list={challenges} locale={locale} onClose={() => hide('challenges')} />

      <BodyWeightCard user={user} />

      {/* Sequência de semanas: leva ao Progresso, onde estão medalhas e nível */}
      {workouts && workouts.length > 0 && (
        <Link href="/estatisticas" className="card streak-link">
          <span style={{ flex: 1 }}>
            <span className="streak-title">
              <IconFlame size={26} color="var(--accent)" /> {tf(streak === 1 ? 'streakOne' : 'streakMany', { n: streak })}
            </span>
            <span className="muted" style={{ display: 'block', fontSize: 16, marginTop: 4 }}>
              {tf('levelLine', { n: levelInfo(workouts).level })} · {tf('totalWorkouts', { n: workouts.length })}
            </span>
          </span>
          <IconChevron size={20} color="var(--muted)" />
        </Link>
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
                {resultOfWorkout(w) && <span className="circuit-badge">{ctext.result(resultOfWorkout(w))}</span>}

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

// Cartões fechados: guardam o dia (recuperação) ou o mês (desafios) em que foram fechados
const HIDE_KEY = 'moviq.home.hidden';
function hideStamp(card) {
  const k = dayKey(new Date());
  return card === 'challenges' ? k.slice(0, 7) : k;
}
function readHidden() {
  try {
    return JSON.parse(localStorage.getItem(HIDE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
