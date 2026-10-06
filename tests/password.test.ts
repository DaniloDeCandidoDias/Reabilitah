import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/lib/password';
test('senhas usam salt independente e rejeitam senha incorreta', async () => {
  const a = await hashPassword('SenhaSomenteParaTeste!');
  const b = await hashPassword('SenhaSomenteParaTeste!');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('SenhaSomenteParaTeste!', a), true);
  assert.equal(await verifyPassword('SenhaErrada!', a), false);
});
test('hash malformado ou custo adulterado nao permite login', async () => {
  for (const hash of ['', 'abc', `scrypt$999999999$8$1$${'a'.repeat(32)}$${'a'.repeat(128)}`])
    assert.equal(await verifyPassword('qualquer', hash), false);
  await assert.rejects(hashPassword('curta'));
});
