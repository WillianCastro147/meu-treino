// Testes do motor de circuitos (adaptados dos testes do openGym). Rode com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanCircuit,
  defaultCircuit,
  circuitOfRoutine,
  setRoutineCircuit,
  startUrl,
  stationsFrom,
  stepAt,
  stepCount,
  nextWorkAfter,
  plannedLength,
  startRun,
  tickRun,
  doneStep,
  skipStep,
  pauseRun,
  resumeRun,
  stopRun,
  leftOf,
  runStep,
  adjustStation,
  workoutExercises,
  runResult,
  resultOfWorkout,
  previousResult,
  compareResult,
  stationSuggestions,
  fmtClock,
  PREP_SEC,
} from './circuit.js';

const S = (idx, mode = 'reps', extra = {}) => ({ idx, id: 'og' + idx, mode, reps: 10, w: 0, sec: 0, ...extra });
const steps = (cfg, st) => Array.from({ length: Math.min(60, stepCount(cfg, st.length)) }, (_, i) => stepAt(cfg, st, i));
const T = 1_000_000;

test('cleanCircuit: descarta o que não é circuito e limita valores', () => {
  assert.equal(cleanCircuit(null), null);
  assert.equal(cleanCircuit({ mode: 'superset' }), null);
  assert.deepEqual(cleanCircuit({ mode: 'emom', every: 5, count: 500, rounds: 3 }), { mode: 'emom', every: 10, count: 99 });
  assert.deepEqual(cleanCircuit({ mode: 'amrap', cap: 'x' }), { mode: 'amrap', cap: 600 });
  assert.deepEqual(defaultCircuit('tabata'), { mode: 'intervals', work: 20, rest: 10, rounds: 8, roundRest: 0 });
  assert.deepEqual(defaultCircuit('circuit'), { mode: 'circuit', rounds: 3, gap: 15, roundRest: 60 });
});

test('na rotina: grava em todos, lê de volta e volta ao normal', () => {
  const ex = [{ id: 'a', reps: 10, linkNext: true }, { id: 'b', reps: 8 }];
  const withC = setRoutineCircuit(ex, { mode: 'amrap', cap: 900 });
  assert.deepEqual(withC[1].circuit, { mode: 'amrap', cap: 900 });
  assert.equal(withC[0].linkNext, false);
  assert.deepEqual(circuitOfRoutine(withC), { mode: 'amrap', cap: 900 });
  const back = setRoutineCircuit(withC, null);
  assert.equal(circuitOfRoutine(back), null);
  assert.equal('circuit' in back[0], false);
  assert.equal(startUrl({ id: 'r1', exercises: withC }), '/treino/circuito?id=r1');
  assert.equal(startUrl({ id: 'r1', exercises: back }), '/treino/executar?id=r1');
});

test('stationsFrom: reps ou tempo, com a carga da última vez', () => {
  const st = stationsFrom([{ id: 'a', reps: 12 }, { id: 'b', reps: 0, sec: 30 }], { weights: { a: 20 } });
  assert.deepEqual(st[0], { idx: 0, id: 'a', mode: 'reps', reps: 12, w: 20, sec: 0 });
  assert.deepEqual(st[1], { idx: 1, id: 'b', mode: 'time', reps: 0, w: 0, sec: 30 });
});

test('circuito: estações, descanso entre elas e entre rodadas, nada depois da última', () => {
  const cfg = { mode: 'circuit', rounds: 2, gap: 15, roundRest: 60 };
  const st = [S(0), S(1, 'time', { sec: 30 })];
  const all = steps(cfg, st);
  assert.deepEqual(all.map((s) => s.k + (s.round ? 'R' : '') + (s.sec ?? '-')), ['prep' + PREP_SEC, 'work-', 'rest15', 'work30', 'restR60', 'work-', 'rest15', 'work30']);
  assert.equal(stepAt(cfg, st, all.length), null);
});

