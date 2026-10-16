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

// ---------- Mapa muscular ----------

test('muscleOf usa o catálogo e deduz pelo nome quando falta', async () => {
  const { muscleOf } = await import('./muscles.js');
  assert.equal(muscleOf({ muscle: 'chest', name: { en: 'x' } }), 'chest');
  assert.equal(muscleOf({ muscle: null, name: { en: 'Bulgarian split squat' } }), 'legs');
  assert.equal(muscleOf({ muscle: null, name: { en: 'Diamond push-up' } }), 'chest');
  assert.equal(muscleOf({ muscle: null, name: { en: 'Plank' } }), 'abs');
  assert.equal(muscleOf({ muscle: null, name: { en: 'Burpee' } }), null);
  assert.equal(muscleOf(null), null);
});

test('setsByMuscle e regionLevels', async () => {
  const { setsByMuscle, regionLevels } = await import('./muscles.js');
  const cat = { a: { muscle: 'chest', name: { en: 'Bench' } }, b: { muscle: 'legs', name: { en: 'Squat' } } };
  const ws = [
    { started_at: '2026-10-10T10:00:00', exercises: [{ id: 'a', sets: [set(50, 10), set(50, 10), set(20, 10, 'warmup')] }, { id: 'b', sets: [set(80, 5)] }] },
    { started_at: '2025-01-01T10:00:00', exercises: [{ id: 'b', sets: [set(80, 5), set(80, 5)] }] },
  ];
  const by = setsByMuscle(ws, new Date('2026-10-01').getTime(), (e) => cat[e.id]);
  assert.deepEqual(by, { chest: 2, legs: 1 });
  const lv = regionLevels(by);
  assert.equal(lv.chest, 4);
  assert.equal(lv.quadriceps, 2);
  assert.equal(lv.hamstring, 2);
  assert.deepEqual(regionLevels({}), {});
});

// ---------- Catálogo novo ----------

test('filterExercises: busca em PT e EN, parte do corpo e equipamento', async () => {
  const { filterExercises } = await import('./exerciseFilter.js');
  const list = [
    { id: 'og1', name: { en: 'Barbell bench press', pt: 'Supino reto com barra' }, bp: 'chest', eq: 'barbell' },
    { id: 'og2', name: { en: 'Dumbbell curl', pt: 'Rosca com halteres' }, bp: 'upper arms', eq: 'dumbbell' },
  ];
  assert.deepEqual(filterExercises(list, { q: 'supino', lang: 'pt' }).map((e) => e.id), ['og1']);
  assert.deepEqual(filterExercises(list, { q: 'curl', lang: 'pt' }).map((e) => e.id), ['og2']);
  assert.deepEqual(filterExercises(list, { q: 'rosca halter', lang: 'pt' }).map((e) => e.id), ['og2']);
  assert.deepEqual(filterExercises(list, { bp: 'chest' }).map((e) => e.id), ['og1']);
  assert.deepEqual(filterExercises(list, { eq: 'dumbbell' }).map((e) => e.id), ['og2']);
  assert.deepEqual(filterExercises(list, { only: new Set(['og2']) }).map((e) => e.id), ['og2']);
});

test('regionLevelsFromWorkouts usa as regiões precisas do catálogo novo', async () => {
  const { regionLevelsFromWorkouts, regionsOf } = await import('./muscles.js');
  const cat = { q: { regions: ['quadriceps'] }, h: { regions: ['hamstring'] }, old: { muscle: 'chest', name: { en: 'x' } } };
  assert.deepEqual(regionsOf(cat.old), ['chest']);
  const ws = [{ started_at: '2026-10-10', exercises: [{ id: 'q', sets: [set(1, 1), set(1, 1)] }, { id: 'h', sets: [set(1, 1)] }] }];
  assert.deepEqual(regionLevelsFromWorkouts(ws, 0, (e) => cat[e.id]), { quadriceps: 4, hamstring: 2 });
});

// ---------- Plano semanal / rotação e planos prontos ----------

test('todaysRoutine: semana fixa (1 = segunda)', async () => {
  const { todaysRoutine, isoDay } = await import('./plan.js');
  assert.equal(isoDay('2026-10-12T12:00:00'), 1);
  assert.equal(isoDay('2026-10-18T12:00:00'), 7);
  const plan = { mode: 'week', week: { 1: 'r1', 3: 'r2' } };
  assert.equal(todaysRoutine(plan, { date: new Date('2026-10-12T12:00:00') }), 'r1');
  assert.equal(todaysRoutine(plan, { date: new Date('2026-10-13T12:00:00') }), null);
  assert.equal(todaysRoutine(plan, { date: new Date('2026-10-14T12:00:00'), routineIds: ['r1'] }), null);
});

