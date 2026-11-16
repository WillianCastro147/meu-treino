'use client';

// Player de circuito / AMRAP / EMOM / intervalos: relógio grande em tela cheia.
// A lógica de tempo fica em lib/circuit.js; aqui só mostramos o que ele decide.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import ExerciseMedia from '@/components/ExerciseMedia';
import { useDialog } from '@/components/Dialog';
import { supabase } from '@/lib/supabase';
import { useI18n, exKey } from '@/lib/i18n';
import { loadActive, saveActive, clearActive } from '@/lib/activeWorkout';
import { fetchAllWorkouts, insertWorkout } from '@/lib/data';
import { fmtKg } from '@/lib/stats';
import {
  adjustStation,
  circuitOfRoutine,
  compareResult,
  doneStep,
  elapsedOf,
  fmtClock,
  leftOf,
  nextWorkAfter,
  pauseRun,
  previousResult,
  resumeRun,
  runResult,
  runStep,
  skipStep,
  startRun,
  stationNow,
  stationSuggestions,
  stationsFrom,
  stepEndsAt,
  stopRun,
  tickRun,
  workoutExercises,
} from '@/lib/circuit';
import { useCircuitText } from '@/lib/circuitText';
import { IconCheck, IconClose, IconPlay } from '@/components/Icons';

export default function CircuitoPage() {
  const { t } = useI18n();
  return (
    <AuthGuard>
      {(user) => (
        <Suspense fallback={<p className="muted">{t('loading')}</p>}>
          <Player user={user} />
        </Suspense>
      )}
    </AuthGuard>
  );
}

const IconPause = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

// Bipe curto (contagem) ou duplo (troca de etapa). O áudio é liberado no 1º toque (exigência do iPhone).
function beep(ctxRef, kind = 'tick') {
  try {
    const ctx = ctxRef.current;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      const tones = kind === 'tick' ? [[0, 660, 0.12]] : [[0, 880, 0.18], [0.22, 1175, 0.25]];
      tones.forEach(([delay, freq, dur]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        const t0 = ctx.currentTime + delay;
        g.gain.setValueAtTime(0.3, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.start(t0);
        o.stop(t0 + dur);
      });
    }
    if (navigator.vibrate) navigator.vibrate(kind === 'tick' ? 80 : [250, 100, 250]);
  } catch (e) {}
}

