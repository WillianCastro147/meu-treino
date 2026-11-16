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
import { activityByDay, bestByExercise, fmtDuration, fmtKg, totals, weeklySummary } from '@/lib/stats';
import { funComparison, levelInfo, MAX_FREEZES, streakInfo } from '@/lib/engage';
import { IconTrophy, IconFlame, IconVolume } from '@/components/Icons';

const TABS = ['overview', 'body', 'records'];

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
  const { t, tf, locale, exName, muscleName } = useI18n();
  const [workouts, setWorkouts] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('volume');
  const [showAllPrs, setShowAllPrs] = useState(false);
  const [range, setRange] = useState(30);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('moviq.stats.tab');
      if (TABS.includes(saved)) setTab(saved);
    } catch {}
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
      streakInfo: streakInfo(workouts),
      level: levelInfo(workouts),
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
  const fun = data ? funComparison(data.total.volume) : null;
  const streak = data?.streakInfo;
  const level = data?.level;

  function pickTab(k) {
    setTab(k);
    try {
      localStorage.setItem('moviq.stats.tab', k);
    } catch {}
  }

  return (
    <div className="page">
      <PageHeader title={t('tabStats')} sub={t('statsSub')} />

      {!data && <p className="muted">{t('loading')}</p>}
      {error && <p className="error-msg">{t('errPrefix') + error}</p>}

      {data && (
        <>
          <div className="seg stats-tabs">
            {TABS.map((k) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => pickTab(k)}>
                {t('stab_' + k)}
              </button>
            ))}
          </div>

          {data.total.workouts === 0 && (
            <div className="card">
              <p className="muted">{t('noStats')}</p>
            </div>
          )}

          {tab === 'overview' && (
            <>
              {/* Total levantado, com uma comparação para dar escala */}
              <div className="card">
                <span className="tile-label"><IconVolume size={17} /> {t('liftedTotal')}</span>
                <div className="lifted-value">
                  {fmtKg(data.total.volume / 1000, locale)}
                  <small> t</small>
                </div>
                {fun && <p className="muted lifted-fun">{tf('fun_' + fun.key, { n: fmtKg(fun.times, locale) })}</p>}
                <div className="lifted-row">
                  <span>
                    <b>{data.total.workouts}</b>
                    <small>{t('tileWorkouts')}</small>
                  </span>
                  <span>
                    <b>{data.month}</b>
                    <small>{t('thisMonth')}</small>
                  </span>
                  <span>
                    <b>{fmtDuration(data.total.minutes)}</b>
                    <small>{t('trainedTime')}</small>
                  </span>
                  <span>
                    <b>{fmtKg(data.total.sets, locale)}</b>
                    <small>{t('sets')}</small>
                  </span>
                </div>
              </div>

              {/* Sequência: semanas seguidas, congelamentos, medalhas e nível */}
              <div className="card">
                <div className="streak-top">
                  <p className="streak-title">
                    <IconFlame size={26} color="var(--accent)" /> {tf(streak.current === 1 ? 'streakOne' : 'streakMany', { n: streak.current })}
                  </p>
                  <span className="freezes" aria-label={tf('freezesCount', { n: streak.freezes })}>
                    {Array.from({ length: MAX_FREEZES }, (_, i) => (
                      <span key={i} className={i < streak.freezes ? 'on' : ''}>❄</span>
                    ))}
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 15, marginTop: 4 }}>
                  {tf('bestStreak', { n: streak.best })}
                  {streak.nextBadge ? ' · ' + tf('toNextBadge', { n: streak.nextBadge - streak.current }) : ''}
                </p>
                <div className="badges">
                  {streak.badges.map((b) => (
                    <span key={b.weeks} className={`badge ${b.earned ? 'earned' : ''}`}>
                      <b>{b.weeks}</b>
                      <small>{t('weeksShort')}</small>
                    </span>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>{t('freezesHint')}</p>
                <div className="level-row">
                  <span className="level-chip">{tf('levelLine', { n: level.level })}</span>
                  <div className="level-bar">
                    <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
                  </div>
                  <span className="muted" style={{ fontSize: 14 }}>{tf('levelToNext', { n: level.toNext })}</span>
                </div>
              </div>

              <div className="card">
                <p className="card-title">
                  {t('activity')} <span className="muted">{t('lastMonths')}</span>
                </p>
                <Heatmap byDay={data.byDay} weeks={26} t={t} />
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
            </>
          )}

          {tab === 'body' && (
            <>
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
                  <div className="muscle-bars">
                    {Object.entries(muscles.by)
                      .sort((x, y) => y[1] - x[1])
                      .map(([m, n], i, arr) => (
                        <div key={m} className="muscle-bar">
                          <span className="ellipsis">{muscleName(m)}</span>
                          <div>
                            <span style={{ width: `${(n / arr[0][1]) * 100}%` }} />
                          </div>
                          <b>{n}</b>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <BodyWeightCard user={user} />
            </>
          )}

          {tab === 'records' && (
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
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}
