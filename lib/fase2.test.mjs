// Testes da Fase 2: tipos de série, progressão, anilhas e supersets. Rode com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLabels, setType, isMainWorkSet, rpeToRir, rirToRpe } from './sets.js';
import { suggestNext, normalizeRule, applySuggestion } from './progression.js';
import { platesFor, groupPlates } from './plates.js';
import { supersetGroups, supersetLabels, afterSetDone, cleanLinks } from './superset.js';
import { workoutVolume, workoutSets, bestSet, findRecords } from './stats.js';

const set = (weight, reps, type, done = true) => ({ weight, reps, done, ...(type ? { type } : {}) });

// ---------- Tipos de série ----------

test('setLabels numera só as séries normais', () => {
  assert.deepEqual(setLabels([set(20, 10, 'warmup'), set(60, 8), set(60, 8), set(40, 10, 'drop'), set(60, 6, 'failure')]), ['W', '1', '2', 'D', 'F']);
  assert.deepEqual(setLabels([set(1, 1), set(1, 1)]), ['1', '2']);
  assert.equal(setType({}), 'normal');
  assert.equal(setType({ type: 'xyz' }), 'normal');
  assert.equal(isMainWorkSet(set(1, 1, 'failure')), true);
  assert.equal(isMainWorkSet(set(1, 1, 'drop')), false);
});

test('RPE <-> RIR', () => {
  assert.equal(rpeToRir(8), 2);
  assert.equal(rpeToRir(''), '');
  assert.equal(rirToRpe(3), 7);
  assert.equal(rirToRpe(9), 6);
});

test('aquecimento não conta para volume, séries, 1RM nem recordes', () => {
  const w = { exercises: [{ id: 'a', sets: [set(100, 5, 'warmup'), set(60, 10)] }] };
  assert.equal(workoutVolume(w), 600);
  assert.equal(workoutSets(w), 1);
  assert.equal(bestSet(w.exercises[0]).weight, 60);
  const recs = findRecords({ exercises: [{ id: 'b', sets: [set(200, 1, 'warmup')] }] }, []);
  assert.equal(recs.length, 0);
});

// ---------- Progressão ----------

test('normalizeRule: padrões e inversão de faixa', () => {
  assert.equal(normalizeRule(null), null);
  assert.equal(normalizeRule({ type: 'none' }), null);
  assert.deepEqual(normalizeRule({ type: 'linear' }), { type: 'linear', increment: 2.5 });
  assert.deepEqual(normalizeRule({ type: 'double', repMin: 12, repMax: 8, increment: 5 }), { type: 'double', increment: 5, repMin: 8, repMax: 12 });
  assert.deepEqual(normalizeRule({ type: 'double' }, 6), { type: 'double', increment: 2.5, repMin: 6, repMax: 10 });
});

test('linear: sobe a carga quando bate todas as repetições', () => {
  const last = { sets: [set(20, 10, 'warmup'), set(60, 8), set(60, 8), set(60, 8)] };
  assert.deepEqual(suggestNext({ type: 'linear', increment: 2.5 }, { sets: 3, reps: 8 }, last), {
    weight: 62.5,
    reps: 8,
    reason: 'progLinearUp',
    params: { inc: 2.5 },
  });
});

test('linear: repetição perdida ou série faltando repete a carga', () => {
  const rule = { type: 'linear', increment: 2.5 };
  const missed = { sets: [set(60, 8), set(60, 8), set(60, 7)] };
  assert.equal(suggestNext(rule, { sets: 3, reps: 8 }, missed).weight, 60);
  assert.equal(suggestNext(rule, { sets: 3, reps: 8 }, missed).reason, 'progLinearHold');
  const fewer = { sets: [set(60, 8), set(60, 8)] };
  assert.equal(suggestNext(rule, { sets: 3, reps: 8 }, fewer).weight, 60);
});

test('linear: drop set e aquecimento não atrapalham', () => {
  const last = { sets: [set(60, 8), set(60, 8), set(40, 12, 'drop')] };
  assert.equal(suggestNext({ type: 'linear', increment: 5 }, { sets: 2, reps: 8 }, last).weight, 65);
});

test('dupla progressão: sobe repetição dentro da faixa, depois a carga', () => {
  const rule = { type: 'double', increment: 2.5, repMin: 8, repMax: 12 };
  const mid = { sets: [set(40, 10), set(40, 9), set(40, 9)] };
  assert.deepEqual(suggestNext(rule, { sets: 3 }, mid), { weight: 40, reps: 10, reason: 'progDoubleReps', params: { min: 8, max: 12 } });
  const top = { sets: [set(40, 12), set(40, 12), set(40, 13)] };
  assert.deepEqual(suggestNext(rule, { sets: 3 }, top), { weight: 42.5, reps: 8, reason: 'progDoubleUp', params: { inc: 2.5, max: 12 } });
  const low = { sets: [set(40, 5), set(40, 5), set(40, 5)] };
  assert.equal(suggestNext(rule, { sets: 3 }, low).reps, 8);
});