function Player({ user }) {
  const router = useRouter();
  const params = useSearchParams();
  const routineId = params.get('id');
  const { t, tf, locale, exName } = useI18n();
  const text = useCircuitText();
  const dialog = useDialog();

  const [routine, setRoutine] = useState(null);
  const [run, setRun] = useState(null);
  const [history, setHistory] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [partialReps, setPartialReps] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const audioRef = useRef(null);
  const beeped = useRef('');

  const unlockAudio = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioRef.current = new Ctx();
      }
      if (audioRef.current?.state === 'suspended') audioRef.current.resume();
    } catch (e) {}
  }, []);

  // Rotina + histórico (carga da última vez e resultados anteriores) + execução salva no aparelho
  useEffect(() => {
    if (!routineId) return;
    Promise.all([supabase.from('routines').select('*').eq('id', routineId).single(), fetchAllWorkouts().catch(() => [])]).then(
      ([{ data }, workouts]) => {
        if (!data) return router.replace('/treino');
        const cfg = circuitOfRoutine(data.exercises);
        if (!cfg) return router.replace(`/treino/executar?id=${routineId}`);
        setRoutine(data);
        setHistory(workouts);
        const saved = loadActive();
        if (saved?.kind === 'circuit' && saved.routineId === routineId && saved.userId === user.id && saved.run) {
          setRun(saved.run);
          return;
        }
        // Carga da última vez em cada exercício
        const weights = {};
        workouts.forEach((w) =>
          (w.exercises || []).forEach((e) => {
            const k = exKey(e);
            if (weights[k] != null) return;
            const last = (e.sets || []).filter((s) => s.done && Number(s.weight) > 0).pop();
            if (last) weights[k] = Number(last.weight);
          })
        );
        setRun(startRun({ cfg, stations: stationsFrom(data.exercises, { weights, keyOf: exKey }) }));
      }
    );
  }, [routineId, user.id, router]);

  // Guarda no aparelho a cada mudança (sobrevive a recarregar ou fechar o navegador)
  useEffect(() => {
    if (!run || !routine || saved) return;
    saveActive({ kind: 'circuit', routineId, routineName: routine.name, userId: user.id, startedAt: run.startedAt, run });
  }, [run, routine, routineId, user.id, saved]);

  // Relógio: avança a execução pelo horário real (não atrasa com a tela bloqueada)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  useEffect(() => {
    if (!run || run.ended || run.paused != null) return;
    const { run: next, events } = tickRun(run, now);
    if (events.some((e) => e.type === 'step' || e.type === 'end')) {
      beep(audioRef, 'change');
      setRun(next);
      return;
    }
    // 3-2-1 nas etapas com tempo
    const left = leftOf(run, now);
    const key = `${run.i}:${left}`;
    if (stepEndsAt(run) != null && left > 0 && left <= 3 && beeped.current !== key) {
      beeped.current = key;
      beep(audioRef, 'tick');
    }
  }, [now, run]);

  // Tela sempre acesa
  useEffect(() => {
    let lock = null;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
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

  if (!routine || !run) return <div className="page"><p className="muted">{t('loading')}</p></div>;

  const cfg = run.cfg;
  // Feito / Pular: avança a execução e bipa na troca de etapa
  const act = (fn) => {
    unlockAudio();
    const { run: next, events } = fn(run, Date.now());
    if (events.some((e) => e.type === 'step' || e.type === 'end')) beep(audioRef, 'change');
    setRun(next);
  };

  async function encerrar() {
    if (!(await dialog.confirm(t('confirmStopCircuit'), { confirmLabel: t('stopBtn') }))) return;
    setRun(stopRun(run, Date.now()).run);
  }

  async function descartar() {
    if (!(await dialog.confirm(t('confirmDiscard'), { danger: true, confirmLabel: t('discard') }))) return;
    clearActive();
    router.replace('/treino');
  }

  /* ---------- fim: resumo ---------- */
  if (run.ended) {
    const partialStation = run.partial && cfg.mode === 'amrap' ? stationNow(run, run.partial.m) : null;
    const result = runResult(run, { partialReps: Number(partialReps) || 0 });
    const cmp = compareResult(result, previousResult(history, result));
    const tips = stationSuggestions(run);

    async function salvar() {
      setSaving(true);
      const exercises = workoutExercises(run, routine.exercises, { partialReps: Number(partialReps) || 0 });
      if (exercises[0]) exercises[0] = { ...exercises[0], circuitResult: result };
      const from = run.workFrom ?? run.startedAt;
      const { error } = await insertWorkout({
        user_id: user.id,
        routine_id: routineId,
        name: routine.name,
        started_at: new Date(from).toISOString(),
        duration_min: Math.max(1, Math.round(result.sec / 60)),
        exercises,
      });
      setSaving(false);
      if (error) return dialog.alert(t('saveError') + error.message);
      clearActive();
      setSaved(true);
    }

    // Aplica as sugestões (+1 rep / +5 s) na rotina
    async function aplicar() {
      const exercises = routine.exercises.map((e, idx) => {
        const tip = tips.find((x) => x.idx === idx);
        return tip ? { ...e, [tip.field]: tip.to } : e;
      });
      const { error } = await supabase.from('routines').update({ exercises }).eq('id', routineId);
      if (error) return dialog.alert(t('saveError') + error.message);
      setRoutine({ ...routine, exercises });
      setApplied(true);
    }

    return (
      <div className="page summary">
        <div className="summary-icon">
          <IconCheck size={36} color="var(--accent)" />
        </div>
        <h1 className="page-title" style={{ marginBottom: 4 }}>{t('circuitDone')}</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          {routine.name} · {text.line(cfg)}
        </p>

        {partialStation && !saved && (
          <div className="card" style={{ textAlign: 'left' }}>
            <label className="label" style={{ marginTop: 0 }}>{tf('partialAsk', { name: exName(routine.exercises[partialStation.idx]) })}</label>
            <input className="input" type="number" inputMode="numeric" min={0} value={partialReps} onChange={(e) => setPartialReps(e.target.value)} placeholder="0" />
          </div>
        )}

        <div className="stat-grid two">
          <div className="stat">
            <b>{cfg.mode === 'amrap' ? `${result.rounds} + ${result.extra}` : result.rounds}</b>
            <span className="muted">{cfg.mode === 'amrap' ? t('amrapScoreLabel') : t('cRounds')}</span>
          </div>
          <div className="stat">
            <b>{fmtClock(result.sec)}</b>
            <span className="muted">{t('duration')}</span>
          </div>
        </div>

        {cmp && <p className="suggest-line" style={{ justifyContent: 'center' }}>{text.compare(cmp)}</p>}

        {tips.length > 0 && (
          <div className="card" style={{ textAlign: 'left' }}>
            <p className="card-title">{t('nextTime')}</p>
            {tips.map((x) => (
              <p key={x.idx} className="muted" style={{ marginBottom: 6 }}>
                {exName(routine.exercises[x.idx])}: {x.field === 'reps' ? `${x.from} → ${x.to} reps` : `${x.from} s → ${x.to} s`}
              </p>
            ))}
            <button className="btn secondary small" style={{ width: '100%', marginTop: 6 }} onClick={aplicar} disabled={applied}>
              {applied ? t('applied') : t('applyRoutine')}
            </button>
          </div>
        )}

        {!saved ? (
          <>
            <button className="btn" onClick={salvar} disabled={saving}>
              {saving ? t('saving') : t('saveWorkout')}
            </button>
            <button className="btn danger" style={{ marginTop: 10 }} onClick={descartar}>
              {t('discard')}
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => router.replace('/inicio')}>
            {t('finish')}
          </button>
        )}
      </div>
    );
  }

  /* ---------- durante ---------- */
  const step = runStep(run);
  const st = stationNow(run, step.m);
  const ex = routine.exercises[st?.idx] || {};
  const next = nextWorkAfter(cfg, run.stations, run.i);
  const nextEx = next ? routine.exercises[run.stations[next.m]?.idx] : null;
  const left = leftOf(run, now);
  const fixed = stepEndsAt(run) != null;
  const isWork = step.k === 'work';
  const emomResting = isWork && step.emom && run.split;
  const big = fixed ? left : elapsedOf({ ...run, workFrom: run.at }, now);
  const phase =
    step.k === 'prep' ? t('getReady') : step.k === 'rest' ? (step.round ? t('phaseRoundRest') : t('phaseRest')) : emomResting ? t('phaseRest') : t('phaseWork');
  const paused = run.paused != null;
  const restLike = !isWork || emomResting;

  return (
    <div className="page player" style={{ paddingBottom: 40 }} onClick={unlockAudio}>
      <div className="workout-head">
        <button className="round-btn" onClick={descartar} aria-label={t('discard')}>
          <IconClose />
        </button>
        <div className="workout-title">
          <b>{routine.name}</b>
          <span className="muted" style={{ fontSize: 15 }}>{text.line(cfg)}</span>
        </div>
        <button className="round-btn" onClick={encerrar} aria-label={t('stopBtn')} title={t('stopBtn')}>
          <IconCheck size={20} />
        </button>
      </div>

      <div className={`player-clock ${restLike ? 'rest' : 'work'} ${paused ? 'paused' : ''}`}>
        <p className="player-phase">{paused ? t('paused') : phase}</p>
        <p className="player-time">{fmtClock(big)}</p>
        <p className="player-round">{text.roundLabel(cfg, step, run.stations.length)}</p>
        {cfg.mode === 'amrap' && run.capEndsAt && fixed && (
          <p className="muted">{tf('capLeft', { time: fmtClock(Math.max(0, Math.ceil((run.capEndsAt - (run.paused ?? now)) / 1000))) })}</p>
        )}
        {cfg.mode === 'amrap' && run.capEndsAt && !fixed && <p className="muted">{tf('capLeft', { time: fmtClock(left) })}</p>}
      </div>

      {/* Estação atual (no preparar e no descanso, a próxima) */}
      <div className="card player-station">
        {(restLike ? nextEx : ex)?.gif && (
          <div className="ex-media" style={{ marginBottom: 10 }}>
            <ExerciseMedia ex={restLike ? nextEx : ex} alt="" />
          </div>
        )}
        <p className="today-kicker">{restLike ? t('upNextLabel') : t('nowLabel')}</p>
        <p className="ex-title" style={{ marginTop: 2 }}>{exName(restLike ? nextEx || ex : ex)}</p>
        {isWork && !emomResting && st && (
          <div className="player-target">
            {st.mode === 'time' || cfg.mode === 'intervals' ? (
              <span className="tag-chip">{fmtClock(st.mode === 'time' ? st.sec : cfg.work)}</span>
            ) : (
              <>
                <div className="stepper">
                  <button onClick={() => setRun(adjustStation(run, step.m, 'reps', Math.max(0, st.reps - 1)))} aria-label="−">−</button>
                  <span>
                    <b>{st.reps}</b> {t('repsShort')}
                  </span>
                  <button onClick={() => setRun(adjustStation(run, step.m, 'reps', st.reps + 1))} aria-label="+">+</button>
                </div>
                <div className="stepper">
                  <button onClick={() => setRun(adjustStation(run, step.m, 'w', Math.max(0, st.w - 2.5)))} aria-label="−">−</button>
                  <span>
                    <b>{fmtKg(st.w, locale)}</b> kg
                  </span>
                  <button onClick={() => setRun(adjustStation(run, step.m, 'w', st.w + 2.5))} aria-label="+">+</button>
                </div>
              </>
            )}
          </div>
        )}
        {!restLike && nextEx && <p className="muted" style={{ marginTop: 10 }}>{tf('upNext', { name: exName(nextEx) })}</p>}
      </div>

      <div className="player-actions">
        <button className="btn secondary" onClick={() => setRun(paused ? resumeRun(run, Date.now()) : pauseRun(run, Date.now()))}>
          {paused ? <IconPlay size={18} /> : <IconPause size={18} />} {paused ? t('resumeBtn') : t('pauseBtn')}
        </button>
        {isWork && !emomResting ? (
          <button className="btn" onClick={() => act(doneStep)} disabled={paused}>
            <IconCheck size={18} /> {t('doneBtn')}
          </button>
        ) : (
          <button className="btn" onClick={() => act(skipStep)} disabled={paused}>
            {step.k === 'prep' ? t('startNow') : t('skipBtn')}
          </button>
        )}
      </div>
      {isWork && !emomResting && (
        <button className="link-btn" style={{ display: 'block', margin: '14px auto 0' }} onClick={() => act(skipStep)} disabled={paused}>
          {t('skipStation')}
        </button>
      )}
    </div>
  );
}
