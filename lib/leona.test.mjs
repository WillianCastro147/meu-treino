import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarWhatsApp, payloadLeona, deveAvisarLeona, enviarLeona, leadRecente, payloadLead, enviarLeadLeona } from './leona.js';

const AGORA = Date.parse('2026-11-22T12:00:00Z');
const lead = (x = {}) => ({
  id: '0b7f2c1e-1234-4abc-9def-0123456789ab',
  email: 'Ana@Exemplo.com',
  name: 'Ana Souza',
  answers: { whatsapp: '62999998888' },
  updated_at: '2026-11-22T11:58:00Z',
  claimed_at: null,
  ...x,
});

test('lead: só o que acabou de ser salvo, não usado e com WhatsApp', () => {
  assert.equal(leadRecente(lead(), { agoraMs: AGORA }), true);
  assert.equal(leadRecente(lead({ updated_at: '2026-11-22T11:00:00Z' }), { agoraMs: AGORA }), false); // 1 h atrás
  assert.equal(leadRecente(lead({ claimed_at: '2026-11-22T11:59:00Z' }), { agoraMs: AGORA }), false);
  assert.equal(leadRecente(lead({ answers: {} }), { agoraMs: AGORA }), false);
  assert.equal(leadRecente(null), false);
});

test('lead: payload com link que abre o pagamento direto', async () => {
  const p = payloadLead(lead(), { appUrl: 'https://www.moviqgym.app' });
  assert.equal(p.evento, 'lead');
  assert.equal(p.primeiro_nome, 'Ana');
  assert.equal(p.telefone, '5562999998888');
  assert.equal(p.email, 'ana@exemplo.com');
  assert.equal(p.link, 'https://www.moviqgym.app/previa?l=0b7f2c1e-1234-4abc-9def-0123456789ab');
  assert.equal(p.link_pagamento, 'https://www.moviqgym.app/api/stripe/pagar?l=0b7f2c1e-1234-4abc-9def-0123456789ab');
  assert.equal(p.previa, p.link);
  let corpo = null;
  const fake = async (url, init) => ((corpo = JSON.parse(init.body)), { ok: true, text: async () => '' });
  assert.deepEqual(await enviarLeadLeona(lead(), { env: {}, fetch: fake, agoraMs: AGORA }), { skipped: 'sem_webhook' });
  assert.deepEqual(await enviarLeadLeona(lead(), { env: { LEONA_WEBHOOK_LEAD: 'https://x/hook' }, fetch: fake, agoraMs: AGORA }), { ok: true });
  assert.equal(corpo.evento, 'lead');
});

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
  assert.equal(p.previa, 'https://www.moviqgym.app/previa?s=cs_live_abc');
  const c = payloadLeona('comprou', sessao(), { appUrl: 'https://www.moviqgym.app' });
  assert.equal(c.link, 'https://www.moviqgym.app/login?modo=cadastro&email=ana%40exemplo.com');
  assert.equal(c.previa, ''); // quem comprou não precisa da prévia
  // abriu o pagamento: volta para a mesma página da Stripe
  const aberto = payloadLeona('checkout_aberto', { ...sessao(), url: 'https://checkout.stripe.com/c/pay/cs_live_abc' });
  assert.equal(aberto.evento, 'checkout_aberto');
  assert.equal(aberto.link, 'https://checkout.stripe.com/c/pay/cs_live_abc');
});

test('só avisa quiz em português, vitalício e com WhatsApp válido', () => {
  assert.equal(deveAvisarLeona(sessao()), true);
  assert.equal(deveAvisarLeona(sessao({ plano: 'premium' })), true);
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