test('todaysRoutine: rotação segue o último treino feito', async () => {
  const { todaysRoutine } = await import('./plan.js');
  const plan = { mode: 'rotation', rotation: ['a', 'b', 'c'] };
  assert.equal(todaysRoutine(plan, { workouts: [] }), 'a');
  assert.equal(todaysRoutine(plan, { workouts: [{ routine_id: 'b' }, { routine_id: 'a' }] }), 'c');
  assert.equal(todaysRoutine(plan, { workouts: [{ routine_id: null }, { routine_id: 'c' }] }), 'a');
  assert.equal(todaysRoutine(plan, { workouts: [{ routine_id: 'b' }], routineIds: ['a', 'c'] }), 'a');
  assert.equal(todaysRoutine({ mode: 'rotation', rotation: [] }), null);
});

test('prunePlan tira rotinas apagadas', async () => {
  const { prunePlan } = await import('./plan.js');
  assert.deepEqual(prunePlan({ mode: 'week', week: { 1: 'x', 2: 'y' }, rotation: ['x', 'y'] }, ['y']), {
    mode: 'week',
    week: { 2: 'y' },
    rotation: ['y'],
  });
});

test('buildStarterPlan monta rotinas com nomes no idioma e exercícios do catálogo', async () => {
  const { buildStarterPlan, STARTER_PLANS } = await import('./starter.js');
  const plan = buildStarterPlan('ppl', 'pt', (id) => ({ name: { en: 'Name ' + id }, gif: '/g/' + id }));
  assert.equal(plan.routines.length, 3);
  assert.equal(plan.routines[2].name, 'Pernas');
  assert.deepEqual(plan.schedule, STARTER_PLANS.ppl.schedule);
  const first = plan.routines[0].exercises[0];
  assert.equal(first.id, 'og0025');
  assert.equal(first.sets, 4);
  assert.equal(first.reps, 8);
  assert.equal(first.progression.type, 'linear');
  assert.equal(buildStarterPlan('nope', 'pt', () => null), null);
});

// ---------- Importar CSV (Hevy / Strong) ----------

test('parseCsv: aspas, vírgula dentro de aspas e ponto e vírgula', async () => {
  const { parseCsv } = await import('./importCsv.js');
  assert.deepEqual(parseCsv('a,b\n"x, y","z ""q"""\n'), [{ a: 'x, y', b: 'z "q"' }]);
  assert.deepEqual(parseCsv('﻿a;b\r\n1;2\r\n'), [{ a: '1', b: '2' }]);
});

test('Hevy: agrupa treinos, converte tipos e acha no catálogo', async () => {
  const { parseCsv, detectFormat, toWorkouts, buildNameIndex } = await import('./importCsv.js');
  const csv = [
    'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
    'Push,"11 Oct 2025, 18:00","11 Oct 2025, 19:05",,Bench Press (Barbell),,,0,warmup,40,10,,,',
    'Push,"11 Oct 2025, 18:00","11 Oct 2025, 19:05",,Bench Press (Barbell),,,1,normal,80,8,,,8.5',
    'Push,"11 Oct 2025, 18:00","11 Oct 2025, 19:05",,Weird Thing,,,0,dropset,10,12,,,',
    'Legs,"13 Oct 2025, 07:00","13 Oct 2025, 08:00",,Squat (Barbell),,,0,normal,100,5,,,',
  ].join('\n');
  const rows = parseCsv(csv);
  assert.equal(detectFormat(rows), 'hevy');
  const index = buildNameIndex([
    { id: 'og0025', name: { en: 'Barbell bench press' }, gif: '/s/25' },
    { id: 'og0043', name: { en: 'Barbell squat' }, gif: '/s/43' },
  ]);
  const { workouts, unmatched } = toWorkouts(rows, 'hevy', index);
  assert.equal(workouts.length, 2);
  assert.equal(workouts[0].name, 'Push');
  assert.equal(workouts[0].duration_min, 65);
  const bench = workouts[0].exercises[0];
  assert.equal(bench.id, 'og0025');
  assert.deepEqual(bench.sets, [
    { weight: 40, reps: 10, done: true, type: 'warmup' },
    { weight: 80, reps: 8, done: true, rpe: 8.5 },
  ]);
  assert.equal(workouts[0].exercises[1].id, 'custom:weird thing');
  assert.equal(workouts[0].exercises[1].sets[0].type, 'drop');
  assert.deepEqual(unmatched, ['Weird Thing']);
  assert.equal(workouts[1].exercises[0].id, 'og0043');
});

test('Strong: libras, duração e ordem W/D/F', async () => {
  const { parseCsv, detectFormat, toWorkouts, buildNameIndex, parseDuration } = await import('./importCsv.js');
  assert.equal(parseDuration('1h 5m'), 65);
  assert.equal(parseDuration('3600'), 60);
  const csv = [
    'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE',
    '2025-10-11 18:00:00;Upper;45m;Bench Press (Barbell);W;45;lbs;10;',
    '2025-10-11 18:00:00;Upper;45m;Bench Press (Barbell);1;100;lbs;8;9',
  ].join('\n');
  const rows = parseCsv(csv);
  assert.equal(detectFormat(rows), 'strong');
  const { workouts } = toWorkouts(rows, 'strong', buildNameIndex([{ id: 'og0025', name: { en: 'Barbell bench press' }, gif: 'x' }]));
  assert.equal(workouts.length, 1);
  assert.equal(workouts[0].duration_min, 45);
  const sets = workouts[0].exercises[0].sets;
  assert.equal(sets[0].type, 'warmup');
  assert.equal(sets[0].weight, 20.41);
  assert.equal(sets[1].weight, 45.36);
  assert.equal(sets[1].rpe, 9);
});

