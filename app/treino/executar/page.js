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
import { fetchAllWorkouts, insertWorkout } from '@/lib/data';
import { bestByExercise, findRecords, fmtKg, isSetRecord, workoutSets, workoutVolume } from '@/lib/stats';
import { RPE_VALUES, rpeToRir, rirToRpe, setLabels, setType, SET_TYPES } from '@/lib/sets';
import { applySuggestion, suggestNext } from '@/lib/progression';
import { afterSetDone, cleanLinks, supersetLabels } from '@/lib/superset';
import { loadEffortScale } from '@/lib/prefs';
import PlateCalculator from '@/components/PlateCalculator';
import ExerciseMedia from '@/components/ExerciseMedia';
import { IconCheck, IconPlus, IconTrash, IconTrophy, IconPlate, IconArrowUp } from '@/components/Icons';
import { setVsLast } from '@/lib/engage';

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
  const { t, tf, locale, exName, muscleName, equipName } = useI18n();
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
  const [cur, setCur] = useState(0); // exercício em foco
  const [exMenu, setExMenu] = useState(null); // menu ⋯ do exercício
  const [headMenu, setHeadMenu] = useState(false); // menu ⋯ do treino
  const [restStart, setRestStart] = useState(null); // quando o descanso começou (barra do rodapé)
  const [topWeights, setTopWeights] = useState({}); // exKey -> maior carga já usada
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
        setCur(saved.cur || 0);
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
        const top = {};
        data.forEach((w) =>
          (w.exercises || []).forEach((e) =>
            (e.sets || []).forEach((st) => {
              if (st.done && st.type !== 'warmup' && Number(st.weight) > (top[exKey(e)] || 0)) top[exKey(e)] = Number(st.weight);
            })
          )
        );
        setTopWeights(top);
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
      cur,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exs, restEndsAt, startedAt, routine, routineId, user.id, cur]);

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
      setRestStart(rest > 0 ? Date.now() : null);
      if (next && next.ei !== ei) setCur(next.ei);
      else if (copy[ei].sets.every((x) => x.done)) {
        // Exercício terminado: vai para o próximo que ainda tem séries
        const after = copy.findIndex((e, i) => i > ei && e.sets.some((x) => !x.done));
        const any = copy.findIndex((e) => e.sets.some((x) => !x.done));
        const to = after >= 0 ? after : any;
        if (to >= 0) setTimeout(() => setCur(to), 600);
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

  // − / +: peso de 2,5 em 2,5 kg (1 kg abaixo de 10 kg), reps de 1 em 1
  function stepValue(ei, si, field, dir) {
    const s0 = exs[ei].sets[si];
    const prev = previous[exKey(exs[ei])]?.[si];
    const base = s0[field] === '' || s0[field] == null ? Number(field === 'weight' ? prev?.weight : prev?.reps) || 0 : Number(s0[field]) || 0;
    const step = field === 'weight' ? (base < 10 ? 1 : 2.5) : 1;
    const v = Math.max(0, Math.round((base + dir * step) * 100) / 100);
    updateSet(ei, si, field, v);
  }

  // Copia o que foi feito da última vez nas séries ainda não concluídas
  function copyLast(ei) {
    const prev = previous[exKey(exs[ei])] || [];
    const copy = clone();
    copy[ei].sets = copy[ei].sets.map((st, i) => (st.done || !prev[i] ? st : { ...st, weight: prev[i].weight ?? st.weight, reps: prev[i].reps ?? st.reps }));
    setExs(copy);
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
    setCur((c) => Math.max(0, Math.min(c, exs.length - 2)));
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
    setCur(exs.length);
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
    const { error } = await insertWorkout({ ...workout, routine_id: routineId || null });
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
  const volumeToday = workoutVolume({ exercises: exs });

  const ci = Math.min(cur, Math.max(0, exs.length - 1));
  const ex = exs[ci];
  const restTotal = restEndsAt && restStart ? Math.max(1, (restEndsAt - restStart) / 1000) : 1;
  const nextEx = exs.find((e, i) => i > ci && e.sets.some((s) => !s.done)) || null;

  return (
    <div className="page focus-page" style={{ paddingBottom: restLeft !== null ? 150 : 40 }}>
      {/* Cabeçalho: minimizar · título, tempo e séries · ⋯ · Concluir */}
      <div className="workout-head">
        <button className="round-btn" onClick={() => router.push('/inicio')} aria-label={t('minimize')} title={t('minimize')}>
          <IconChevronDown />
        </button>
        <div className="workout-title">
          <b>{routine.name || t('defaultSession')}</b>
          <span className="muted" style={{ fontSize: 15 }}>
            {fmt(seconds)} · {tf('setsProgress', { done: doneCount, total: totalSets })}
          </span>
        </div>
        <button className="round-btn" onClick={() => setHeadMenu(true)} aria-label={t('moreOptions')}>
          <IconDots />
        </button>
        <button className="pill-btn" onClick={terminer} disabled={saving}>
          {saving ? '…' : t('finishShort')}
        </button>
      </div>
      <div className="progress-row">
        <div className="progress" style={{ flex: 1, margin: 0 }}>
          <span style={{ width: `${totalSets ? (doneCount / totalSets) * 100 : 0}%` }} />
        </div>
        <span className="muted">{fmtKg(volumeToday, locale)} kg</span>
      </div>

      {/* Trilho de exercícios: cada bolinha mostra o progresso do exercício */}
      {exs.length > 0 && (
        <div className="ex-rail" role="tablist">
          {exs.map((e, i) => {
            const done = e.sets.filter((s) => s.done).length;
            const pct = e.sets.length ? done / e.sets.length : 0;
            return (
              <button
                key={exKey(e) + i}
                role="tab"
                aria-selected={i === ci}
                aria-label={exName(e)}
                className={`rail-dot ${i === ci ? 'on' : ''} ${pct === 1 ? 'full' : ''}`}
                style={{ '--p': `${Math.round(pct * 360)}deg` }}
                onClick={() => setCur(i)}
              >
                <span>{pct === 1 ? '✓' : i + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      {!ex && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: 12 }}>{t('emptyWorkoutHint')}</p>
          <button className="btn" onClick={() => setShowPicker(true)}>
            <IconPlus /> {t('addExercise')}
          </button>
        </div>
      )}

      {ex && (() => {
        const ei = ci;
        const prevSets = previous[exKey(ex)] || [];
        const labels = setLabels(ex.sets);
        const ss = ssLabels[ei];
        const sug = suggestionOf(ex);
        const cat = findExercise(ex);
        const muscle = muscleOf(cat);
        const best = bests.get(exKey(ex));
        const last = lastLog?.[exKey(ex)];
        const lastSets = last ? (last.sets || []).filter((s) => s.done) : [];
        const lastWork = lastSets.filter((s) => s.type !== 'warmup');
        const topEver = topWeights[exKey(ex)] || 0;
        return (
          <section className={`focus-ex ${ss ? 'in-ss' : ''}`} key={exKey(ex) + ei}>
            <div className="focus-head">
              <button className="focus-thumb" onClick={() => setDetail(ex)} aria-label={exName(ex)}>
                {(cat?.gif || ex.gif) && <img src={cat?.gif || ex.gif} alt="" />}
                <span className="focus-expand"><IconExpand /></span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ss && <span className="ss-badge">{t('superset')} {ss}</span>}
                <h2 className="ex-title" style={{ margin: 0 }}>{exName(ex)}</h2>
              </div>
              <button className="round-btn" onClick={() => setExMenu(ei)} aria-label={t('moreOptions')}>
                <IconDots />
              </button>
            </div>

            <div className="tags">
              {muscle && <span className="tag-chip">{muscleName(muscle)}</span>}
              {cat?.eq && <span className="tag-chip">{equipName(cat.eq)}</span>}
              {best && <span className="tag-chip">{t('bestLabel')}: {fmtKg(best.est, locale)} kg</span>}
            </div>

            <p className="last-line">
              {tf('planLine', { sets: ex.sets.filter((s) => s.type !== 'warmup').length, reps: ex.plan?.reps || ex.sets[0]?.reps || 10 })}
              {ex.rest > 0 ? ` · ${t('rest')} ${ex.rest}s` : ''}
            </p>
            {lastSets.length > 0 && (
              <button className="last-line as-link" onClick={() => copyLast(ei)} title={t('copyLast')}>
                {tf('lastTime', { date: new Date(last.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}:{' '}
                {lastSets.map((s) => `${fmtKg(s.weight || 0, locale)}×${s.reps || 0}${s.rpe ? ` @${s.rpe}` : ''}`).join(', ')}
              </button>
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
              <div className={`set-head ${effort !== 'off' ? 'with-effort' : ''}`}>
                <span />
                <button className="col-btn" onClick={() => openPlates(ei)} title={t('plateCalc')}>
                  {t('weightCol')} <IconPlate size={13} />
                </button>
                <span>{t('repsCol')}</span>
                {effort !== 'off' && <span>{effort === 'rir' ? 'RIR' : 'RPE'}</span>}
                <span />
              </div>

              {ex.sets.map((s, si) => {
                const type = setType(s);
                const record = isSetRecord(s, best?.est ?? null, ex.sets.slice(0, si));
                const vs = s.done ? setVsLast(s, lastWork[labels.slice(0, si).filter((l) => /\d/.test(l)).length]) : null;
                const heavier = !s.done && type !== 'warmup' && topEver > 0 && Number(s.weight) > topEver;
                return (
                  <div key={si} className={`set-card ${s.done ? 'done' : ''}`}>
                    <div className={`set-row ${effort !== 'off' ? 'with-effort' : ''}`}>
                      <button className={`set-num ${type}`} onClick={() => setSetMenu({ ei, si })} aria-label={`${t('setTypeTitle')}: ${t(TYPE_LABEL[type])}`}>
                        {labels[si]}
                        {vs === 'up' && <span className="vs up" aria-label={t('betterThanLast')}>↑</span>}
                        {vs === 'down' && <span className="vs down" aria-label={t('worseThanLast')}>↓</span>}
                      </button>
                      <Stepper
                        value={s.weight}
                        placeholder={prevSets[si]?.weight ? String(prevSets[si].weight) : '0'}
                        mode="decimal"
                        onChange={(v) => updateSet(ei, si, 'weight', v)}
                        onStep={(d) => stepValue(ei, si, 'weight', d)}
                      />
                      <Stepper value={s.reps} mode="numeric" onChange={(v) => updateSet(ei, si, 'reps', v)} onStep={(d) => stepValue(ei, si, 'reps', d)} />
                      {effort !== 'off' && (
                        <select
                          className="input effort-box"
                          value={effort === 'rir' ? rpeToRir(s.rpe) : s.rpe ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? '' : Number(e.target.value);
                            updateSet(ei, si, 'rpe', effort === 'rir' ? rirToRpe(v) : v);
                          }}
                          aria-label={effort === 'rir' ? 'RIR' : 'RPE'}
                        >
                          <option value="">{effort === 'rir' ? 'RIR' : 'RPE'}</option>
                          {(effort === 'rir' ? [4, 3, 2, 1, 0] : RPE_VALUES).map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      )}
                      <button className={`check-btn ${s.done ? 'done' : ''}`} onClick={() => updateSet(ei, si, 'done', !s.done)} aria-label={t('setDone')}>
                        <IconCheck />
                      </button>
                    </div>
                    {record && (
                      <p className="set-note record">
                        <IconTrophy size={14} color="#facc15" /> <b>{t('recordBang')}</b> {t('recordWhat')}
                      </p>
                    )}
                    {heavier && <p className="set-note">{t('heavierEver')}</p>}
                  </div>
                );
              })}

              <button className="add-set" onClick={() => addSet(ei)}>
                <IconPlus size={16} /> {t('addSetLong')}
              </button>
            </div>

            <div className="focus-nav">
              <button className="link-btn" onClick={() => setCur(Math.max(0, ci - 1))} disabled={ci === 0}>
                ‹ {t('prevEx')}
              </button>
              {ci < exs.length - 1 ? (
                <button className="link-btn" onClick={() => setCur(ci + 1)}>
                  {t('nextEx')} ›
                </button>
              ) : (
                <button className="link-btn" onClick={terminer} disabled={saving}>
                  {t('finishWorkout')} ›
                </button>
              )}
            </div>
          </section>
        );
      })()}

      {/* Descanso preso no rodapé */}
      {restLeft !== null && (
        <div className="rest-dock">
          <div className="rest-dock-bar">
            <span style={{ width: `${Math.max(0, Math.min(100, (restLeft / restTotal) * 100))}%` }} />
          </div>
          <div className="rest-dock-row">
            <div>
              <b className="rest-dock-time">{fmt(restLeft)}</b>
              <p className="muted" style={{ fontSize: 13 }}>
                {t('resting')}
                {nextEx ? ` · ${exName(nextEx)}` : ''}
              </p>
            </div>
            <div className="rest-dock-actions">
              <button className="btn secondary small" onClick={() => setRestEndsAt((r) => Math.max(Date.now() + 1000, (r || Date.now()) - 15000))}>
                −15s
              </button>
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
        </div>
      )}

      {showPicker && <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />}
      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}

      {/* Menu do treino */}
      {headMenu && (
        <Sheet title={routine.name || t('defaultSession')} onClose={() => setHeadMenu(false)}>
          <button onClick={() => { setHeadMenu(false); setShowPicker(true); }}>
            <span className="tag"><IconPlus /></span> {t('addExercise')}
          </button>
          <button onClick={() => { setHeadMenu(false); terminer(); }}>
            <span className="tag"><IconCheck /></span> {t('finishWorkout')}
          </button>
          <button onClick={() => { setHeadMenu(false); abandonner(); }} style={{ color: 'var(--red)' }}>
            <span className="tag"><IconTrash /></span> {t('discard')}
          </button>
        </Sheet>
      )}

      {/* Menu do exercício */}
      {exMenu != null && exs[exMenu] && (
        <Sheet title={exName(exs[exMenu])} onClose={() => setExMenu(null)}>
          <button onClick={() => { setDetail(exs[exMenu]); setExMenu(null); }}>
            <span className="tag"><IconExpand /></span> {t('viewExercise')}
          </button>
          <button onClick={() => { openPlates(exMenu); setExMenu(null); }}>
            <span className="tag"><IconPlate /></span> {t('plateCalc')}
          </button>
          <button onClick={() => { const i = exMenu; setExMenu(null); removeExercise(i); }} style={{ color: 'var(--red)' }}>
            <span className="tag"><IconTrash /></span> {t('removeExercise')}
          </button>
        </Sheet>
      )}

      {/* Menu da série: tipo (normal, aquecimento, drop, falha) e remover */}
      {menuSet && (
        <Sheet title={t('setTypeTitle')} onClose={() => setSetMenu(null)}>
          {SET_TYPES.map((type) => (
            <button key={type} onClick={() => setSetType(setMenu.ei, setMenu.si, type)}>
              <span className={`tag set-num ${type}`} style={{ width: 30, padding: 0 }}>
                {TYPE_TAG[type]}
              </span>
              <span style={{ flex: 1 }}>{t(TYPE_LABEL[type])}</span>
              {setType(menuSet) === type && <IconCheck color="var(--accent)" />}
            </button>
          ))}
          <p className="muted" style={{ padding: '8px 4px' }}>{t('warmupHint')}</p>
          {exs[setMenu.ei].sets.length > 1 && (
            <button onClick={() => removeSetAt(setMenu.ei, setMenu.si)} style={{ color: 'var(--red)' }}>
              <span className="tag"><IconTrash /></span>
              {t('removeThisSet')}
            </button>
          )}
        </Sheet>
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

// Campo numérico com − e + (o número continua digitável)
function Stepper({ value, onChange, onStep, placeholder, mode }) {
  return (
    <div className="num-stepper">
      <button onClick={() => onStep(-1)} aria-label="−" tabIndex={-1}>
        −
      </button>
      <input type="number" inputMode={mode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <button onClick={() => onStep(1)} aria-label="+" tabIndex={-1}>
        +
      </button>
    </div>
  );
}

// Folha simples de opções
function Sheet({ title, onClose, children }) {
  const { t } = useI18n();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <b style={{ fontSize: 18 }} className="ellipsis">{title}</b>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', fontSize: 24 }} aria-label={t('close')}>
            ✕
          </button>
        </div>
        <div className="modal-body menu-list">{children}</div>
      </div>
    </div>
  );
}

const IconChevronDown = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconDots = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
const IconExpand = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);

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