test('sem regra ou sem histórico: sem sugestão', () => {
  assert.equal(suggestNext(null, { sets: 3, reps: 8 }, { sets: [set(60, 8)] }), null);
  assert.equal(suggestNext({ type: 'linear' }, { sets: 3, reps: 8 }, null), null);
  assert.equal(suggestNext({ type: 'linear' }, { sets: 1, reps: 8 }, { sets: [set('', 8)] }), null);
});

test('applySuggestion preenche só séries de trabalho vazias', () => {
  const sets = [set('', 10, 'warmup', false), set('', 10, null, false), set(50, 10, null, false), set('', 10, null, true)];
  const out = applySuggestion(sets, { weight: 62.5, reps: 8 });
  assert.equal(out[0].weight, '');
  assert.deepEqual([out[1].weight, out[1].reps], [62.5, 8]);
  assert.equal(out[2].weight, 50);
  assert.equal(out[3].weight, '');
});

// ---------- Anilhas ----------

test('platesFor: combinações por lado', () => {
  assert.deepEqual(platesFor(100, 20).perSide, [25, 15]);
  assert.deepEqual(platesFor(62.5, 20).perSide, [20, 1.25]);
  assert.equal(platesFor(62.5, 20).total, 62.5);
  assert.deepEqual(platesFor(20, 20).perSide, []);
  assert.equal(platesFor(15, 20), null);
});

test('platesFor: chega o mais perto possível sem passar', () => {
  const r = platesFor(63, 20, [20, 10, 5, 2.5, 1.25]);
  assert.equal(r.total, 62.5);
  assert.equal(r.remainder, 0.5);
  // Só anilhas de 15: 50 kg = 15 por lado (+20 da barra)
  assert.deepEqual(platesFor(50, 20, [15]).perSide, [15]);
  // Menos anilhas ganha: 40 por lado = 20+20, não 15+15+10
  assert.deepEqual(platesFor(100, 20, [20, 15, 10]).perSide, [20, 20]);
});

test('groupPlates', () => {
  assert.deepEqual(groupPlates([20, 20, 5]), [
    { plate: 20, n: 2 },
    { plate: 5, n: 1 },
  ]);
});

// ---------- Supersets ----------

const ex = (rest, linkNext, doneFlags) => ({ rest, linkNext, sets: doneFlags.map((d) => ({ done: d })) });

test('supersetGroups e rótulos', () => {
  const items = [{ linkNext: true }, {}, {}, { linkNext: true }, { linkNext: true }, {}];
  assert.deepEqual(supersetGroups(items), [[0, 1], [2], [3, 4, 5]]);
  assert.deepEqual(supersetLabels(items), ['A1', 'A2', null, 'B1', 'B2', 'B3']);
  assert.deepEqual(cleanLinks([{ linkNext: true }]), [{ linkNext: false }]);
});

test('afterSetDone: exercício sozinho descansa normalmente', () => {
  assert.deepEqual(afterSetDone([ex(90, false, [true, false])], 0, 0), { rest: 90, next: null });
});

test('afterSetDone: superset vai direto para o próximo e descansa no fim da rodada', () => {
  const exs = [ex(30, true, [true, false, false]), ex(60, false, [false, false, false])];
  assert.deepEqual(afterSetDone(exs, 0, 0), { rest: 0, next: { ei: 1, si: 0 } });
  exs[1].sets[0].done = true;
  assert.deepEqual(afterSetDone(exs, 1, 0), { rest: 60, next: { ei: 0, si: 1 } });
});

test('afterSetDone: último set da última rodada descansa sem próximo', () => {
  const exs = [ex(30, true, [true]), ex(45, false, [true])];
  assert.deepEqual(afterSetDone(exs, 1, 0), { rest: 45, next: null });
});

test('afterSetDone: exercício com menos séries é pulado nas rodadas seguintes', () => {
  const exs = [ex(30, true, [true, true, false]), ex(60, false, [true, true])];
  assert.deepEqual(afterSetDone(exs, 0, 1), { rest: 60, next: { ei: 0, si: 2 } });
});

test('fmtKg mantém anilhas de 1,25 kg', async () => {
  const { fmtKg } = await import('./stats.js');
  assert.equal(fmtKg(1.25, 'pt-BR'), '1,25');
  assert.equal(fmtKg(62.5, 'en-US'), '62.5');
  assert.equal(fmtKg(1250, 'pt-BR'), '1.250');
});
