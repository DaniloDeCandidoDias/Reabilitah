import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { prepareLocalSetup } from '../scripts/lib/local-setup';

async function temporaryProject() {
  const root = await mkdtemp(join(tmpdir(), 'reabilitah-setup-'));
  await mkdir(join(root, 'database'));
  await copyFile('database/estrutura.sql', join(root, 'database', 'estrutura.sql'));
  return root;
}

async function removeTemporaryProject(root: string) {
  const allowedPrefix = `${resolve(tmpdir())}${sep}reabilitah-setup-`;
  if (!resolve(root).startsWith(allowedPrefix)) throw new Error('Pasta fora do ambiente de teste.');
  await rm(root, { recursive: true });
}

test('prepara acesso temporário sem gravar a senha pessoal no SQL', async () => {
  const root = await temporaryProject();
  try {
    const result = await prepareLocalSetup(root, 'Setup@Test.invalid');
    const sql = await readFile(result.sqlPath, 'utf8');
    assert.equal(result.email, 'setup@test.invalid');
    assert.equal(sql.includes(result.temporaryPassword), false);
    await assert.rejects(readFile(join(root, 'local', 'primeiro-acesso.txt')), { code: 'ENOENT' });
    assert.match(sql, /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/);
    assert.equal((sql.match(/\bCOMMIT;/g) ?? []).length, 1);
    assert.equal((sql.match(/^BEGIN;/gm) ?? []).length, 1);
    assert.match(sql, /CREATE SCHEMA reabilitah;/);
    assert.match(sql, /CREATE TABLE usuario/);
    assert.match(sql, /historico_selecionado/);
    assert.match(sql, /VINCULO_RESTRITO/);
    await assert.rejects(prepareLocalSetup(root, 'segundo@test.invalid'), /Já existe/);
    assert.equal(await readFile(result.sqlPath, 'utf8'), sql);
  } finally {
    await removeTemporaryProject(root);
  }
});

test('preserva configuração existente antes de criar qualquer arquivo', async () => {
  const root = await temporaryProject();
  try {
    await mkdir(join(root, 'local'));
    await writeFile(join(root, 'local', 'configurar-acesso.sql'), '-- configuração existente');
    await assert.rejects(prepareLocalSetup(root, 'setup@test.invalid'), /Já existe/);
    await assert.rejects(readFile(join(root, '.env.local')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(root, 'local', 'primeiro-acesso.txt')), { code: 'ENOENT' });
  } finally {
    await removeTemporaryProject(root);
  }
});
