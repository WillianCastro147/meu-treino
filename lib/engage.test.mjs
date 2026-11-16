// Testes do design novo: desafios, recuperação, sequência, semana e comparações. npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyChallenges, recoveryNote, streakInfo, levelInfo, levelStart, weekLeft, setVsLast, funComparison } from './engage.js';

const set = (weight, reps, done = true) => ({ weight, reps, done });
const wk = (date, exercises = []) => ({ started_at: date, exercises });

test('desafios do mês: metas pelo seu ritmo e progresso do mês atual', () => {
  const now = new Date('2026-11-16T12:00:00');
  const ws = [
    ...Array.from({ length: 10 }, (_, i) => wk(`2026-10-${String(i + 1).padStart(2, '0')}T10:00:00`, [{ id: 'a', sets: [set(100, 10)] }])),
    ...Array.from({ length: 6 }, (_, i) => wk(`2026-09-${String(i + 1).padStart(2, '0')}T10:00:00`)),
    wk('2026-11-03T10:00:00', [{ id: 'a', sets: [set(100, 10), set(100, 10)] }]),
    wk('2026-11-10T10:00:00'),
  ];
  const c = monthlyChallenges(ws, [{ measured_on: '2026-11-01' }, { measured_on: '2026-11-02' }, { measured_on: '2026-10-30' }], now);
  assert.deepEqual(c.map((x) => x.key), ['workouts', 'tonnes', 'weighins']);
  assert.deepEqual([c[0].target, c[0].value, c[0].done], [9, 2, false]); // média (10+6)/2=8 → +10% → 9
  assert.deepEqual([c[1].target, c[1].value], [11, 2]); // outubro 10 t + 5% = 10,5 → 11; novembro 2 t
  assert.deepEqual([c[2].target, c[2].value], [10, 2]);
  assert.equal(monthlyChallenges([], null, now).length, 2);
  assert.equal(monthlyChallenges([], null, now)[0].target, 8);
});

test('recuperação: grupo há mais tempo sem treino e se hoje cobre', () => {
  const cat = { c: { muscle: 'chest', name: { en: 'x' } }, b: { muscle: 'back', name: { en: 'x' } }, l: { muscle: 'legs', name: { en: 'x' } } };
  const find = (e) => cat[e.id];
  const now = new Date('2026-11-16T12:00:00');
  const ws = [wk('2026-11-15T10:00:00', [{ id: 'c', sets: [set(50, 10)] }]), wk('2026-11-05T10:00:00', [{ id: 'b', sets: [set(50, 10)] }]), wk('2026-11-01T10:00:00', [{ id: 'l', sets: [set(50, 10, false)] }])];
  assert.deepEqual(recoveryNote(ws, find, { now }), { group: 'back', days: 11, covered: false });
  assert.equal(recoveryNote(ws, find, { now, todayExercises: [{ id: 'b' }] }).covered, true);
  assert.equal(recoveryNote([ws[0]], find, { now }), null);
});

test('sequência: congelamento salva uma semana perdida; medalhas pela melhor', () => {
  const now = new Date('2026-11-16T12:00:00'); // segunda
  // 4 semanas seguidas (ganha 1 congelamento), 1 perdida, depois a semana passada
  const ws = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-09'].map((d) => wk(d + 'T10:00:00'));
  const s = streakInfo(ws, now);
  assert.equal(s.current, 5);
  assert.equal(s.freezes, 0);
  assert.deepEqual(s.badges.map((b) => b.earned), [true, false, false, false, false]);
  assert.equal(s.nextBadge, 12);
  // sem congelamento a semana perdida zera
  const s2 = streakInfo(['2026-10-26', '2026-11-09'].map((d) => wk(d + 'T10:00:00')), now);
  assert.equal(s2.current, 1);
  assert.equal(s2.best, 1);
  assert.equal(streakInfo([], now).current, 0);
});

test('nível: pontos por treino e por semana', () => {
  assert.equal(levelStart(1), 0);
  assert.equal(levelStart(2), 100);
  const ws = Array.from({ length: 12 }, (_, i) => wk(new Date(2026, 9, 5 + i * 7, 10).toISOString()));
  const l = levelInfo(ws); // 12 treinos·10 + 12 semanas·20 = 360
  assert.equal(l.points, 360);
  assert.equal(l.level, 3); // nível 3 começa em 300, nível 4 em 600
  assert.equal(l.toNext, 240);
});

test('semana: treinos restantes pelo plano fixo', () => {
  const now = new Date('2026-11-18T12:00:00'); // quarta
  const plan = { mode: 'week', week: { 1: 'a', 3: 'b', 5: 'c' } };
  assert.deepEqual(weekLeft(plan, [wk('2026-11-16T10:00:00'), wk('2026-11-10T10:00:00')], now), { left: 2, planned: 3 });
  assert.equal(weekLeft({ mode: 'rotation', rotation: ['a'] }, [], now), null);
  assert.equal(weekLeft(null, [], now), null);
});

test('série contra a última vez e total levantado', () => {
  assert.equal(setVsLast(set(70, 10), set(65, 10)), 'up');
  assert.equal(setVsLast(set(60, 10), set(65, 10)), 'down');
  assert.equal(setVsLast(set(65, 10), set(65, 10)), 'same');
  assert.equal(setVsLast(set('', 10), set(65, 10)), null);
  assert.equal(setVsLast(set(65, 10), null), null);
  assert.deepEqual(funComparison(307450), { key: 'whale', times: 2 });
  assert.deepEqual(funComparison(3000), { key: 'car', times: 2 });
  assert.equal(funComparison(500), null);
});
