import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingStrings, applyTranslations, countUntranslated, checkBatch, styleExamples } from './details-i18n.mjs';

const en = {
  og1: ['A crunch.', ['Lie down.', 'Lift your chest.', 'Repeat.']],
  og2: ['A squat.', ['Stand tall.', 'Repeat.']],
  og3: ['A curl.', ['Hold the bar.', 'Curl it up.']],
};
// og1: descrição em inglês, passos meio traduzidos; og2: tudo em inglês; og3: passos com outra quantidade (já traduzidos)
const pt = {
  og1: ['A crunch.', ['Deite-se.', 'Lift your chest.', 'Repeat.']],
  og2: ['A squat.', ['Stand tall.', 'Repeat.']],
  og3: ['Uma rosca.', ['Segure a barra e suba.']],
};

test('pendingStrings: só o que está em inglês, sem repetir, sem o que já está no cache', () => {
  assert.deepEqual(pendingStrings(en, pt).sort(), ['A crunch.', 'A squat.', 'Lift your chest.', 'Repeat.', 'Stand tall.'].sort());
  assert.deepEqual(pendingStrings(en, pt, { 'Repeat.': 'Repita.', 'A crunch.': 'Um abdominal.' }).sort(), ['A squat.', 'Lift your chest.', 'Stand tall.'].sort());
});

test('applyTranslations: troca só o que está em inglês e mantém as traduções do openGym', () => {
  const cache = { 'A crunch.': 'Um abdominal.', 'Lift your chest.': 'Suba o peito.', 'Repeat.': 'Repita.', 'A squat.': 'Um agachamento.', 'Stand tall.': 'Fique em pé.' };
  const { details, replaced } = applyTranslations(en, pt, cache);
  assert.deepEqual(details.og1, ['Um abdominal.', ['Deite-se.', 'Suba o peito.', 'Repita.']]);
  assert.deepEqual(details.og2, ['Um agachamento.', ['Fique em pé.', 'Repita.']]);
  assert.deepEqual(details.og3, ['Uma rosca.', ['Segure a barra e suba.']]);
  assert.equal(replaced, 6);
  assert.equal(countUntranslated(en, details), 0);
  assert.equal(countUntranslated(en, pt), 6);
});

test('applyTranslations: sem tradução no cache, o texto continua em inglês (não some)', () => {
  const { details } = applyTranslations(en, pt, {});
  assert.deepEqual(details, pt);
});

test('checkBatch: exige a mesma quantidade de itens e nenhum vazio', () => {
  assert.ok(checkBatch(['a', 'b'], ['x', 'y']));
  assert.ok(!checkBatch(['a', 'b'], ['x']));
  assert.ok(!checkBatch(['a', 'b'], ['x', ' ']));
  assert.ok(!checkBatch(['a'], null));
});

test('styleExamples: usa pares já traduzidos do próprio catálogo', () => {
  const ex = styleExamples(
    { a: ['', ['Lie flat on your back with your knees bent and feet flat.']] },
    { a: ['', ['Deite-se de costas com os joelhos flexionados e os pés apoiados.']] }
  );
  assert.equal(ex.length, 1);
});
