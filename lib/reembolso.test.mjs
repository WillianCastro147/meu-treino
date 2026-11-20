import test from 'node:test';
import assert from 'node:assert/strict';
import { planosDaCompra, planosDoReembolso } from './reembolso.js';

const extras = [
  { plano: 'plano_alimentar', price: 'price_pa' },
  { plano: 'gerador_ia', price: 'price_ia' },
];
const app = { price: 'price_app', amount_total: 3700 };
const pa = { price: 'price_pa', amount_total: 1990 };
const ia = { price: 'price_ia', amount_total: 2790 };

test('compra libera o app e os bumps marcados; extra sozinho libera só ele', () => {
  assert.deepEqual(planosDaCompra({ plano: 'vitalicio', itens: [app], extras }), ['vitalicio']);
  assert.deepEqual(planosDaCompra({ plano: 'vitalicio', itens: [app, pa, ia], extras }), ['vitalicio', 'plano_alimentar', 'gerador_ia']);
  assert.deepEqual(planosDaCompra({ plano: 'gerador_ia', itens: [ia], extras }), ['gerador_ia']);
  // sessão antiga sem metadata: pagamento único é o vitalício
  assert.deepEqual(planosDaCompra({ plano: undefined, itens: [app], extras }), ['vitalicio']);
});

test('reembolso total tira tudo o que a compra liberou', () => {
  const itens = [app, pa];
  assert.deepEqual(planosDoReembolso({ plano: 'vitalicio', itens, extras, total: 5690, reembolsado: 5690 }), ['vitalicio', 'plano_alimentar']);
  assert.deepEqual(planosDoReembolso({ plano: 'plano_alimentar', itens: [pa], extras, total: 1990, reembolsado: 1990 }), ['plano_alimentar']);
});

test('reembolso parcial tira só o bump com o mesmo valor', () => {
  const itens = [app, pa, ia];
  assert.deepEqual(planosDoReembolso({ plano: 'vitalicio', itens, extras, total: 8480, reembolsado: 1990 }), ['plano_alimentar']);
  assert.deepEqual(planosDoReembolso({ plano: 'vitalicio', itens, extras, total: 8480, reembolsado: 2790 }), ['gerador_ia']);
  assert.deepEqual(planosDoReembolso({ plano: 'vitalicio', itens, extras, total: 8480, reembolsado: 4780 }), ['plano_alimentar', 'gerador_ia']);
});

test('reembolso parcial sem correspondência não tira nada (conferir à mão)', () => {
  assert.deepEqual(planosDoReembolso({ plano: 'vitalicio', itens: [app, pa], extras, total: 5690, reembolsado: 1000 }), []);
  assert.deepEqual(planosDoReembolso({ plano: 'vitalicio', itens: [app], extras, total: 3700, reembolsado: 0 }), []);
});