test('EMOM: cada intervalo a próxima estação, duração fixa', () => {
  const all = steps({ mode: 'emom', every: 60, count: 5 }, [S(0), S(1)]);
  assert.equal(all.length, 6);
  assert.deepEqual(all.slice(1).map((s) => `${s.m}/${s.r}`), ['0/0', '1/0', '0/1', '1/1', '0/2']);
});

test('intervalos: trabalho e descanso, sem descanso no fim; Tabata = 4 min', () => {
  const all = steps({ mode: 'intervals', work: 20, rest: 10, rounds: 2, roundRest: 45 }, [S(0), S(1)]);
  assert.deepEqual(all.map((s) => s.k[0] + s.sec), ['p10', 'w20', 'r10', 'w20', 'r45', 'w20', 'r10', 'w20']);
  assert.equal(plannedLength(defaultCircuit('tabata'), [S(0)]), 8 * 20 + 7 * 10);
});

test('AMRAP nunca fica sem etapas', () => {
  const st = [S(0), S(1), S(2)];
  assert.equal(stepCount({ mode: 'amrap', cap: 60 }, 3), Infinity);
  assert.deepEqual(stepAt({ mode: 'amrap', cap: 60 }, st, 301), { k: 'work', m: 0, r: 100, sec: null });
  assert.equal(nextWorkAfter({ mode: 'amrap', cap: 60 }, st, 3).r, 1);
});

test('o relógio passa a vez no horário certo, mesmo com o celular bloqueado', () => {
  const run = startRun({ cfg: { mode: 'emom', every: 60, count: 3 }, stations: [S(0)] }, T);
  const { run: r, events } = tickRun(run, T + 10_000 + 150_000);
  assert.equal(r.i, 3);
  assert.equal(r.at, T + 10_000 + 120_000);
  assert.deepEqual(events.filter((e) => e.type === 'work').map((e) => e.sec), [60, 60]);
  assert.equal(leftOf(r, T + 10_000 + 150_000), 30);
  assert.equal(tickRun(r, T + 10_000 + 181_000).run.ended, 'done');
});

test('EMOM: "Feito" marca o tempo e o resto do minuto é descanso', () => {
  let run = startRun({ cfg: { mode: 'emom', every: 60, count: 2 }, stations: [S(0)] }, T);
  run = doneStep(run, T + 1000).run; // sai do preparar
  assert.equal(runStep(run).k, 'work');
  const d = doneStep(run, T + 1000 + 18_000);
  assert.deepEqual(d.events.map((e) => e.type), ['work', 'split']);
  assert.equal(d.events[0].sec, 18);
  assert.deepEqual(tickRun(d.run, T + 1000 + 60_000).events.filter((e) => e.type === 'work'), []);
});

test('pausar move todos os relógios', () => {
  let run = startRun({ cfg: { mode: 'amrap', cap: 60 }, stations: [S(0)] }, T);
  run = tickRun(run, T + 10_000).run;
  assert.equal(run.capEndsAt, T + 70_000);
  run = pauseRun(run, T + 20_000);
  assert.equal(leftOf(run, T + 40_000), 50);
  run = resumeRun(run, T + 50_000);
  assert.equal(run.capEndsAt, T + 100_000);
  assert.equal(leftOf(run, T + 50_000), 50);
});

test('AMRAP: placar = rodadas completas + reps da rodada seguinte + parcial', () => {
  let run = startRun({ cfg: { mode: 'amrap', cap: 120 }, stations: [S(0, 'reps', { reps: 10 }), S(1, 'reps', { reps: 5 })] }, T);
  run = doneStep(run, T).run; // preparar -> 1ª estação
  let t = T;
  for (let k = 0; k < 5; k++) run = doneStep(run, (t += 20_000)).run; // 2 rodadas + 1 estação
  const end = tickRun(run, T + 200_000).run;
  assert.equal(end.ended, 'cap');
  assert.deepEqual(end.partial, { m: 1, r: 2 });
  const res = runResult(end, { partialReps: 3 });
  assert.equal(res.rounds, 2);
  assert.equal(res.extra, 10 + 3);
  assert.equal(res.roundTimes.length, 2);
  const exs = workoutExercises(end, [{ id: 'og0', name: 'A', gif: '/a' }, { id: 'og1', name: 'B', gif: '/b' }], { partialReps: 3 });
  assert.equal(exs[0].sets.length, 3);
  assert.deepEqual(exs[1].sets.map((s) => s.reps), [5, 5, 3]);
  assert.ok(exs.every((e) => e.sets.every((s) => s.done)));
});

