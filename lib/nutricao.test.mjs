import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetas, montarCardapio, ALIMENTOS, REFEICOES, textoQtd } from './nutricao.js';

const homem = { sexo: 'm', idade: '25–34', altura: 175, peso: 78, dias: 3, objetivo: 'massa' };

test('metas: homem ganhando massa', () => {
  const m = calcularMetas(homem);
  // basal = 780 + 1093,75 - 150 + 5 = 1728,75; x1,45 = 2506,7; x1,1 = 2757 -> 2750
  assert.equal(m.kcal, 2750);
  assert.equal(m.proteina, 156); // 2 g/kg
  assert.equal(m.gordura, Math.round((0.25 * 2750) / 9));
  assert.equal(m.carboidrato, Math.round((2750 - 156 * 4 - m.gordura * 9) / 4));
  assert.equal(m.agua, 2.7);
  assert.equal(m.objetivo, 'ganhar massa muscular');
});

test('metas: déficit para perder gordura nunca fica abaixo do mínimo nem do basal', () => {
  const m = calcularMetas({ sexo: 'f', idade: '55+', altura: 150, peso: 50, dias: 2, objetivo: 'gordura' });
  assert.ok(m.kcal >= 1300);
  const pesada = calcularMetas({ sexo: 'f', idade: '35–44', altura: 160, peso: 110, dias: 3, objetivo: 'gordura' });
  // proteína pelo peso de referência (IMC 27 = 69,1 kg), não pelos 110 kg
  assert.equal(pesada.proteina, Math.round(2 * 27 * 1.6 * 1.6));
  assert.ok(pesada.kcal < calcularMetas({ sexo: 'f', idade: '35–44', altura: 160, peso: 110, dias: 3, objetivo: 'saude' }).kcal);
});

test('metas: aceita peso com vírgula e falta de dados', () => {
  assert.ok(calcularMetas({ ...homem, peso: '78,5' }));
  assert.equal(calcularMetas({ sexo: 'm' }), null);
  assert.ok(calcularMetas({ altura: 170, peso: 70 })); // sem sexo, idade e objetivo
});

test('cardápio: 5 refeições, opções perto da meta de cada refeição e quantidades legíveis', () => {
  const metas = calcularMetas(homem);
  const c = montarCardapio(metas);
  assert.equal(c.length, REFEICOES.length);
  assert.equal(Math.round(REFEICOES.reduce((s, r) => s + r.parte, 0) * 100), 100);
  for (const r of c) {
    for (const o of r.opcoes) {
      assert.ok(Math.abs(o.kcal - r.kcal) / r.kcal < 0.2, `${r.nome}: ${o.kcal} vs ${r.kcal}`);
      for (const it of o.itens) assert.ok(it.qtd && !/NaN|undefined/.test(it.qtd));
    }
  }
  assert.equal(montarCardapio(null).length, 0);
});

test('quantidades: unidades em meias, gramas de 10 em 10, salada à vontade', () => {
  assert.equal(textoQtd('ovo', 2), '2 unidades');
  assert.equal(textoQtd('pao', 1.5), '1,5 unidades');
  assert.equal(textoQtd('integral', 2), '2 fatias');
  assert.equal(textoQtd('azeite', 15), '15 g (2 colheres de sopa)');
  assert.equal(textoQtd('salada', 0), 'à vontade');
  assert.equal(textoQtd('arroz', 180), '180 g');
  assert.ok(textoQtd('azeite', 8).includes('colher'));
  for (const a of Object.values(ALIMENTOS)) assert.ok(a.nome && a.un);
});
