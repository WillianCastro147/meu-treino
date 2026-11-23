import test from 'node:test';
import assert from 'node:assert/strict';
import { ofertasPosCompra, extraDoPlano, GUIA_FEMININO } from './stripe.js';

test('depois da compra: guia feminino só para quem marcou feminino no quiz', () => {
  assert.deepEqual(ofertasPosCompra('f').map((e) => e.plano), [GUIA_FEMININO]);
  assert.deepEqual(ofertasPosCompra('m'), []); // guia masculino ainda não existe
  assert.deepEqual(ofertasPosCompra(null), []);
});

test('plano alimentar e gerador com IA não são mais oferecidos depois da compra', () => {
  const planos = [...ofertasPosCompra('f'), ...ofertasPosCompra('m')].map((e) => e.plano);
  assert.ok(!planos.includes('plano_alimentar'));
  assert.ok(!planos.includes('gerador_ia'));
});

test('o guia é um extra vendável (checkout, upsell e webhook o reconhecem)', () => {
  const g = extraDoPlano(GUIA_FEMININO);
  assert.equal(g.link, '/guia');
  assert.match(g.price, /^price_/);
});
