'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import BottomNav from '@/components/BottomNav';
import BodyWeightCard from '@/components/BodyWeightCard';
import { BarChart, Heatmap } from '@/components/Charts';
import { useI18n, exKey, findExercise } from '@/lib/i18n';
import PageHeader from '@/components/PageHeader';
import BodyMap from '@/components/BodyMap';
import { regionLevelsFromWorkouts, setsByMuscle } from '@/lib/muscles';
import { fetchAllWorkouts } from '@/lib/data';
import { activityByDay, bestByExercise, fmtDuration, fmtKg, totals, weekStreak, weeklySummary } from '@/lib/stats';
import { IconTrophy, IconDumbbell, IconCalendar, IconFlame, IconVolume } from '@/components/Icons';

const RANGES = [
  ['range7', 7],
  ['range30', 30],
  ['range90', 90],
  ['rangeAll', 0],
];

export default function EstatisticasPage() {
  return <AuthGuard>{(user) => <Stats user={user} />}</AuthGuard>;
}

function Stats({ user }) {
  const router = useRouter();
  const { t, locale, exName, muscleName } = useI18n();
  const [workouts, setWorkouts] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('volume');
  const [showAllPrs, setShowAllPrs] = useState(false);
  const [range, setRange] = useState(30);

  useEffect(() => {
    fetchAllWorkouts()
      .then(setWorkouts)
      .catch((e) => {
        setWorkouts([]);
        setError(e.message);
      });
  }, []);

  const data = useMemo(() => {
    if (!workouts) return null;
    const weeks = weeklySummary(workouts, 12);
    const prs = [...bestByExercise(workouts, exKey).entries()]
      .map(([key, b]) => ({ key, ...b }))
      .sort((a, b) => b.est - a.est);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      month: workouts.filter((w) => new Date(w.started_at) >= monthStart).length,
      total: totals(workouts),
      streak: weekStreak(workouts),
      byDay: activityByDay(workouts),
      weeks,
      prs,
    };
  }, [workouts]);

  const muscles = useMemo(() => {
    if (!workouts) return null;
    const since = range ? Date.now() - range * 864e5 : 0;
    const by = setsByMuscle(workouts, since, findExercise);
    return { by, levels: regionLevelsFromWorkouts(workouts, since, findExercise) };
  }, [workouts, range]);

  const weekLabel = (d) => d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });

  return (
    <div className="page">
      <PageHeader title={t('tabStats')} sub={t('statsSub')} />

      {!data && <p className="muted">{t('loading')}</p>}
      {error && <p className="error-msg">{t('errPrefix') + error}</p>}

      {data && (
        <>
          <div className="tile-grid">
            <div className="tile">
              <span className="tile-label"><IconDumbbell size={17} /> {t('tileWorkouts')}</span>
              <div className="tile-value">{data.total.workouts}</div>
            </div>
            <div className="tile">
              <span className="tile-label"><IconCalendar size={17} /> {t('thisMonth')}</span>
              <div className="tile-value">{data.month}</div>
            </div>
            <div className="tile">
              <span className="tile-label"><IconFlame size={17} /> {t('tileStreak')}</span>
              <div className="tile-value">{data.streak}</div>
            </div>
            <div className="tile">
              <span className="tile-label"><IconVolume size={17} /> {t('tileVolume')}</span>
              <div className="tile-value">
                {fmtKg(data.total.volume / 1000, locale)}
                <small>t</small>
              </div>
            </div>
          </div>

          {data.total.workouts === 0 && (
            <div className="card">
              <p className="muted">{t('noStats')}</p>
            </div>
          )}

          <div className="card">
            <p className="card-title">
              {t('activity')} <span className="muted">{t('lastMonths')}</span>
            </p>
            <Heatmap byDay={data.byDay} weeks={26} t={t} />
          </div>

          <div className="card">
            <p className="card-title">
              {t('muscleBalance')} <span className="muted">{t('bySets')}</span>
            </p>
            <div className="seg">
              {RANGES.map(([key, days]) => (
                <button key={key} className={range === days ? 'active' : ''} onClick={() => setRange(days)}>
                  {t(key)}
                </button>
              ))}
            </div>
            <BodyMap levels={muscles.levels} />
            {Object.keys(muscles.by).length === 0 ? (
              <p className="muted" style={{ textAlign: 'center' }}>{t('noMuscleData')}</p>
            ) : (
              <div className="tags" style={{ justifyContent: 'center' }}>
                {Object.entries(muscles.by)
                  .sort((x, y) => y[1] - x[1])
                  .map(([m, n]) => (
                    <span key={m} className="tag-chip">
                      {muscleName(m)} · {n}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="lang-switch" style={{ marginBottom: 12 }}>
              <button className={metric === 'volume' ? 'active' : ''} onClick={() => setMetric('volume')}>
                {t('weeklyVolume')}
              </button>
              <button className={metric === 'workouts' ? 'active' : ''} onClick={() => setMetric('workouts')}>
                {t('weeklyWorkouts')}
              </button>
            </div>
            <BarChart
              bars={data.weeks.map((w) => ({ label: weekLabel(w.start), value: metric === 'volume' ? w.volume : w.workouts }))}
              format={metric === 'volume' ? undefined : (v) => String(Math.round(v))}
            />
          </div>

          <div className="card">
            <p className="card-title">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconTrophy size={18} color="#facc15" /> {t('personalRecords')}
              </span>
              <span className="muted">{t('est1rm')}</span>
            </p>
            {data.prs.length === 0 && <p className="muted">{t('noStats')}</p>}
            {(showAllPrs ? data.prs : data.prs.slice(0, 8)).map((p) => {
              const cat = findExercise(p.ex) || p.ex;
              return (
                <button
                  key={p.key}
                  className="row-link"
                  onClick={() => router.push(`/exercicios/ver?id=${encodeURIComponent(p.key)}`)}
                >
                  {cat.gif && <img src={cat.gif} alt="" className="ex-thumb" loading="lazy" />}
                  <span style={{ minWidth: 0 }}>
                    <span className="ex-name ellipsis">{exName(p.ex)}</span>
                    <span className="muted">
                      {fmtKg(p.weight, locale)} kg × {p.reps} ·{' '}
                      {new Date(p.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                    </span>
                  </span>
                  <span className="row-right">
                    <b>{fmtKg(p.est, locale)}</b> <span className="muted">kg</span>
                  </span>
                </button>
              );
            })}
            {data.prs.length > 8 && !showAllPrs && (
              <button className="btn secondary small" style={{ marginTop: 10, width: '100%' }} onClick={() => setShowAllPrs(true)}>
                {t('showMore')}
              </button>
            )}
          </div>

          <BodyWeightCard user={user} />
        </>
      )}

      <BottomNav />
    </div>
  );
}
