import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildReadyChallenge,
  buildChallengeCandidates,
  buildChallengeMessages,
  validateChallenge,
  challengeProgress,
  challengeRoutineIds,
  normalizeChallenge,
  withChallenge,
  READY_EXERCISE_IDS,
  CHALLENGE_DAYS,
} from './challenge.js';
import { normalizePlan, prunePlan } from './plan.js';
import { toChallengeInput } from './quiz.js';

const raw = JSON.parse(fs.readFileSync(new URL('../public/catalog/exercises.json', import.meta.url), 'utf8'));
const catalog = raw.map((e) => ({ id: e.id, name: { en: e.n[0], pt: e.n[1] }, target: e.t, eq: e.eq, cat: e.c, gif: `/media/still/${e.id.slice(2)}.webp` }));
const byId = new Map(catalog.map((e) => [e.id, e]));
const find = (id) => byId.get(id);

test('desafio pronto: 21 dias, só exercícios do catálogo com peso do corpo, mais puxado a cada semana', () => {
  for (const id of READY_EXERCISE_IDS) {
    assert.ok(find(id), `exercício ${id} existe`);
    assert.equal(find(id).eq, 'body weight', `${id} é com peso do corpo`);
  }
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    const c = buildReadyChallenge(level, 'pt', find);
    assert.equal(c.days.length, CHALLENGE_DAYS);
    assert.match(c.days[0].name, /^Dia 1 · /);
    assert.match(c.days[20].name, /^Dia 21 · /);
    c.days.forEach((d) => assert.ok(d.exercises.length >= 4 && d.notes));
    // dia 1 e dia 15 são do mesmo tipo (superior): a semana 3 tem mais repetições
    assert.ok(c.days[14].exercises[0].reps > c.days[0].exercises[0].reps);
  }
  const iniciante = buildReadyChallenge('beginner', 'pt', find).days[0].exercises[0];
  const avancado = buildReadyChallenge('advanced', 'pt', find).days[0].exercises[0];
  assert.notEqual(iniciante.id, avancado.id); // variação mais fácil para iniciante
  assert.match(buildReadyChallenge('beginner', 'xx', find).days[0].name, /^Day 1/); // idioma desconhecido: inglês
});

test('candidatos para a IA: só peso do corpo, sem barra/banco/caixa', () => {
  const c = buildChallengeCandidates(catalog);
  assert.ok(c.length > 100 && c.length < 600, `tamanho ${c.length}`);
  assert.ok(c.every((e) => e.eq === 'body weight'));
  assert.ok(!c.some((e) => /\b(pull[- ]?ups?|bench|box|bar)\b/i.test(e.name.en)));
  assert.ok(READY_EXERCISE_IDS.every((id) => c.some((e) => e.id === id)));
  const [system, user] = buildChallengeMessages({ level: 'beginner', minutes: 30, notes: 'dor no joelho' }, c, 'pt');
  assert.match(system.content, /21-day/);
  assert.match(system.content, /Brazilian Portuguese/);
  assert.match(user.content, /dor no joelho/);
});

test('validateChallenge: exige 21 dias, filtra ids desconhecidos ou com equipamento e limita os números', () => {
  const day = (ids) => ({ name: 'Dia', notes: 'ok', exercises: ids.map((id) => ({ id, sets: 9, reps: 999, rest: 1 })) });
  assert.equal(validateChallenge({ summary: '', days: Array.from({ length: 20 }, () => day(['og0662'])) }, find), null);
  const dumbbell = catalog.find((e) => e.eq === 'dumbbell').id;
  const ok = validateChallenge({ summary: 'Resumo', days: Array.from({ length: 22 }, () => day(['og0662', 'og9999999', dumbbell, 'og0662'])) }, find);
  assert.equal(ok.days.length, 21);
  assert.deepEqual(ok.days[0].exercises.map((x) => x.id), ['og0662']);
  assert.deepEqual([ok.days[0].exercises[0].sets, ok.days[0].exercises[0].reps, ok.days[0].exercises[0].rest], [5, 50, 15]);
  // um dia sem nenhum exercício válido derruba a resposta (aí entra o desafio pronto)
  const bad = Array.from({ length: 21 }, () => day(['og0662']));
  bad[5] = day([dumbbell]);
  assert.equal(validateChallenge({ summary: '', days: bad }, find), null);
});

const ids = Array.from({ length: 21 }, (_, i) => `r${i + 1}`);
const plan = withChallenge({ mode: 'week', week: { 1: 'x' }, rotation: [] }, ids, buildReadyChallenge('beginner', 'pt', find), new Date('2026-11-01T10:00:00Z'));

test('progresso: dias liberados um depois do outro, contando só treinos depois do início', () => {
  const ch = plan.challenge;
  let p = challengeProgress(ch, []);
  assert.deepEqual([p.done, p.next, p.days[0], p.days[1]], [0, 0, 'next', 'locked']);
  p = challengeProgress(ch, [
    { routine_id: 'r1', started_at: '2026-11-02T10:00:00Z' },
    { routine_id: 'r2', started_at: '2026-11-03T10:00:00Z' },
    { routine_id: 'r3', started_at: '2026-10-01T10:00:00Z' }, // antes do início: não conta
    { routine_id: 'outra', started_at: '2026-11-03T10:00:00Z' },
  ]);
  assert.deepEqual([p.done, p.next, p.days[2], p.days[3], p.finished], [2, 2, 'next', 'locked', false]);
  p = challengeProgress(ch, ids.map((id) => ({ routine_id: id, started_at: '2026-11-05T10:00:00Z' })));
  assert.deepEqual([p.done, p.next, p.finished], [21, -1, true]);
});

test('plano: guarda o desafio, esconde as rotinas dele e some se uma rotina do desafio for apagada', () => {
  const n = normalizePlan(plan);
  assert.equal(n.challenge.days.length, 21);
  assert.equal(n.week[1], 'x');
  assert.equal(challengeRoutineIds(n).size, 21);
  assert.equal(challengeRoutineIds(normalizePlan(null)).size, 0);
  assert.equal(normalizeChallenge({ kind: 'calistenia21', days: [] }), null);
  assert.ok(prunePlan(n, ['x', ...ids]).challenge);
  assert.equal(prunePlan(n, ['x', ...ids.slice(1)]).challenge, undefined);
});

test('quiz: só quem disse sim ganha o desafio, com nível, tempo e limitações', () => {
  assert.equal(toChallengeInput({ desafio: 'nao' }), null);
  assert.equal(toChallengeInput({}), null);
  const input = toChallengeInput({ desafio: 'sim', minutos: 60, experiencia: 'nunca', limites: ['joelho'], sexo: 'f' });
  assert.equal(input.minutes, 45);
  assert.equal(input.lang, 'pt');
  assert.ok(['beginner', 'intermediate', 'advanced'].includes(input.level));
  assert.match(input.notes, /feminino/);
});
