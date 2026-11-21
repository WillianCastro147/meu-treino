import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarWhatsApp, payloadLeona, deveAvisarLeona, enviarLeona } from './leona.js';

const sessao = (md = {}) => ({
  id: 'cs_live_abc',
  amount_total: 3700,
  customer_details: { email: 'Ana@Exemplo.com', name: 'Titular Cartão' },
  metadata: { plano: 'vitalicio', nome: 'Ana Souza', whatsapp: '62999998888', ...md },
});

test('WhatsApp do Brasil: aceita com ou sem 55, com máscara; recusa número inválido', () => {
  assert.equal(normalizarWhatsApp('(62) 99999-8888'), '5562999998888');
  assert.equal(normalizarWhatsApp('+55 62 99999-8888'), '5562999998888');
  assert.equal(normalizarWhatsApp('6233334444'), '556233334444'); // fixo com 10 dígitos
  assert.equal(normalizarWhatsApp('62 89999-8888'), ''); // 11 dígitos sem o 9
  assert.equal(normalizarWhatsApp('9999-8888'), ''); // sem DDD
  assert.equal(normalizarWhatsApp(''), '');
});

test('payload: nome do quiz, telefone com 55 e link certo por evento', () => {
  const p = payloadLeona('pix_expirado', sessao(), { appUrl: 'https://www.moviqgym.app/' });
  assert.equal(p.nome, 'Ana Souza');
  assert.equal(p.primeiro_nome, 'Ana');
  assert.equal(p.telefone, '5562999998888');
  assert.equal(p.email, 'ana@exemplo.com');
  assert.equal(p.valor, 'R$ 37,00');
  assert.equal(p.link, 'https://www.moviqgym.app/api/stripe/recuperar?s=cs_live_abc&c=whatsapp');
  const c = payloadLeona('comprou', sessao(), { appUrl: 'https://www.moviqgym.app' });
  assert.equal(c.link, 'https://www.moviqgym.app/login?modo=cadastro&email=ana%40exemplo.com');
});

test('só avisa quiz em português, vitalício e com WhatsApp válido', () => {
  assert.equal(deveAvisarLeona(sessao()), true);
  assert.equal(deveAvisarLeona(sessao({ lang: 'es' })), false);
  assert.equal(deveAvisarLeona(sessao({ plano: 'plano_alimentar' })), false);
  assert.equal(deveAvisarLeona(sessao({ whatsapp: '' })), false);
});

test('envio: sem webhook não chama; com webhook manda o JSON', async () => {
  let chamada = null;
  const fake = async (url, init) => ((chamada = { url, init }), { ok: true, text: async () => '' });
  assert.deepEqual(await enviarLeona('comprou', sessao(), { env: {}, fetch: fake }), { skipped: 'sem_webhook' });
  assert.equal(chamada, null);
  const env = { LEONA_WEBHOOK_COMPROU: 'https://leona.exemplo/hook' };
  assert.deepEqual(await enviarLeona('comprou', sessao({ whatsapp: '' }), { env, fetch: fake }), { skipped: 'fora_do_publico' });
  assert.deepEqual(await enviarLeona('comprou', sessao(), { env, fetch: fake }), { ok: true });
  assert.equal(chamada.url, 'https://leona.exemplo/hook');
  assert.equal(JSON.parse(chamada.init.body).evento, 'comprou');
});

test('envio: erro do LeonaFlow vira exceção', async () => {
  const env = { LEONA_WEBHOOK_PIX_GERADO: 'https://leona.exemplo/hook' };
  const fake = async () => ({ ok: false, status: 500, text: async () => 'erro' });
  await assert.rejects(enviarLeona('pix_gerado', sessao(), { env, fetch: fake }), /LeonaFlow 500/);
});
