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
import { buildStarterPlan, STARTER_PLANS } from '@/lib/starter';
import { IconPlus, IconTrash, IconCalendar } from '@/components/Icons';

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
  const [routines, setRoutines] = useState(null);
  const [plan, setPlan] = useState(normalizePlan(null));
  const [planMissing, setPlanMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadRoutines = () =>
    supabase
      .from('routines')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setRoutines(data || []);
        return data || [];
      });

  useEffect(() => {
    loadRoutines();
    fetchPlan(user.id)
      .then((r) => {
        setPlan(normalizePlan(r.plan));
        setPlanMissing(r.missing);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

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
    router.push(`/treino/executar?id=${id}`);
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
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 9, 12 + i); // 12/10/2026 é segunda-feira
    return { n: i + 1, label: d.toLocaleDateString(locale, { weekday: 'long' }) };
  });
  const today = isoDay(new Date());

  return (
    <div className="page">
      <PageHeader title={t('tabPlan')} sub={t('planSub')} />

      <ActiveBanner userId={user.id} />

      {/* Semana fixa ou rotação */}
      <div className="card">
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={plan.mode === 'week' ? 'active' : ''} onClick={() => updatePlan({ ...plan, mode: 'week' })}>
            {t('planWeek')}
          </button>
          <button className={plan.mode === 'rotation' ? 'active' : ''} onClick={() => updatePlan({ ...plan, mode: 'rotation' })}>
            {t('planRotation')}
          </button>
        </div>

        {planMissing && <p className="muted">{t('planSetup')}</p>}

        {!planMissing && plan.mode === 'week' &&
          days.map((d) => (
            <div key={d.n} className="plan-row">
              <span className={`plan-day ${d.n === today ? 'today' : ''}`}>{d.label}</span>
              <select
                className="input"
                value={plan.week[d.n] || ''}
                onChange={(e) => {
                  const week = { ...plan.week };
                  if (e.target.value) week[d.n] = e.target.value;
                  else delete week[d.n];
                  updatePlan({ ...plan, week });
                }}
              >
                <option value="">{t('restDay')}</option>
                {(routines || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

        {!planMissing && plan.mode === 'rotation' && (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>{t('rotationHint')}</p>
            {plan.rotation.map((id, i) => (
              <div key={id + i} className="plan-row">
                <span className="plan-day">{String.fromCharCode(65 + i)}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{routineName(id)}</span>
                <button
                  className="icon-btn"
                  onClick={() => updatePlan({ ...plan, rotation: plan.rotation.filter((_, j) => j !== i) })}
                  aria-label={t('remove')}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
            <select
              className="input"
              value=""
              onChange={(e) => e.target.value && updatePlan({ ...plan, rotation: [...plan.rotation, e.target.value] })}
              style={{ marginTop: 8 }}
            >
              <option value="">+ {t('addToRotation')}</option>
              {(routines || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <button className="btn" onClick={() => router.push('/treino/nova')}>
        <IconPlus /> {t('createRoutine')}
      </button>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => router.push('/treino/registro')}>
        <IconCalendar size={18} /> {t('logPastWorkout')}
      </button>

      <p className="section-title">{t('myRoutines')}</p>

      {routines === null && <p className="muted">{t('loading')}</p>}
      {routines && routines.length === 0 && <p className="muted">{t('noRoutines')}</p>}

      {routines &&
        routines.map((r) => (
          <div key={r.id} className="card">
            <b style={{ fontSize: 18 }}>{r.name}</b>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              {(r.exercises || []).map((e) => exName(e)).join(' · ')}
            </p>

            <div className="thumb-strip" style={{ marginBottom: 12 }}>
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
        ))}

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

      <BottomNav />
    </div>
  );
}
