import test from 'node:test';
import assert from 'node:assert/strict';
import { lerAviso, produtosHotmart, idiomasHotmart, hottokValido } from './hotmart.js';

const produtos = produtosHotmart(
  {
    HOTMART_PRODUTO_VITALICIO: '111, 112',
    HOTMART_PRODUTO_PLANO_ALIMENTAR: '222',
    HOTMART_PRODUTO_ASSINATURA: '444',
  },
  {}
);

test('sem variável na Vercel, usa os IDs já cadastrados na Hotmart', () => {
  assert.deepEqual(produtosHotmart({}), { 9022148: 'vitalicio', 9022748: 'plano_alimentar', 9022760: 'gerador_ia' });
  // a variável, quando existe, tem prioridade
  assert.equal(produtosHotmart({ HOTMART_PRODUTO_VITALICIO: '555' })[555], 'vitalicio');
  assert.equal(produtosHotmart({ HOTMART_PRODUTO_VITALICIO: '555' })[9022148], undefined);
});

// Formato do aviso versão 2.0.0 (campos que o app usa)
const compra = (event, extra = {}) => ({
  id: 'evt-1',
  event,
  version: '2.0.0',
  data: {
    product: { id: 111, name: 'Moviq' },
    buyer: { email: ' Ana@Ex.com ', name: 'Ana Souza' },
    purchase: {
      transaction: 'HP123',
      status: 'APPROVED',
      recurrence_number: 1,
      origin: { src: 'fb', sck: 'camp1', xcod: '' },
      ...extra,
    },
  },
});

test('mapeia IDs de produto (vários por variável) para o plano', () => {
  assert.deepEqual(produtos, { 111: 'vitalicio', 112: 'vitalicio', 222: 'plano_alimentar', 444: 'assinatura' });
});

test('compra aprovada libera o plano do produto, com e-mail em minúsculas', () => {
  const a = lerAviso(compra('PURCHASE_APPROVED'), produtos);
  assert.equal(a.acao, 'liberar');
  assert.equal(a.plano, 'vitalicio');
  assert.equal(a.email, 'ana@ex.com');
  assert.equal(a.nome, 'Ana Souza');
  assert.equal(a.transacao, 'HP123');
  assert.equal(a.renovacao, false);
  assert.equal(a.orderBump, false);
  assert.deepEqual(a.origem, { src: 'fb', sck: 'camp1', xcod: '' });
});

test('renovação e order bump são reconhecidos', () => {
  assert.equal(lerAviso(compra('PURCHASE_APPROVED', { recurrence_number: 3 }), produtos).renovacao, true);
  const bump = compra('PURCHASE_APPROVED', { order_bump: { is_order_bump: true, parent_purchase_transaction: 'HP100' } });
  bump.data.product.id = 222;
  const a = lerAviso(bump, produtos);
  assert.equal(a.orderBump, true);
  assert.equal(a.plano, 'plano_alimentar');
});

test('reembolso, chargeback e cancelamento cortam o acesso da compra', () => {
  assert.deepEqual(
    ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED'].map((e) => {
      const a = lerAviso(compra(e), produtos);
      return [a.acao, a.status, a.transacao];
    }),
    [
      ['cortar', 'refunded', 'HP123'],
      ['cortar', 'chargeback', 'HP123'],
      ['cortar', 'canceled', 'HP123'],
    ]
  );
});

test('cancelamento de assinatura vale até a próxima cobrança', () => {
  const a = lerAviso(
    {
      event: 'SUBSCRIPTION_CANCELLATION',
      data: {
        product: { id: 444 },
        subscriber: { code: 'SUB9', email: 'Bia@Ex.com', name: 'Bia' },
        date_next_charge: Date.UTC(2026, 11, 20),
      },
    },
    produtos
  );
  assert.equal(a.acao, 'cancelar_assinatura');
  assert.equal(a.plano, 'assinatura');
  assert.equal(a.email, 'bia@ex.com');
  assert.equal(a.assinante, 'SUB9');
  assert.equal(a.fimDoPeriodo, '2026-12-20T00:00:00.000Z');
});

test('produto do quiz em espanhol: libera o vitalício e marca a compra como espanhol', () => {
  const env = { HOTMART_PRODUTO_VITALICIO: '111', HOTMART_PRODUTO_VITALICIO_ES: '777' };
  const prods = produtosHotmart(env, {});
  const idiomas = idiomasHotmart(env, {});
  assert.deepEqual(idiomas, { 777: 'es' });
  const es = compra('PURCHASE_APPROVED');
  es.data.product.id = 777;
  const a = lerAviso(es, prods, idiomas);
  assert.equal(a.plano, 'vitalicio');
  assert.equal(a.lang, 'es');
  // produto em português continua sem idioma (e-mail em português)
  assert.equal(lerAviso(compra('PURCHASE_APPROVED'), prods, idiomas).lang, null);
  // sem a variável na Vercel, nenhum produto é espanhol
  assert.deepEqual(idiomasHotmart({}), {});
});

test('eventos que o app não usa e produto desconhecido', () => {
  assert.equal(lerAviso(compra('PURCHASE_BILLET_PRINTED'), produtos), null);
  assert.equal(lerAviso({}, produtos), null);
  const outro = compra('PURCHASE_APPROVED');
  outro.data.product.id = 999;
  assert.equal(lerAviso(outro, produtos).plano, null);
});

test('hottok: só aceita o código exato', () => {
  assert.equal(hottokValido('abc123', 'abc123'), true);
  assert.equal(hottokValido('abc124', 'abc123'), false);
  assert.equal(hottokValido('abc', 'abc123'), false);
  assert.equal(hottokValido('', 'abc123'), false);
  assert.equal(hottokValido('abc123', ''), false);
});
