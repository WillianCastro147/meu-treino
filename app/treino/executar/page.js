'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import ExercisePicker from '@/components/ExercisePicker';
import ExerciseDetail from '@/components/ExerciseDetail';
import { useDialog } from '@/components/Dialog';
import { supabase } from '@/lib/supabase';
import { useI18n, exKey, findExercise } from '@/lib/i18n';
import { muscleOf } from '@/lib/muscles';
import { loadActive, saveActive, clearActive } from '@/lib/activeWorkout';
import { fetchAllWorkouts } from '@/lib/data';
import { bestByExercise, findRecords, fmtKg, isSetRecord, workoutSets, workoutVolume } from '@/lib/stats';
import { RPE_VALUES, rpeToRir, rirToRpe, setLabels, setType, SET_TYPES } from '@/lib/sets';
import { applySuggestion, suggestNext } from '@/lib/progression';
import { afterSetDone, cleanLinks, supersetLabels } from '@/lib/superset';
import { loadEffortScale } from '@/lib/prefs';
import PlateCalculator from '@/components/PlateCalculator';
import ExerciseMedia from '@/components/ExerciseMedia';
import { IconCheck, IconPlus, IconRest, IconTrash, IconTrophy, IconPlate, IconClose, IconArrowUp } from '@/components/Icons';

const TYPE_LABEL = { normal: 'setNormal', warmup: 'setWarmup', drop: 'setDrop', failure: 'setFailure' };
const TYPE_TAG = { normal: '1', warmup: 'W', drop: 'D', failure: 'F' };

