import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  situacao,
  deveRecuperar,
  listaRecuperacao,
  telefoneWhatsApp,
  linkWhatsApp,
  mensagemWhatsApp,
  buildRecoveryEmail,
  linkRecuperacao,
} from './recuperacao.js';

const sessao = (o = {}) => ({
  id: 'cs_live_a1',
  created: 1000,
  status: 'complete',
  payment_status: 'unpaid',
  payment_intent: { status: 'requires_payment_method' },
  customer_email: 'ana@x.com',
  amount_total: 3700,
  metadata: { plano: 'vitalicio', nome: 'Ana Paula', utm_campaign: 'CP 1' },
  customer_details: { email: 'Ana@X.com', phone: '+5562999998888', name: 'ANA P SOUZA' },
  ...o,
});

test('situação: pago, pix pendente, pix expirado, abandonado, aberto', () => {
  assert.equal(situacao(sessao({ payment_status: 'paid' })), 'pago');
  assert.equal(situacao(sessao({ payment_intent: { status: 'requires_action' } })), 'pix_pendente');
  assert.equal(situacao(sessao()), 'pix_expirado');
  assert.equal(situacao(sessao({ status: 'expired' })), 'abandonado');
  assert.equal(situacao(sessao({ status: 'open' })), 'aberto');
});

test('recupera só a tentativa mais recente e nunca quem pagou em outra', () => {
  const a = sessao({ id: 'cs_live_a', created: 1000 });
  const b = sessao({ id: 'cs_live_b', created: 2000, status: 'expired' });
  assert.equal(deveRecuperar(a, [a, b]), false); // existe uma mais nova
  assert.equal(deveRecuperar(b, [a, b]), true);
  const paga = sessao({ id: 'cs_live_c', created: 500, payment_status: 'paid' });
  assert.equal(deveRecuperar(b, [a, b, paga]), false);
  assert.equal(deveRecuperar(sessao({ customer_email: '', customer_details: {} }), []), false);
});

test('lista: uma linha por pessoa, sem quem pagou, sem Pix ainda no prazo nem pagamento aberto há pouco', () => {
  const linhas = listaRecuperacao(
    [
      sessao({ id: 'cs_live_1', created: 1000 }),
      sessao({ id: 'cs_live_2', created: 2000 }), // mesma pessoa, mais recente
      sessao({ id: 'cs_live_3', customer_email: 'b@x.com', customer_details: { email: 'b@x.com' }, payment_status: 'paid' }),
      sessao({ id: 'cs_live_4', customer_email: 'c@x.com', customer_details: { email: 'c@x.com' }, payment_intent: { status: 'requires_action' } }),
      sessao({ id: 'cs_live_5', customer_email: 'd@x.com', customer_details: { email: 'd@x.com' }, status: 'open', created: 9500 }),
      sessao({ id: 'cs_live_6', customer_email: 'e@x.com', customer_details: { email: 'e@x.com' }, status: 'open', created: 1000 }),
    ],
    { agora: 10000, appUrl: 'https://www.moviqgym.app' }
  );
  assert.deepEqual(
    linhas.map((l) => [l.id, l.situacao]),
    [
      ['cs_live_2', 'pix_expirado'],
      ['cs_live_6', 'aberto'],
    ]
  );
  const ana = linhas[0];
  assert.equal(ana.email, 'ana@x.com');
  assert.equal(ana.nome, 'Ana Paula'); // nome do quiz, não o do cartão
  assert.equal(ana.tentativas, 2);
  assert.equal(ana.valor, 'R$ 37,00');
  assert.equal(ana.link, 'https://www.moviqgym.app/api/stripe/recuperar?s=cs_live_2&c=whatsapp');
  assert.ok(ana.whatsapp.startsWith('https://wa.me/5562999998888?text='));
});

test('telefone para WhatsApp', () => {
  assert.equal(telefoneWhatsApp('+55 62 99999-8888'), '5562999998888');
  assert.equal(telefoneWhatsApp('(62) 99999-8888'), '5562999998888');
  assert.equal(telefoneWhatsApp('+351912345678'), '351912345678');
  assert.equal(telefoneWhatsApp(''), '');
  assert.equal(linkWhatsApp('', 'oi'), '');
});

test('mensagem de WhatsApp com primeiro nome, valor e link', () => {
  const pix = mensagemWhatsApp({ nome: 'Ana Paula', situacao: 'pix_expirado', valor: 'R$ 37,00', link: 'L' });
  assert.match(pix, /^Oi, Ana! Aqui é do Moviq\./);
  assert.match(pix, /Pix de R\$ 37,00 expirou/);
  assert.ok(pix.endsWith('L'));
  assert.match(mensagemWhatsApp({ situacao: 'abandonado', link: 'L' }), /^Oi! .*não finalizou o pagamento/);
});

test('e-mail de recuperação: Pix expirado x abandonado, link e HTML escapado', () => {
  const link = linkRecuperacao('https://www.moviqgym.app/', 'cs_live_9', 'email');
  assert.equal(link, 'https://www.moviqgym.app/api/stripe/recuperar?s=cs_live_9&c=email');
  const pix = buildRecoveryEmail({ email: 'a@x.com', nome: 'Ana', situacao: 'pix_expirado', valor: 'R$ 37,00', link });
  assert.equal(pix.subject, 'Seu Pix do Moviq expirou');
  assert.ok(pix.html.includes('Gerar novo Pix'));
  assert.ok(pix.html.includes('s=cs_live_9&amp;c=email'));
  assert.ok(pix.text.includes(link));
  const ab = buildRecoveryEmail({ email: 'a@x.com', nome: '<b>x</b>', situacao: 'abandonado', link });
  assert.equal(ab.subject, 'Seu plano de treino ficou esperando');
  assert.ok(!ab.html.includes('<b>x</b>'));
});
