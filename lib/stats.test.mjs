// Testes dos cálculos de progresso. Rode com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimate1RM,
  bestSet,
  exerciseHistory,
  exerciseSummary,
  findRecords,
  isSetRecord,
  weeklySummary,
  weekStreak,
  weekStart,
  workoutVolume,
  totals,
  fmtDuration,
} from './stats.js';

const set = (weight, reps, done = true) => ({ weight, reps, done });
const wk = (id, date, exercises, duration_min = 60) => ({ id, started_at: date, duration_min, exercises });

test('estimate1RM: Epley, 1 rep é a medida, limites', () => {
  assert.equal(estimate1RM(100, 1), 100);
  assert.equal(estimate1RM(100, 10), 133.3);
  assert.equal(estimate1RM('80', '5'), 93.3);
  assert.equal(estimate1RM(0, 10), null);
  assert.equal(estimate1RM(100, 0), null);
  assert.equal(estimate1RM(100, 13), null);
  assert.equal(estimate1RM('', 8), null);
});

test('bestSet ignora séries não concluídas', () => {
  const ex = { id: 'a', sets: [set(100, 5), set(200, 5, false), set(105, 3)] };
  assert.deepEqual(bestSet(ex), { est: 116.7, weight: 100, reps: 5 });
});

test('volume conta só séries concluídas', () => {
  const w = wk(1, '2026-10-01T10:00:00', [{ id: 'a', sets: [set(50, 10), set(60, 10, false)] }, { id: 'b', sets: [set('', 15)] }]);
  assert.equal(workoutVolume(w), 500);
});

test('histórico e resumo de um exercício', () => {
  const ws = [
    wk(2, '2026-10-08T10:00:00', [{ id: 'a', sets: [set(110, 3), set(90, 12)] }]),
    wk(1, '2026-10-01T10:00:00', [{ id: 'a', sets: [set(100, 5)] }, { id: 'b', sets: [set(20, 10)] }]),
    wk(3, '2026-10-09T10:00:00', [{ id: 'a', sets: [set(100, 5, false)] }]),
  ];
  const h = exerciseHistory(ws, 'a');
  assert.equal(h.length, 2);
  assert.equal(h[0].workoutId, 1);
  const s = exerciseSummary(h);
  assert.equal(s.sessions, 2);
  assert.equal(s.best1RM.est, 126);
  assert.equal(s.topWeight, 110);
  assert.equal(s.maxReps, 12);
  assert.equal(s.bestVolume, 330 + 1080);
});

test('findRecords compara com o histórico anterior', () => {
  const hist = [wk(1, '2026-10-01T10:00:00', [{ id: 'a', sets: [set(100, 5)] }, { id: 'b', sets: [set(50, 10)] }])];
  const novo = wk(2, '2026-10-08T10:00:00', [
    { id: 'a', sets: [set(100, 6)] }, // 120 > 116.7: recorde
    { id: 'b', sets: [set(50, 10)] }, // igual: não é recorde
    { id: 'c', sets: [set(10, 10)] }, // primeira vez: recorde
  ]);
  const r = findRecords(novo, hist);
  assert.deepEqual(r.map((x) => x.key), ['a', 'c']);
  assert.equal(r[0].prev, 116.7);
});

test('isSetRecord considera séries anteriores do mesmo treino', () => {
  assert.equal(isSetRecord(set(100, 6), 116.7), true);
  assert.equal(isSetRecord(set(100, 5), 116.7), false);
  assert.equal(isSetRecord(set(100, 6, false), 116.7), false);
  assert.equal(isSetRecord(set(100, 6), 116.7, [set(100, 7)]), false);
  assert.equal(isSetRecord(set(10, 10), null), true);
});

test('weeklySummary agrupa por semana (segunda a domingo)', () => {
  const now = new Date('2026-10-16T12:00:00'); // sexta
  const ws = [
    wk(1, '2026-10-12T08:00:00', [{ id: 'a', sets: [set(10, 10)] }]), // segunda desta semana
    wk(2, '2026-10-18T20:00:00', [{ id: 'a', sets: [set(10, 10)] }]), // domingo desta semana
    wk(3, '2026-10-11T20:00:00', [{ id: 'a', sets: [set(10, 10)] }]), // domingo da semana passada
    wk(4, '2025-01-01T08:00:00', []), // fora da janela
  ];
  const b = weeklySummary(ws, 4, now);
  assert.equal(b.length, 4);
  assert.equal(b[3].workouts, 2);
  assert.equal(b[3].volume, 200);
  assert.equal(b[2].workouts, 1);
  assert.equal(b[0].workouts + b[1].workouts, 0);
  assert.equal(weekStart(now).getDay(), 1);
});

test('weekStreak: semana atual vazia não quebra a sequência', () => {
  const now = new Date('2026-10-16T12:00:00');
  const ws = [wk(1, '2026-10-07T10:00:00', []), wk(2, '2026-09-30T10:00:00', []), wk(3, '2026-09-16T10:00:00', [])];
  assert.equal(weekStreak(ws, now), 2);
  assert.equal(weekStreak([...ws, wk(4, '2026-10-13T10:00:00', [])], now), 3);
  assert.equal(weekStreak([], now), 0);
});

test('totals e fmtDuration', () => {
  const t = totals([wk(1, '2026-10-01', [{ id: 'a', sets: [set(10, 10)] }], 45), wk(2, '2026-10-02', [], 50)]);
  assert.deepEqual(t, { workouts: 2, minutes: 95, volume: 100, sets: 1 });
  assert.equal(fmtDuration(45), '45min');
  assert.equal(fmtDuration(90), '1h30');
  assert.equal(fmtDuration(600), '10h');
});