test('pular não registra a estação; ajuste vale para as próximas rodadas', () => {
  let run = startRun({ cfg: { mode: 'circuit', rounds: 2, gap: 0, roundRest: 0 }, stations: [S(0, 'reps', { reps: 10, w: 20 }), S(1)] }, T);
  run = doneStep(run, T).run;
  run = adjustStation(run, 0, 'w', 22.5);
  run = doneStep(run, T + 30_000).run; // estação 0 com 22,5 kg
  run = skipStep(run, T + 40_000).run; // pula a estação 1
  const { run: end } = stopRun(run, T + 50_000);
  const exs = workoutExercises(end, [{ id: 'og0' }, { id: 'og1' }]);
  assert.equal(exs.length, 1);
  assert.deepEqual(exs[0].sets, [{ weight: 22.5, reps: 10, done: true }]);
  assert.equal(end.ended, 'stopped');
});

test('intervalos guardam os segundos, não reps', () => {
  let run = startRun({ cfg: { mode: 'intervals', work: 20, rest: 10, rounds: 1, roundRest: 0 }, stations: [S(0)] }, T);
  run = tickRun(run, T + 10_000 + 20_000 + 1).run;
  const exs = workoutExercises(stopRun(run, T + 31_000).run, [{ id: 'og0' }]);
  assert.deepEqual(exs[0].sets, [{ weight: '', reps: '', sec: 20, done: true }]);
});

test('comparação com a última vez e resultado salvo no treino', () => {
  const a = { mode: 'amrap', ids: ['x'], rounds: 5, extra: 4 };
  assert.deepEqual(compareResult({ ...a, rounds: 6 }, a), { kind: 'rounds', delta: 1 });
  assert.deepEqual(compareResult({ ...a, extra: 2 }, a), { kind: 'reps', delta: -2 });
  const c = { mode: 'circuit', ids: ['x'], roundTimes: [60, 70] };
  assert.deepEqual(compareResult({ ...c, roundTimes: [58, 82] }, c), { kind: 'round', round: 2, delta: 12 });
  const ws = [{ exercises: [{ id: 'y' }] }, { exercises: [{ id: 'x', circuitResult: { ...a, rounds: 3 } }] }];
  assert.equal(resultOfWorkout(ws[1]).rounds, 3);
  assert.equal(previousResult(ws, a).rounds, 3);
  assert.equal(previousResult(ws, { ...a, mode: 'emom' }), null);
});

test('sugestões: +1 rep sem carga se bateu tudo; +5 s em estação por tempo', () => {
  let run = startRun({ cfg: { mode: 'circuit', rounds: 1, gap: 0, roundRest: 0 }, stations: [S(0, 'reps', { reps: 10 }), S(1, 'time', { sec: 30 }), S(2, 'reps', { reps: 8, w: 40 })] }, T);
  run = doneStep(run, T).run;
  run = doneStep(run, T + 20_000).run;
  run = tickRun(run, T + 20_000 + 30_000).run;
  run = doneStep(run, T + 70_000).run;
  assert.equal(run.ended, 'done');
  assert.deepEqual(stationSuggestions(run), [
    { idx: 0, id: 'og0', field: 'reps', from: 10, to: 11 },
    { idx: 1, id: 'og1', field: 'sec', from: 30, to: 35 },
  ]);
  assert.deepEqual(stationSuggestions({ ...run, ended: 'stopped' }), []);
});

test('fmtClock', () => {
  assert.equal(fmtClock(20), '0:20');
  assert.equal(fmtClock(750), '12:30');
  assert.equal(fmtClock(3900), '1:05:00');
});
