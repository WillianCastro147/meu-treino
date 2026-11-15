// Testes do quiz de entrada. Rode com: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, QUIZ_IMAGES, visibleSteps, isAnswered, toggleMulti, isValidEmail, estimateLevel, toCoachInput, cleanAnswers, planSummary, starterFor, resolve } from './quiz.js';
import { EQUIPMENT_PRESETS, GOALS, LEVELS, MINUTES } from './coach.js';
import { STARTER_PLANS } from './starter.js';

const full = {
  objetivo: 'definir',
  sexo: 'f',
  idade: '25–34',
  corpo: 'medio',
  meta: 'curvas',
  local: 'condominio',
  experiencia: '6m-2a',
  recente: 'parado',
  dias: 4,
  minutos: 45,
  foco: ['gluteos', 'pernas'],
  divisao: 'auto',
  limites: ['joelho'],
  barreiras: ['tempo'],
  horario: 'noite',
  sono: '7-8',
  altura: 165,
  peso: '68,5',
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
};

test('ids dos passos são únicos e toda imagem usada existe', () => {
  const ids = STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of STEPS) {
    if (s.img) assert.ok(QUIZ_IMAGES[s.img], `vaga ${s.img}`);
    for (const sexo of ['m', 'f']) {
      for (const o of resolve(s.options, { sexo }) || []) if (o.img) assert.ok(QUIZ_IMAGES[o.img], `vaga ${o.img}`);
    }
  }
});

test('começa pelo gênero; nome e e-mail ficam no fim', () => {
  const ids = STEPS.map((s) => s.id);
  assert.deepEqual(ids.slice(0, 2), ['sexo', 'objetivo']);
  assert.ok(resolve(STEPS[1].options, {}).every((o) => !o.img)); // objetivo: só texto
  assert.deepEqual(STEPS[0].options.map((o) => o.value), ['m', 'f']);
  assert.deepEqual(ids.slice(-2), ['nome', 'email']);
});

test('tela de limitação só aparece quando há limitação', () => {
  assert.ok(visibleSteps({ limites: ['ombro'] }).some((s) => s.id === 'info-limite'));
  assert.ok(!visibleSteps({ limites: ['nenhuma'] }).some((s) => s.id === 'info-limite'));
});

test('"Nenhuma" é exclusiva na múltipla escolha', () => {
  const opts = resolve(STEPS.find((s) => s.id === 'limites').options, {});
  assert.deepEqual(toggleMulti(['ombro'], 'nenhuma', opts), ['nenhuma']);
  assert.deepEqual(toggleMulti(['nenhuma'], 'joelho', opts), ['joelho']);
  assert.deepEqual(toggleMulti(['ombro', 'joelho'], 'ombro', opts), ['joelho']);
});

test('validação de respostas', () => {
  const altura = STEPS.find((s) => s.id === 'altura');
  const meta = STEPS.find((s) => s.id === 'pesoMeta');
  assert.equal(isAnswered(altura, { altura: 175 }), true);
  assert.equal(isAnswered(altura, { altura: 20 }), false);
  assert.equal(isAnswered(STEPS.find((s) => s.id === 'peso'), { peso: '68,5' }), true);
  assert.equal(isAnswered(meta, {}), true); // opcional
  assert.equal(isValidEmail('a@b.co'), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(' x y@b.com'), false);
});

test('nível estimado desce um degrau para quem está parado', () => {
  assert.equal(estimateLevel({ experiencia: 'nunca' }), 'beginner');
  assert.equal(estimateLevel({ experiencia: '2a+', recente: '3-4' }), 'advanced');
  assert.equal(estimateLevel({ experiencia: '2a+', recente: 'parado' }), 'intermediate');
  assert.equal(estimateLevel({ experiencia: '6m-2a', recente: 'parado' }), 'beginner');
});

test('respostas viram um pedido válido para o Coach', () => {
  const c = toCoachInput(full);
  assert.ok(GOALS.includes(c.goal));
  assert.ok(LEVELS.includes(c.level));
  assert.ok(MINUTES.includes(c.minutes));
  assert.equal(c.days, 4);
  assert.equal(c.goal, 'hypertrophy');
  assert.equal(c.level, 'beginner');
  const all = new Set(Object.values(EQUIPMENT_PRESETS).flat());
  assert.ok(c.equipment.every((e) => all.has(e)));
  assert.ok(c.notes.length <= 500);
  assert.match(c.notes, /glúteos/);
  assert.match(c.notes, /joelho/);
  assert.match(c.notes, /recomposição/);
  // Sem respostas: valores padrão seguros
  const d = toCoachInput({});
  assert.equal(d.days, 3);
  assert.equal(d.minutes, 60);
  assert.deepEqual(d.equipment, EQUIPMENT_PRESETS.gym);
});

test('cleanAnswers guarda só valores conhecidos', () => {
  const c = cleanAnswers({ ...full, objetivo: 'hack', foco: ['peito', 'xxx'], extra: 'lixo' });
  assert.equal(c.objetivo, undefined);
  assert.deepEqual(c.foco, ['peito']);
  assert.equal(c.extra, undefined);
  assert.equal(c.peso, 68.5);
  assert.equal(c.nome, undefined); // nome e e-mail vão em colunas próprias
  assert.equal(c.meta, 'curvas');
});

test('resumo e plano reserva', () => {
  assert.equal(planSummary(full).imc, 25.2); // peso ainda como texto "68,5"
  const s = planSummary(cleanAnswers(full));
  assert.equal(s.divisao, 'Superior / Inferior');
  assert.equal(s.cuidados, 'joelho');
  assert.equal(s.imc, 25.2);
  for (const dias of [2, 3, 4, 5, 6]) assert.ok(STARTER_PLANS[starterFor({ dias })]);
  assert.equal(starterFor({ objetivo: 'forca', dias: 5 }), '5x5');
});

test('checkout recebe e-mail, nome e UTMs', async () => {
  const { checkoutUrl, pickTracking } = await import('./quiz.js');
  const tracking = pickTracking('?utm_source=fb&utm_campaign=quiz1&foo=bar&fbclid=abc');
  assert.deepEqual(tracking, { utm_source: 'fb', utm_campaign: 'quiz1', fbclid: 'abc' });
  const u = new URL(checkoutUrl('https://pay.exemplo.com/abc?off=1', { email: 'Ana@Ex.com ', name: 'Ana', tracking }));
  assert.equal(u.searchParams.get('email'), 'ana@ex.com');
  assert.equal(u.searchParams.get('name'), 'Ana');
  assert.equal(u.searchParams.get('off'), '1');
  assert.equal(u.searchParams.get('utm_campaign'), 'quiz1');
  assert.equal(checkoutUrl('', { email: 'a@b.co' }), null);
});
