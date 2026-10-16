'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import { LineChart } from '@/components/Charts';
import { useI18n, exKey, findExercise } from '@/lib/i18n';
import { fetchAllWorkouts } from '@/lib/data';
import { exerciseHistory, exerciseSummary, fmtKg } from '@/lib/stats';
import { IconBack, IconTrophy } from '@/components/Icons';

export default function VerExercicioPage() {
  const { t } = useI18n();
  return (
    <AuthGuard>
      {() => (
        <Suspense fallback={<p className="muted">{t('loading')}</p>}>
          <Exercicio />
        </Suspense>
      )}
    </AuthGuard>
  );
}

function Exercicio() {
  const router = useRouter();
  const params = useSearchParams();
  const key = params.get('id');
  const { t, locale, exName, exMeta } = useI18n();
  const [workouts, setWorkouts] = useState(null);

  useEffect(() => {
    fetchAllWorkouts()
      .then(setWorkouts)
      .catch(() => setWorkouts([]));
  }, []);

  const history = useMemo(() => (workouts ? exerciseHistory(workouts, key, exKey) : []), [workouts, key]);
  const summary = useMemo(() => exerciseSummary(history), [history]);

  // Exercício do catálogo, ou o que veio salvo no histórico (exercícios antigos)
  const ex = findExercise({ id: key, gif: key }) || findLogged(workouts, key);

  const fmtDate = (d) => new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const series = history.filter((h) => h.best).map((h) => ({ x: h.date, y: h.best.est }));

  return (
    <div className="page">
      <div className="page-head" style={{ justifyContent: 'flex-start' }}>
        <button className="round-btn" onClick={() => router.back()} aria-label={t('back')}>
          <IconBack />
        </button>
      </div>

      {!ex && workouts && <p className="muted" style={{ marginTop: 16 }}>{t('exerciseNotFound')}</p>}

      {ex && (
        <>
          <div className="detail" style={{ maxWidth: 'none', margin: '12px 0' }}>
            <div className="detail-gif">
              <img src={ex.gif} alt={exName(ex)} />
            </div>
            <div style={{ padding: 16 }}>
              <b style={{ fontSize: 21, display: 'block' }}>{exName(ex)}</b>
              <p className="muted" style={{ marginTop: 4 }}>{exMeta(ex)}</p>
            </div>
          </div>

          {!workouts && <p className="muted">{t('loading')}</p>}

          {workouts && history.length === 0 && (
            <div className="card">
              <p className="muted">{t('notDoneYet')}</p>
            </div>
          )}

          {history.length > 0 && (
            <>
              <div className="stat-grid two">
                <div className="stat">
                  <b>{summary.best1RM ? `${fmtKg(summary.best1RM.est, locale)} kg` : '--'}</b>
                  <span className="muted">{t('best1rm')}</span>
                  {summary.best1RM && (
                    <small>
                      {fmtKg(summary.best1RM.weight, locale)} kg × {summary.best1RM.reps}
                    </small>
                  )}
                </div>
                <div className="stat">
                  <b>{fmtKg(summary.topWeight, locale)} kg</b>
                  <span className="muted">{t('topWeight')}</span>
                </div>
                <div className="stat">
                  <b>{summary.maxReps}</b>
                  <span className="muted">{t('maxReps')}</span>
                </div>
                <div className="stat">
                  <b>{summary.sessions}</b>
                  <span className="muted">{t('sessions')}</span>
                </div>
              </div>

              <div className="card">
                <p className="card-title">{t('progress1rm')}</p>
                {series.length >= 2 ? (
                  <LineChart points={series} locale={locale} />
                ) : (
                  <p className="muted">{t('needTwo')}</p>
                )}
              </div>

              <div className="card">
                <p className="card-title">{t('history')}</p>
                {[...history].reverse().map((h, i) => {
                  const isBest = summary.best1RM && h.best && h.best.est === summary.best1RM.est && h.date === summary.best1RM.date;
                  return (
                    <div key={h.workoutId + '-' + i} className="ex-row" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <b style={{ fontSize: 15 }}>{fmtDate(h.date)}</b>
                        <span className="muted">
                          {isBest && (
                            <span className="pr-badge" style={{ marginRight: 6 }}>
                              <IconTrophy size={11} /> {t('newRecord')}
                            </span>
                          )}
                          {h.best ? `${fmtKg(h.best.est, locale)} kg ${t('est1rm')}` : ''}
                        </span>
                      </div>
                      <p className="muted" style={{ marginTop: 4 }}>
                        {h.sets.map((s) => `${fmtKg(s.weight, locale)}×${s.reps}`).join('  ·  ')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}

// Para exercícios fora do catálogo: pega o registro salvo no treino
function findLogged(workouts, key) {
  for (const w of workouts || []) for (const e of w.exercises || []) if (exKey(e) === key) return e;
  return null;
}