test('dropExisting ignora treinos já importados', async () => {
  const { dropExisting } = await import('./importCsv.js');
  const ws = [{ started_at: '2025-10-11T18:00:00.000Z' }, { started_at: '2025-10-12T18:00:00.000Z' }];
  assert.equal(dropExisting(ws, [{ started_at: '2025-10-11T18:00:30.000Z' }]).length, 1);
});

test('sortByName ordena pelo idioma, ignorando acentos e maiúsculas', async () => {
  const { sortByName } = await import('./exerciseFilter.js');
  const list = [{ name: { pt: 'Supino' } }, { name: { pt: 'abdominal' } }, { name: { pt: 'Ágil' } }];
  assert.deepEqual(sortByName(list, 'pt').map((e) => e.name.pt), ['abdominal', 'Ágil', 'Supino']);
});

// ---------- Coach com IA ----------

const catEx = (id, en, target, eq, cat = 'strength') => ({ id, name: { en }, target, eq, cat, gif: '/s/' + id });

test('buildCandidates respeita equipamento, categoria e objetivo', async () => {
  const { buildCandidates } = await import('./coach.js');
  const catalog = [
    catEx('og0025', 'barbell bench press', 'pectorals', 'barbell'),
    catEx('og0100', 'push-up', 'pectorals', 'body weight', 'calisthenics'),
    catEx('og0200', 'neck stretch', 'traps', 'body weight', 'stretching'),
    catEx('og0300', 'jumping jack', 'cardiovascular system', 'body weight', 'cardio'),
  ];
  const ids = (l) => l.map((e) => e.id).sort();
  assert.deepEqual(ids(buildCandidates(catalog, { equipment: ['body weight'], goal: 'hypertrophy' })), ['og0100']);
  assert.deepEqual(ids(buildCandidates(catalog, { equipment: ['body weight'], goal: 'fatloss' })), ['og0100', 'og0300']);
  assert.deepEqual(ids(buildCandidates(catalog, { equipment: ['body weight', 'barbell'] })), ['og0025', 'og0100']);
});

test('buildMessages leva o pedido, o idioma e a lista de exercícios', async () => {
  const { buildMessages } = await import('./coach.js');
  const msgs = buildMessages({ goal: 'strength', level: 'beginner', days: 3, minutes: 45, notes: 'dor no ombro' }, [catEx('og0025', 'barbell bench press', 'pectorals', 'barbell')], 'pt');
  assert.equal(msgs.length, 2);
  assert.match(msgs[0].content, /Brazilian Portuguese/);
  assert.match(msgs[1].content, /Training days per week: 3/);
  assert.match(msgs[1].content, /og0025\|barbell bench press\|pectorals\|barbell/);
  assert.match(msgs[1].content, /dor no ombro/);
});

test('validatePlan descarta ids inventados, limita números e não repete dias', async () => {
  const { validatePlan } = await import('./coach.js');
  const cat = { og0025: catEx('og0025', 'barbell bench press', 'pectorals', 'barbell'), og0043: catEx('og0043', 'barbell squat', 'quads', 'barbell') };
  const plan = validatePlan(
    {
      summary: 'Plano',
      routines: [
        { name: 'A', day: 3, notes: '', exercises: [{ id: 'og0025', sets: 50, reps: 0, rest: 5, progression: 'linear' }, { id: 'fake', sets: 3, reps: 10, rest: 60, progression: 'none' }, { id: 'og0025', sets: 3, reps: 8, rest: 90, progression: 'none' }] },
        { name: 'B', day: 3, notes: '', exercises: [{ id: 'og0043', sets: 4, reps: 12, rest: 120, progression: 'double' }] },
        { name: 'C', day: 5, notes: '', exercises: [{ id: 'nope', sets: 3, reps: 10, rest: 60, progression: 'none' }] },
      ],
    },
    (id) => cat[id]
  );
  assert.equal(plan.routines.length, 2);
  assert.deepEqual(plan.routines.map((r) => r.day), [3, 4]);
  const a = plan.routines[0].exercises;
  assert.equal(a.length, 1);
  assert.deepEqual([a[0].sets, a[0].reps, a[0].rest], [6, 1, 30]);
  assert.deepEqual(a[0].progression, { type: 'linear', increment: 2.5 });
  assert.deepEqual(plan.routines[1].exercises[0].progression, { type: 'double', increment: 2.5, repMin: 12, repMax: 16 });
  assert.equal(validatePlan({ routines: [] }, () => null), null);
  assert.equal(validatePlan(null, () => null), null);
});

test('outputText acha o texto na resposta da Responses API', async () => {
  const { outputText } = await import('./coach.js');
  assert.equal(outputText({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }] }), '{"a":1}');
  assert.equal(outputText({ output_text: 'x' }), 'x');
  assert.equal(outputText({ output: [] }), null);
});
