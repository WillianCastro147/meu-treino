'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import PageHeader from '@/components/PageHeader';
import ActiveBanner from '@/components/ActiveBanner';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';
import { findExercise, loadCatalog } from '@/lib/catalog';
import { useDialog } from '@/components/Dialog';
import { loadActive, clearActive } from '@/lib/activeWorkout';
import { fetchPlan, savePlan } from '@/lib/data';
import { normalizePlan, prunePlan, isoDay } from '@/lib/plan';
import { circuitOfRoutine, startUrl } from '@/lib/circuit';
import { useCircuitText } from '@/lib/circuitText';
import { buildStarterPlan, STARTER_PLANS } from '@/lib/starter';
import { challengeRoutineIds } from '@/lib/challenge';
import ChallengeTab from '@/components/ChallengeTab';
import { IconPlus, IconTrash, IconCalendar, IconChart, IconDumbbell, IconChevron, IconCheck } from '@/components/Icons';

const PLAN_TABS = ['schedule', 'challenge', 'routines'];

export default function TreinoPage() {
  return <AuthGuard>{(user) => <Plano user={user} />}</AuthGuard>;
}

const STARTERS = [
  ['ppl', 'planPPL', 'planPPLDesc'],
  ['upper-lower', 'planUL', 'planULDesc'],
  ['full-body', 'planFB', 'planFBDesc'],
  ['5x5', 'plan5x5', 'plan5x5Desc'],
];

