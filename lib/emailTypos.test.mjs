import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEmail } from './emailTypos.js';

// Domínios digitados errado que estavam na base em 25/11/2026 (compradores que não recebiam e-mail)
test('corrige os erros de digitação reais da base', () => {
  const casos = {
    'ana@gmail.con': 'ana@gmail.com',
    'ana@gmail.co': 'ana@gmail.com',
    'ana@gmail.comm': 'ana@gmail.com',
    'ana@gmail.coml': 'ana@gmail.com',
    'ana@gmai.com': 'ana@gmail.com',
    'ana@205gmail.com': 'ana@gmail.com',
    'ana@tahoo.com.br': 'ana@yahoo.com.br',
  };
  for (const [digitado, certo] of Object.entries(casos)) assert.equal(checkEmail(digitado).sugestao, certo, digitado);
});

test('outros erros comuns', () => {
  assert.equal(checkEmail('ana@gmial.com').sugestao, 'ana@gmail.com');
  assert.equal(checkEmail('ana@hotmial.com').sugestao, 'ana@hotmail.com');
  assert.equal(checkEmail('ana@hotmail.con').sugestao, 'ana@hotmail.com');
  assert.equal(checkEmail('ana@outlok.com').sugestao, 'ana@outlook.com');
  assert.equal(checkEmail('ana@gmail.com.br').sugestao, 'ana@gmail.com');
  assert.equal(checkEmail('ana@icloud.co').sugestao, 'ana@icloud.com');
  assert.equal(checkEmail(' Ana@GMAIL.CON ').sugestao, 'ana@gmail.com');
});

test('não mexe em e-mails certos (inclusive empresas e provedores de outros países)', () => {
  for (const ok of [
    'ana@gmail.com', 'ana@hotmail.com', 'ana@hotmail.com.br', 'ana@yahoo.com.br', 'ana@icloud.com',
    'ana@outlook.com', 'ana@yahoo.com', 'ana@terra.com.br', 'ana@bol.com.br', 'ana@uol.com.br', 'ana@msn.com',
    'ana@agenciacabral.com.py', 'ana@jafseguros.com.br', 'ana@jgimoveis.com', 'ana@marindistribuidora.com',
    'ana@neoempregos.com.br', 'ana@pequenomestre.org.br', 'ana@hotmail.es', 'ana@yahoo.com.mx',
    'ana@outlook.es', 'ana@live.com.mx', 'ana@yahoo.fr', 'ana@orange.fr', 'ana@empresa.co', 'ana@mail.com',
    'ana@me.com', 'ana@gmx.de',
  ]) {
    assert.deepEqual(checkEmail(ok), { valido: true, sugestao: null }, ok);
  }
});

test('final que não existe é inválido; final de país (.co) só vira sugestão', () => {
  assert.deepEqual(checkEmail('ana@gmail.con'), { valido: false, sugestao: 'ana@gmail.com' });
  assert.deepEqual(checkEmail('ana@empresa.con'), { valido: false, sugestao: 'ana@empresa.com' });
  assert.deepEqual(checkEmail('ana@gmail.co'), { valido: true, sugestao: 'ana@gmail.com' });
});

test('formato inválido', () => {
  for (const ruim of ['', 'ana', 'ana@', 'ana@gmail', '@gmail.com', 'ana gmail.com']) {
    assert.equal(checkEmail(ruim).valido, false, ruim);
  }
});