export default function ExecutarPage() {
  const { t } = useI18n();
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">{t('loading')}</p>}>
          <Seance user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

function Seance({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const routineId = params.get('id');
  const livre = !routineId && params.get('livre') === '1'; // treino sem rotina
  const { t, tf, locale, exName, muscleName } = useI18n();
  const dialog = useDialog();

  const [lastLog, setLastLog] = useState(null); // exKey -> registro do exercício no último treino
  const [effort, setEffort] = useState('off'); // escala de esforço: off | rpe | rir
  const [setMenu, setSetMenu] = useState(null); // { ei, si } da série com o menu aberto
  const [plates, setPlates] = useState(null); // { ei, si, weight } da calculadora de anilhas
  const fresh = useRef(false); // treino novo (não restaurado): recebe a sugestão de carga
  const prefilled = useRef(false);
  const [routine, setRoutine] = useState(null);
  const [exs, setExs] = useState([]); // [{id, name, gif, rest, sets: [{weight, reps, done}]}]
  const [startedAt, setStartedAt] = useState(null); // ms
  const [restEndsAt, setRestEndsAt] = useState(null); // ms
  const [now, setNow] = useState(Date.now());
  const [previous, setPrevious] = useState({}); // exKey -> [{weight, reps}]
  const [history, setHistory] = useState([]); // todos os treinos anteriores
  const [bests, setBests] = useState(new Map()); // exKey -> melhor 1RM estimado
  const [showPicker, setShowPicker] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(null); // resumo exibido ao finalizar
  const audioRef = useRef(null);
  const ready = useRef(false);

  // Relógio baseado no horário real (não atrasa com a tela bloqueada)
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const i = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(i);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // Mantém a tela acesa durante o treino
  useEffect(() => {
    let lock = null;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      try {
        lock && lock.release();
      } catch (e) {}
    };
  }, []);

  // Carrega a rotina (ou prepara o treino livre) e restaura o treino em andamento (se houver)
  useEffect(() => {
    if (!routineId && !livre) return;

    const begin = (data) => {
      setRoutine(data);
      const saved = loadActive();
      if (saved && (saved.routineId || null) === (routineId || null) && saved.userId === user.id) {
        setExs(saved.exs);
        setStartedAt(saved.startedAt);
        setRestEndsAt(saved.restEndsAt && saved.restEndsAt > Date.now() ? saved.restEndsAt : null);
      } else {
        fresh.current = true;
        setStartedAt(Date.now());
        setExs(
          cleanLinks(data.exercises || []).map((e) => ({
            id: e.id,
            name: e.name,
            gif: e.gif,
            rest: e.rest ?? 60,
            plan: { sets: e.sets || 3, reps: e.reps || 10 },
            ...(e.progression ? { progression: e.progression } : {}),
            ...(e.linkNext ? { linkNext: true } : {}),
            sets: Array.from({ length: e.sets || 3 }, () => ({
              weight: '',
              reps: e.reps || 10,
              done: false,
            })),
          }))
        );
      }
      ready.current = true;
    };

    if (livre) {
      begin({ id: null, name: null, exercises: [] });
      return;
    }
    supabase
      .from('routines')
      .select('*')
      .eq('id', routineId)
      .single()
      .then(({ data }) => data && begin(data));
  }, [routineId, livre, user.id]);

  // Histórico: desempenho anterior de cada exercício e recordes até hoje
  useEffect(() => {
    fetchAllWorkouts()
      .then((data) => {
        const map = {};
        const last = {};
        data.forEach((w) =>
          (w.exercises || []).forEach((e) => {
            const k = exKey(e);
            const done = (e.sets || []).filter((s) => s.done);
            if (k && !map[k] && done.length) {
              map[k] = done.map((s) => ({ weight: s.weight, reps: s.reps }));
              last[k] = { ...e, date: w.started_at };
            }
          })
        );
        setPrevious(map);
        setLastLog(last);
        setHistory(data);
        setBests(bestByExercise(data, exKey));
      })
      .catch(() => {});
  }, []);

  useEffect(() => setEffort(loadEffortScale()), []);

  // Sugestão da regra de progressão para cada exercício (a partir do último treino)
  const suggestionOf = (ex) => (lastLog ? suggestNext(ex.progression, ex.plan, lastLog[exKey(ex)]) : null);

  // Treino novo: pré-preenche carga e repetições sugeridas, uma vez, quando o histórico chega
  useEffect(() => {
    if (!fresh.current || prefilled.current || !lastLog || !exs.length) return;
    prefilled.current = true;
    setExs((cur) => cur.map((ex) => ({ ...ex, sets: applySuggestion(ex.sets, suggestionOf(ex)) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastLog, exs.length]);

  // Salva no aparelho a cada alteração
  useEffect(() => {
    if (!ready.current || !routine || !startedAt) return;
    saveActive({
      routineId: routineId || null,
      routineName: routine.name || t('defaultSession'),
      userId: user.id,
      startedAt,
      restEndsAt,
      exs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exs, restEndsAt, startedAt, routine, routineId, user.id]);

  // Fim do descanso: bipe + vibração
  const restLeft = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : null;
  useEffect(() => {
    if (restEndsAt && now >= restEndsAt) {
      if (now - restEndsAt < 4000) bip(audioRef);
      setRestEndsAt(null);
    }
  }, [now, restEndsAt]);

  const unlockAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      if (audioRef.current && audioRef.current.state === 'suspended') audioRef.current.resume();
    } catch (e) {}
  }, []);

  function clone() {
    return exs.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
  }

  function updateSet(ei, si, field, value) {
    const copy = clone();
    copy[ei].sets[si][field] = value;

    if (field === 'done' && value === true) {
      unlockAudio();
      const s = copy[ei].sets[si];
      const prev = previous[exKey(copy[ei])]?.[si];
      // Se não digitou o peso, usa o da última vez
      if (s.weight === '' && prev?.weight) s.weight = prev.weight;
      // Superset: vai direto ao próximo exercício e só descansa no fim da rodada
      const { rest, next } = afterSetDone(copy, ei, si);
      setRestEndsAt(rest > 0 ? Date.now() + rest * 1000 : null);
      if (next && next.ei !== ei) {
        setTimeout(() => document.getElementById(`ex-${next.ei}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    }
    setExs(copy);
  }

  function setSetType(ei, si, type) {
    const copy = clone();
    if (type === 'normal') delete copy[ei].sets[si].type;
    else copy[ei].sets[si].type = type;
    setExs(copy);
    setSetMenu(null);
  }

  function removeSetAt(ei, si) {
    const copy = clone();
    if (copy[ei].sets.length <= 1) return setSetMenu(null);
    copy[ei].sets.splice(si, 1);
    setExs(copy);
    setSetMenu(null);
  }

  // Abre a calculadora com a carga da próxima série não concluída
  function openPlates(ei) {
    const sets = exs[ei].sets;
    let si = sets.findIndex((s) => !s.done);
    if (si < 0) si = sets.length - 1;
    const prev = previous[exKey(exs[ei])]?.[si];
    setPlates({ ei, si, weight: sets[si].weight !== '' ? sets[si].weight : prev?.weight || '' });
  }

  function applyPrevious(ei, si) {
    const prev = previous[exKey(exs[ei])]?.[si];
    if (!prev) return;
    const copy = clone();
    copy[ei].sets[si].weight = prev.weight ?? '';
    copy[ei].sets[si].reps = prev.reps ?? copy[ei].sets[si].reps;
    setExs(copy);
  }

  function addSet(ei) {
    const copy = clone();
    const last = copy[ei].sets[copy[ei].sets.length - 1];
    copy[ei].sets.push({ weight: last?.weight || '', reps: last?.reps || 10, done: false });
    setExs(copy);
  }

  function removeSet(ei) {
    const copy = clone();
    if (copy[ei].sets.length <= 1) return;
    copy[ei].sets.pop();
    setExs(copy);
  }

  async function removeExercise(ei) {
    if (!(await dialog.confirm(t('confirmRemoveExercise'), { danger: true, confirmLabel: t('remove') }))) return;
    setExs(cleanLinks(exs.filter((_, i) => i !== ei)));
  }

  function addExercise(ex) {
    setShowPicker(false);
    setDetail(null);
    if (exs.find((e) => exKey(e) === exKey(ex))) return;
    setExs([
      ...clone(),
      {
        id: ex.id,
        name: exName(ex),
        gif: ex.gif,
        rest: 60,
        sets: Array.from({ length: 3 }, () => ({ weight: '', reps: 10, done: false })),
      },
    ]);
  }

  async function terminer() {
    const anyDone = exs.some((e) => e.sets.some((s) => s.done));
    if (!anyDone && !(await dialog.confirm(t('confirmNoSets')))) return;

    setSaving(true);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const workout = {
      user_id: user.id,
      name: routine?.name || t('defaultSession'),
      started_at: new Date(startedAt).toISOString(),
      duration_min: Math.max(1, Math.round(seconds / 60)),
      exercises: exs,
    };
    const { error } = await supabase.from('workouts').insert(workout);
    setSaving(false);

    if (error) {
      await dialog.alert(t('saveError') + error.message);
    } else {
      clearActive();
      setSummary({
        name: workout.name,
        minutes: workout.duration_min,
        volume: workoutVolume(workout),
        sets: workoutSets(workout),
        records: findRecords(workout, history, exKey),
      });
    }
  }

  async function abandonner() {
    if (await dialog.confirm(t('confirmDiscard'), { danger: true, confirmLabel: t('discard') })) {
      clearActive();
      router.replace('/treino');
    }
  }

  if (summary) return <Summary summary={summary} onDone={() => router.replace('/inicio')} />;

  if (!routine || !startedAt) return <div className="page"><p className="muted">{t('loading')}</p></div>;

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const ssLabels = supersetLabels(exs);
  const menuSet = setMenu ? exs[setMenu.ei]?.sets[setMenu.si] : null;

  const totalSets = exs.reduce((n, e) => n + e.sets.length, 0);
  const doneCount = exs.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  return (
    <div className="page" style={{ paddingBottom: 130 }}>
      {/* Cabeçalho: ✕ descarta · título, tempo e séries · ✓ finaliza */}
      <div className="workout-head">
        <button className="round-btn" onClick={abandonner} aria-label={t('discard')}>
          <IconClose />
        </button>
        <div className="workout-title">
          <b>{routine.name || t('defaultSession')}</b>
          <span className="muted" style={{ fontSize: 16 }}>
            {fmt(seconds)} · {tf('setsProgress', { done: doneCount, total: totalSets })}
          </span>
        </div>
        <button className="round-btn ok" onClick={terminer} disabled={saving} aria-label={t('finishWorkout')}>
          <IconCheck size={22} />
        </button>
      </div>
      <div className="progress">
        <span style={{ width: `${totalSets ? (doneCount / totalSets) * 100 : 0}%` }} />
      </div>

      {exs.map((ex, ei) => {
        const prevSets = previous[exKey(ex)] || [];
        const labels = setLabels(ex.sets);
        const ss = ssLabels[ei];
        const sug = suggestionOf(ex);
        const grid = `set-grid ${effort !== 'off' ? 'with-effort' : ''}`;
        const cat = findExercise(ex);
        const muscle = muscleOf(cat);
        const best = bests.get(exKey(ex));
        const last = lastLog?.[exKey(ex)];
        const lastSets = last ? (last.sets || []).filter((s) => s.done) : [];
        return (
          <section key={exKey(ex) + ei} id={`ex-${ei}`} className={`ex-block ${ss ? 'in-ss' : ''}`}>
            <p className="ex-kicker">
              {ss && <span className="ss-badge" style={{ marginRight: 8 }}>{t('superset')} {ss}</span>}
              {tf('exerciseOf', { i: ei + 1, n: exs.length })}
            </p>
            {ex.gif && (
              <button className="ex-media" onClick={() => setDetail(ex)} aria-label={exName(ex)}>
                <ExerciseMedia ex={ex} alt={exName(ex)} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <h2 className="ex-title" style={{ flex: 1 }}>{exName(ex)}</h2>
              <button className="round-btn" style={{ marginTop: 12, border: 'none', background: 'var(--card)' }} onClick={() => removeExercise(ei)} aria-label={t('removeExercise')}>
                <IconTrash size={18} />
              </button>
            </div>

            <div className="tags">
              {muscle && <span className="tag-chip">{muscleName(muscle)}</span>}
              {best && <span className="tag-chip">{t('bestLabel')}: {fmtKg(best.est, locale)} kg</span>}
              {ex.rest > 0 && (
                <span className="tag-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IconRest size={14} /> {ex.rest}s
                </span>
              )}
            </div>

            {lastSets.length > 0 && (
              <p className="last-line">
                {tf('lastTime', { date: new Date(last.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}:{' '}
                {lastSets.map((s) => `${fmtKg(s.weight || 0, locale)}×${s.reps || 0}${s.rpe ? ` @${s.rpe}` : ''}`).join(', ')}
              </p>
            )}

            {/* Sugestão da progressão, explicada em uma linha */}
            {sug && (
              <p className="suggest-line">
                <IconArrowUp size={15} />
                <span>
                  <b>{t(ex.progression?.type === 'double' ? 'progDouble' : 'progLinear')}</b> · {tf(sug.reason, sug.params)}
                </span>
              </p>
            )}

            <div className="sets-box">
            <div className={`${grid} muted`} style={{ fontSize: 12, fontWeight: 700 }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span style={{ textAlign: 'center' }}>{t('prevCol')}</span>
              <button className="col-btn" onClick={() => openPlates(ei)} aria-label={t('plateCalc')} title={t('plateCalc')}>
                {t('kgCol')} <IconPlate size={13} />
              </button>
              <span style={{ textAlign: 'center' }}>{t('repsCol')}</span>
              {effort !== 'off' && <span style={{ textAlign: 'center' }}>{effort === 'rir' ? 'RIR' : 'RPE'}</span>}
              <span></span>
            </div>

            {ex.sets.map((s, si) => {
              const prev = prevSets[si];
              const type = setType(s);
              const record = isSetRecord(s, bests.get(exKey(ex))?.est ?? null, ex.sets.slice(0, si));
              return (
                <div key={si} className={`${grid} ${s.done ? 'set-done' : ''}`}>
                  <button
                    className={`set-label ${type}`}
                    onClick={() => setSetMenu({ ei, si })}
                    aria-label={`${t('setTypeTitle')}: ${t(TYPE_LABEL[type])}`}
                  >
                    {labels[si]}
                    {record && <span className="pr-badge">{t('newRecord')}</span>}
                  </button>
                  <button className="prev-cell" onClick={() => applyPrevious(ei, si)} disabled={!prev}>
                    {prev ? `${prev.weight || 0}×${prev.reps || 0}` : '—'}
                  </button>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    placeholder={prev?.weight ? String(prev.weight) : '0'}
                    value={s.weight}
                    onChange={(e) => updateSet(ei, si, 'weight', e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    value={s.reps}
                    onChange={(e) => updateSet(ei, si, 'reps', e.target.value)}
                  />
                  {effort !== 'off' && (
                    <select
                      className="input"
                      value={effort === 'rir' ? rpeToRir(s.rpe) : s.rpe ?? ''}
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : Number(e.target.value);
                        updateSet(ei, si, 'rpe', effort === 'rir' ? rirToRpe(v) : v);
                      }}
                      aria-label={effort === 'rir' ? 'RIR' : 'RPE'}
                    >
                      <option value="">–</option>
                      {(effort === 'rir' ? [4, 3, 2, 1, 0] : RPE_VALUES).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className={`check-btn ${s.done ? 'done' : ''}`}
                    onClick={() => updateSet(ei, si, 'done', !s.done)}
                    aria-label={t('setDone')}
                  >
                    <IconCheck />
                  </button>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn secondary small" style={{ flex: 1 }} onClick={() => addSet(ei)}>
                <IconPlus size={14} /> {t('addSet')}
              </button>
              {ex.sets.length > 1 && (
                <button className="btn secondary small" onClick={() => removeSet(ei)} aria-label="−">
                  − {t('removeSet')}
                </button>
              )}
            </div>
            </div>
          </section>
        );
      })}

      <button className="btn secondary" style={{ marginBottom: 12 }} onClick={() => setShowPicker(true)}>
        <IconPlus /> {t('addExercise')}
      </button>

      <button className="btn" onClick={terminer} disabled={saving}>
        {saving ? t('saving') : t('finishWorkout')}
      </button>
      <button className="btn danger" style={{ marginTop: 10 }} onClick={abandonner}>
        {t('discard')}
      </button>

      {/* Barra de descanso */}
      {restLeft !== null && (
        <div className="rest-bar">
          <div className="rest-info">
            <IconRest size={22} color="var(--accent)" />
            <div>
              <b style={{ fontSize: 22 }}>{fmt(restLeft)}</b>
              <p className="muted" style={{ fontSize: 12 }}>{t('resting')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn secondary small"
              onClick={() => {
                unlockAudio();
                setRestEndsAt((r) => (r || Date.now()) + 15000);
              }}
            >
              +15s
            </button>
            <button className="btn small" onClick={() => setRestEndsAt(null)}>
              {t('skip')}
            </button>
          </div>
        </div>
      )}

      {showPicker && (
        <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />
      )}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}

      {/* Menu da série: tipo (normal, aquecimento, drop, falha) e remover */}
      {menuSet && (
        <div className="modal-overlay" onClick={() => setSetMenu(null)}>
          <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <b style={{ fontSize: 18 }}>{t('setTypeTitle')}</b>
              <button onClick={() => setSetMenu(null)} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
                ✕
              </button>
            </div>
            <div className="modal-body menu-list">
              {SET_TYPES.map((type) => (
                <button key={type} onClick={() => setSetType(setMenu.ei, setMenu.si, type)}>
                  <span className={`tag set-label ${type}`} style={{ width: 30, padding: 0 }}>
                    {TYPE_TAG[type]}
                  </span>
                  <span style={{ flex: 1 }}>{t(TYPE_LABEL[type])}</span>
                  {setType(menuSet) === type && <IconCheck color="var(--accent)" />}
                </button>
              ))}
              <p className="muted" style={{ padding: '8px 4px' }}>{t('warmupHint')}</p>
              {exs[setMenu.ei].sets.length > 1 && (
                <button onClick={() => removeSetAt(setMenu.ei, setMenu.si)} style={{ color: 'var(--red)' }}>
                  <span className="tag">
                    <IconTrash />
                  </span>
                  {t('removeThisSet')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {plates && (
        <PlateCalculator
          initialWeight={plates.weight}
          onClose={() => setPlates(null)}
          onUse={(w) => {
            updateSet(plates.ei, plates.si, 'weight', w);
            setPlates(null);
          }}
        />
      )}
    </div>
  );
}

// Tela de fim de treino: duração, volume, séries e recordes batidos
function Summary({ summary, onDone }) {
  const { t, locale, exName } = useI18n();
  return (
    <div className="page summary">
      <div className="summary-icon">
        <IconTrophy size={36} color="#facc15" />
      </div>
      <h1 className="page-title" style={{ marginBottom: 4 }}>{t('workoutDone')}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{summary.name}</p>

      <div className="stat-grid">
        <div className="stat">
          <b>{summary.minutes}</b>
          <span className="muted">{t('minutes')}</span>
        </div>
        <div className="stat">
          <b>{fmtKg(summary.volume, locale)}</b>
          <span className="muted">kg</span>
        </div>
        <div className="stat">
          <b>{summary.sets}</b>
          <span className="muted">{t('sets')}</span>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'left' }}>
        <p className="card-title">
          {t('recordsBeaten')} <span className="pr-badge">{summary.records.length}</span>
        </p>
        {summary.records.length === 0 && <p className="muted">{t('noRecords')}</p>}
        {summary.records.map((r) => (
          <div key={r.key} className="row-link">
            {r.ex.gif && <img src={r.ex.gif} alt="" className="ex-thumb" />}
            <span style={{ minWidth: 0 }}>
              <span className="ex-name ellipsis">{exName(r.ex)}</span>
              <span className="muted">
                {fmtKg(r.weight, locale)} kg × {r.reps}
              </span>
            </span>
            <span className="row-right">
              <b>{fmtKg(r.est, locale)} kg</b>
              {r.prev > 0 && (
                <span className="muted" style={{ display: 'block', fontSize: 12, color: 'var(--green)' }}>
                  +{fmtKg(r.est - r.prev, locale)} kg
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <button className="btn" onClick={onDone}>
        {t('finish')}
      </button>
    </div>
  );
}

function fmt(total) {
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// Bipe no fim do descanso (o áudio é liberado no toque do usuário, exigência do iPhone)
function bip(audioRef) {
  try {
    const ctx = audioRef.current;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      [0, 0.25].forEach((delay) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        const t0 = ctx.currentTime + delay;
        g.gain.setValueAtTime(0.3, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
        o.start(t0);
        o.stop(t0 + 0.2);
      });
    }
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  } catch (e) {}
}