function Plano({ user }) {
  const router = useRouter();
  const { t, tf, lang, locale, exName } = useI18n();
  const dialog = useDialog();
  const ctext = useCircuitText();
  const [routines, setRoutines] = useState(null);
  const [plan, setPlan] = useState(normalizePlan(null));
  const [planMissing, setPlanMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('schedule');
  const [picker, setPicker] = useState(null); // folha de escolha: { kind: 'day', n, label } | { kind: 'rotation' }

  const loadRoutines = () =>
    supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setRoutines(data || []);
        return data || [];
      });

  const loadPlan = () =>
    fetchPlan(user.id)
      .then((r) => {
        setPlan(normalizePlan(r.plan));
        setPlanMissing(r.missing);
      })
      .catch(() => {});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('moviq.plan.tab');
      if (PLAN_TABS.includes(saved)) setTab(saved);
    } catch {}
    loadRoutines();
    loadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Rotinas do Desafio 21 dias ficam só na aba Desafio
  const challengeIds = challengeRoutineIds(plan);
  const ownRoutines = routines ? routines.filter((r) => !challengeIds.has(r.id)) : null;

  async function updatePlan(next) {
    setPlan(next);
    const { error, missing } = await savePlan(user.id, next);
    if (missing) setPlanMissing(true);
    else if (error) dialog.alert(t('saveError') + error.message);
  }

  async function supprimer(id) {
    if (!(await dialog.confirm(t('confirmDeleteRoutine'), { danger: true, confirmLabel: t('delete') }))) return;
    await supabase.from('routines').delete().eq('id', id);
    const left = routines.filter((r) => r.id !== id);
    setRoutines(left);
    if (!planMissing) updatePlan(prunePlan(plan, left.map((r) => r.id)));
  }

  // Se já existe outro treino em andamento, pergunta antes de descartá-lo
  async function demarrer(id) {
    const active = loadActive();
    if (active && active.userId === user.id && (active.routineId || null) !== id) {
      const ok = await dialog.confirm(`${t('workoutInProgress')}: ${active.routineName}. ${t('confirmDiscard')}`, {
        danger: true,
        confirmLabel: t('discard'),
      });
      if (!ok) return;
      clearActive();
    }
    router.push(startUrl(routines.find((r) => r.id === id) || { id }));
  }

  // Plano pronto: cria as rotinas e monta a semana
  async function usarPlanoPronto(planId, nameKey) {
    if (!(await dialog.confirm(tf('confirmStarter', { name: t(nameKey) }), { confirmLabel: t('create') }))) return;
    setBusy(true);
    await loadCatalog();
    const built = buildStarterPlan(planId, lang, (id) => findExercise({ id }));
    const { data, error } = await supabase
      .from('routines')
      .insert(built.routines.map((r) => ({ user_id: user.id, name: r.name, exercises: r.exercises })))
      .select('id');
    setBusy(false);
    if (error) return dialog.alert(t('saveError') + error.message);
    const idByKey = Object.fromEntries(built.routines.map((r, i) => [r.key, data[i].id]));
    const week = Object.fromEntries(built.schedule.map(([day, key]) => [day, idByKey[key]]));
    await loadRoutines();
    if (!planMissing) updatePlan({ ...plan, mode: 'week', week });
  }

  const routineName = (id) => routines?.find((r) => r.id === id)?.name || '';
  const routineById = (id) => routines?.find((r) => r.id === id) || null;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 9, 12 + i); // 12/10/2026 é segunda-feira
    return { n: i + 1, label: d.toLocaleDateString(locale, { weekday: 'long' }), short: d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 3) };
  });
  const today = isoDay(new Date());
  const countLine = (r) => {
    const n = r?.exercises?.length || 0;
    return tf(n === 1 ? 'nExercisesOne' : 'nExercisesMany', { n });
  };

  function pickTab(k) {
    setTab(k);
    try {
      localStorage.setItem('moviq.plan.tab', k);
    } catch {}
  }

  // Escolha feita na folha: dia da semana (ou descanso) ou item novo da rotação
  function choose(id) {
    if (picker.kind === 'day') {
      const week = { ...plan.week };
      if (id) week[picker.n] = id;
      else delete week[picker.n];
      updatePlan({ ...plan, week });
    } else if (id) {
      updatePlan({ ...plan, rotation: [...plan.rotation, id] });
    }
    setPicker(null);
  }

  return (
    <div className="page">
      <PageHeader title={t('tabPlan')} sub={t('planSub')} />

      <ActiveBanner userId={user.id} />

      <div className="seg" style={{ marginBottom: 14 }}>
        {PLAN_TABS.map((k) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => pickTab(k)}>
            {t('ptab_' + k)}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          {/* Como você treina: semana fixa ou rotação */}
          <div className="card">
            <p className="card-title">{t('howYouTrain')}</p>
            <div className="mode-pick">
              {[
                ['week', 'planWeek', 'planWeekHint'],
                ['rotation', 'planRotation', 'rotationHint'],
              ].map(([m, label, hint]) => (
                <button key={m} className={plan.mode === m ? 'on' : ''} onClick={() => updatePlan({ ...plan, mode: m })} disabled={planMissing}>
                  <span className="mode-radio" />
                  <span>
                    <b>{t(label)}</b>
                    <small className="muted">{t(hint)}</small>
                  </span>
                </button>
              ))}
            </div>
            {planMissing && <p className="muted" style={{ marginTop: 10 }}>{t('planSetup')}</p>}
          </div>

          {!planMissing && plan.mode === 'week' && (
            <div className="card" style={{ padding: '6px 14px' }}>
              {days.map((d) => {
                const r = routineById(plan.week[d.n]);
                return (
                  <button key={d.n} className={`day-row ${d.n === today ? 'today' : ''}`} onClick={() => setPicker({ kind: 'day', n: d.n, label: d.label })}>
                    <span className="day-badge">{d.short}</span>
                    <span className={`day-icon ${r ? '' : 'rest'}`}>{r ? <IconDumbbell size={18} /> : <IconMoon />}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ellipsis" style={{ fontWeight: 600, display: 'block' }}>{r ? r.name : t('restDay')}</span>
                      <small className="muted">{r ? countLine(r) : d.label}</small>
                    </span>
                    <IconChevron size={18} color="var(--muted)" />
                  </button>
                );
              })}
            </div>
          )}

          {!planMissing && plan.mode === 'rotation' && (
            <div className="card" style={{ padding: '6px 14px' }}>
              {plan.rotation.length === 0 && <p className="muted" style={{ padding: '10px 0' }}>{t('rotationEmpty')}</p>}
              {plan.rotation.map((id, i) => (
                <div key={id + i} className="day-row">
                  <span className="day-badge">{String.fromCharCode(65 + i)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="ellipsis" style={{ fontWeight: 600, display: 'block' }}>{routineName(id)}</span>
                    <small className="muted">{countLine(routineById(id))}</small>
                  </span>
                  <button
                    className="icon-btn"
                    style={{ alignSelf: 'center' }}
                    onClick={() => updatePlan({ ...plan, rotation: plan.rotation.filter((_, j) => j !== i) })}
                    aria-label={t('remove')}
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
              <button className="link-btn" style={{ padding: '12px 0' }} onClick={() => setPicker({ kind: 'rotation' })}>
                + {t('addToRotation')}
              </button>
            </div>
          )}

          <button className="btn coach-btn" onClick={() => router.push('/coach')}>
            <IconChart size={18} /> {t('coachButton')}
          </button>

          {/* Planos prontos */}
          <p className="section-title">{t('starterPlans')}</p>
          <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>{t('starterHint')}</p>
          <div className="tile-grid">
            {STARTERS.map(([id, nameKey, descKey]) => (
              <button key={id} className="tile starter" disabled={busy} onClick={() => usarPlanoPronto(id, nameKey)}>
                <span style={{ fontSize: 18, fontWeight: 800, display: 'block' }}>{t(nameKey)}</span>
                <span className="muted" style={{ display: 'block', marginTop: 4 }}>
                  {tf(descKey, { n: STARTER_PLANS[id].schedule.length })}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'challenge' && (
        <ChallengeTab
          user={user}
          plan={plan}
          planMissing={planMissing}
          routines={routines}
          onChanged={() => Promise.all([loadRoutines(), loadPlan()])}
          onStart={demarrer}
        />
      )}

      {tab === 'routines' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => router.push('/treino/nova')}>
              <IconPlus /> {t('createRoutine')}
            </button>
            <button className="btn secondary" style={{ flex: 1 }} onClick={() => router.push('/treino/registro')}>
              <IconCalendar size={18} /> {t('logPastWorkout')}
            </button>
          </div>

          {ownRoutines === null && <p className="muted">{t('loading')}</p>}
          {ownRoutines && ownRoutines.length === 0 && (
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="muted">{t('noRoutines')}</p>
              <button className="link-btn" style={{ marginTop: 8 }} onClick={() => pickTab('schedule')}>
                {t('starterPlans')}
              </button>
            </div>
          )}

          {ownRoutines &&
            ownRoutines.map((r) => {
              const onDays = Object.entries(plan.week || {})
                .filter(([, id]) => id === r.id)
                .sort((a, b) => a[0] - b[0])
                .map(([n]) => days[Number(n) - 1]?.short);
              return (
                <div key={r.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <b style={{ fontSize: 18 }} className="ellipsis">{r.name}</b>
                    {plan.mode === 'week' && onDays.length > 0 && <span className="muted" style={{ fontSize: 14, flexShrink: 0 }}>{onDays.join(' · ')}</span>}
                  </div>
                  <p className="muted" style={{ fontSize: 15, marginTop: 2 }}>{countLine(r)}</p>
                  {circuitOfRoutine(r.exercises) && <span className="circuit-badge" style={{ display: 'table' }}>{ctext.line(circuitOfRoutine(r.exercises))}</span>}

                  <div className="thumb-strip" style={{ margin: '10px 0 12px' }}>
                    {(r.exercises || []).slice(0, 5).map(
                      (e, i) => e.gif && <img key={i} src={findExercise(e)?.gif || e.gif} alt={exName(e)} className="strip-thumb" loading="lazy" />
                    )}
                    {(r.exercises || []).length > 5 && <span className="strip-more">+{r.exercises.length - 5}</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn small" style={{ flex: 1 }} onClick={() => demarrer(r.id)}>
                      {t('start')}
                    </button>
                    <button className="btn secondary small" onClick={() => router.push(`/treino/nova?id=${r.id}`)}>
                      {t('edit')}
                    </button>
                    <button className="btn danger small" onClick={() => supprimer(r.id)} aria-label={t('delete')}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })}
        </>
      )}

      {picker && (
        <div className="modal-overlay" onClick={() => setPicker(null)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <b style={{ fontSize: 18 }} className="ellipsis">
                {picker.kind === 'day' ? picker.label.charAt(0).toUpperCase() + picker.label.slice(1) : t('addToRotation')}
              </b>
              <button onClick={() => setPicker(null)} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
                ✕
              </button>
            </div>
            <div className="modal-body menu-list">
              {picker.kind === 'day' && (
                <button className={`pick-row ${!plan.week[picker.n] ? 'on' : ''}`} onClick={() => choose(null)}>
                  <span className="day-icon rest"><IconMoon /></span>
                  <span style={{ flex: 1 }}>{t('restDay')}</span>
                  {!plan.week[picker.n] && <IconCheck size={18} color="var(--accent)" />}
                </button>
              )}
              {(ownRoutines || []).map((r) => {
                const on = picker.kind === 'day' && plan.week[picker.n] === r.id;
                return (
                  <button key={r.id} className={`pick-row ${on ? 'on' : ''}`} onClick={() => choose(r.id)}>
                    <span className="day-icon"><IconDumbbell size={18} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ellipsis" style={{ display: 'block' }}>{r.name}</span>
                      <small className="muted">{countLine(r)}</small>
                    </span>
                    {on && <IconCheck size={18} color="var(--accent)" />}
                  </button>
                );
              })}
              {ownRoutines && ownRoutines.length === 0 && <p className="muted">{t('noRoutines')}</p>}
              <button className="link-btn" style={{ padding: '12px 0' }} onClick={() => router.push('/treino/nova')}>
                + {t('createRoutine')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
);
