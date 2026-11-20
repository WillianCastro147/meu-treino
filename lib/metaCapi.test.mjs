import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizar, montarFbc, dadosDoNavegador, dadosDoClique, eventoCompra, enviarCompraMeta } from './metaCapi.js';

const sha = (v) => createHash('sha256').update(v).digest('hex');

test('normaliza como a Meta pede antes do hash', () => {
  assert.equal(normalizar.email('  Ana@Ex.COM '), 'ana@ex.com');
  assert.equal(normalizar.telefone('(11) 98765-4321'), '5511987654321');
  assert.equal(normalizar.telefone('+55 11 98765-4321'), '5511987654321');
  assert.equal(normalizar.nome('José'), 'jose');
  assert.equal(normalizar.cidade('São Paulo'), 'saopaulo');
  assert.equal(normalizar.estado('SP'), 'sp');
  assert.equal(normalizar.cep('01310-100'), '01310100');
  assert.equal(normalizar.pais('BR'), 'br');
});

test('fbc: usa o cookie; sem cookie, monta a partir do fbclid', () => {
  assert.equal(montarFbc('fb.1.1700000000000.AbC', 'xyz'), 'fb.1.1700000000000.AbC');
  assert.equal(montarFbc('', 'IwAR123', 1700000000000), 'fb.1.1700000000000.IwAR123');
  assert.equal(montarFbc('lixo', ''), '');
});

test('dados do navegador: cookies do pixel, IP (primeiro do x-forwarded-for), navegador e página', () => {
  const headers = new Map(
    Object.entries({
      cookie: 'a=1; _fbp=fb.1.1700000000000.123456789; _fbc=fb.1.1700000000001.IwAR9',
      'x-forwarded-for': '200.1.2.3, 10.0.0.1',
      'user-agent': 'Mozilla/5.0 Teste',
      referer: 'https://quiz.moviqgym.app/?utm_source=fb',
    })
  );
  assert.deepEqual(dadosDoNavegador({ headers }), {
    meta_fbp: 'fb.1.1700000000000.123456789',
    meta_fbc: 'fb.1.1700000000001.IwAR9',
    meta_ip: '200.1.2.3',
    meta_ua: 'Mozilla/5.0 Teste',
    meta_url: 'https://quiz.moviqgym.app/',
  });
  // sem cookie _fbc: monta pelo fbclid que veio no formulário
  const d = dadosDoNavegador({ headers: new Map(), body: { fbclid: 'IwARx' }, agoraMs: 1700000000000 });
  assert.deepEqual(d, { meta_fbc: 'fb.1.1700000000000.IwARx' });
});

test('recuperação/upsell: dados do clique original têm prioridade', () => {
  assert.deepEqual(dadosDoClique({ meta_fbc: 'fb.1.1.A', plano: 'vitalicio' }, { meta_fbc: 'fb.1.2.B', meta_ip: '1.1.1.1' }), {
    meta_fbc: 'fb.1.1.A',
    meta_ip: '1.1.1.1',
  });
});

const sessao = {
  id: 'cs_live_abc',
  created: 1700000000,
  currency: 'brl',
  amount_total: 8480,
  customer_email: null,
  customer_details: {
    email: 'Ana@Ex.com',
    name: 'Ana Maria Souza',
    phone: '+5511987654321',
    address: { city: 'São Paulo', state: 'SP', postal_code: '01310-100', country: 'BR' },
  },
  metadata: {
    plano: 'vitalicio',
    nome: 'Ana Souza',
    meta_fbp: 'fb.1.1700000000000.123',
    meta_fbc: 'fb.1.1700000000001.IwAR9',
    meta_ip: '200.1.2.3',
    meta_ua: 'Mozilla/5.0 Teste',
    meta_url: 'https://quiz.moviqgym.app/',
  },
};

test('evento de Compra: ID fixo por pagamento, valor total e dados do comprador em hash', () => {
  const e = eventoCompra(sessao, { agoraMs: 1700000100000 });
  assert.equal(e.event_name, 'Purchase');
  assert.equal(e.event_id, 'purchase_cs_live_abc');
  assert.equal(e.event_time, 1700000100);
  assert.equal(e.action_source, 'website');
  assert.deepEqual(e.custom_data, { currency: 'BRL', value: 84.8, content_name: 'moviq-vitalicio', content_type: 'product', order_id: 'cs_live_abc' });
  assert.deepEqual(e.user_data.em, [sha('ana@ex.com')]);
  assert.deepEqual(e.user_data.external_id, [sha('ana@ex.com')]);
  assert.deepEqual(e.user_data.ph, [sha('5511987654321')]);
  assert.equal(e.user_data.fn, sha('ana')); // nome do quiz tem prioridade sobre o do cartão
  assert.equal(e.user_data.ln, sha('souza'));
  assert.equal(e.user_data.ct, sha('saopaulo'));
  assert.equal(e.user_data.fbc, 'fb.1.1700000000001.IwAR9');
  assert.equal(e.user_data.fbp, 'fb.1.1700000000000.123');
  assert.equal(e.user_data.client_ip_address, '200.1.2.3');
  assert.equal(e.user_data.client_user_agent, 'Mozilla/5.0 Teste');
  // nada de e-mail em texto puro
  assert.ok(!JSON.stringify(e).includes('ana@ex.com'));
});

test('evento sem dados do clique: usa o fbclid das UTMs e omite o que não tem', () => {
  const e = eventoCompra({ id: 'cs_1', created: 1700000000, amount_total: 3700, customer_details: { email: 'a@b.co' }, metadata: { fbclid: 'IwARz' } });
  assert.equal(e.user_data.fbc, 'fb.1.1700000000000.IwARz');
  assert.equal('fbp' in e.user_data, false);
  assert.equal('client_ip_address' in e.user_data, false);
});

test('envio: sem token não chama a Meta; com token manda para o pixel certo', async () => {
  let chamado = null;
  const fakeFetch = async (url, init) => {
    chamado = { url, corpo: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ events_received: 1, fbtrace_id: 'T' }) };
  };
  assert.deepEqual(await enviarCompraMeta(sessao, { token: '', fetch: fakeFetch }), { skipped: 'sem_token' });
  assert.equal(chamado, null);
  assert.deepEqual(await enviarCompraMeta({ ...sessao, amount_total: 0 }, { token: 'x', fetch: fakeFetch }), { skipped: 'sem_valor' });

  const r = await enviarCompraMeta(sessao, { token: 'tok', pixelId: '999', versao: 'v24.0', testCode: 'TEST1', fetch: fakeFetch });
  assert.deepEqual(r, { ok: true, recebidos: 1, trace: 'T' });
  assert.ok(chamado.url.startsWith('https://graph.facebook.com/v24.0/999/events?access_token=tok'));
  assert.equal(chamado.corpo.test_event_code, 'TEST1');
  assert.equal(chamado.corpo.data[0].event_id, 'purchase_cs_live_abc');
});

test('envio: erro da Meta vira exceção (sem expor o token)', async () => {
  const fakeFetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid OAuth access token' } }) });
  await assert.rejects(enviarCompraMeta(sessao, { token: 'segredo', fetch: fakeFetch }), (e) => {
    assert.match(e.message, /Meta 400/);
    assert.ok(!e.message.includes('segredo'));
    return true;
  });
});
