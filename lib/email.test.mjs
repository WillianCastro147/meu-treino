import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWelcomeEmail, sendWelcomeEmail } from './email.js';

test('e-mail de boas-vindas: link de cadastro com o e-mail da compra e o primeiro nome', () => {
  const { subject, html, text } = buildWelcomeEmail({ email: 'Ana@Exemplo.com ', name: 'Ana Paula Souza', appUrl: 'https://www.moviqgym.app/' });
  assert.match(subject, /Moviq/);
  assert.ok(html.includes('https://www.moviqgym.app/login?modo=cadastro&amp;email=ana%40exemplo.com&amp;name=Ana'));
  assert.ok(text.includes('https://www.moviqgym.app/login?modo=cadastro&email=ana%40exemplo.com&name=Ana'));
  assert.ok(html.includes('Olá, Ana!'));
  assert.ok(html.includes('www.moviqgym.app/instalar'));
  assert.ok(text.includes('Guarde o endereço do app: www.moviqgym.app'));
});

test('e-mail de boas-vindas: escapa HTML no nome e funciona sem nome', () => {
  const { html } = buildWelcomeEmail({ email: 'x@y.com', name: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>alert'));
  const semNome = buildWelcomeEmail({ email: 'x@y.com', name: '' });
  assert.ok(semNome.html.includes('>Olá!<'));
  assert.ok(!semNome.text.includes('name='));
});

test('sem RESEND_API_KEY não envia nada', async () => {
  const old = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.deepEqual(await sendWelcomeEmail({ email: 'x@y.com' }), { skipped: true });
  if (old !== undefined) process.env.RESEND_API_KEY = old;
});
