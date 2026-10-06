import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Client } from 'pg';
import { prepareLocalSetup } from '../scripts/lib/local-setup';
import { hashPassword, verifyPassword } from '../src/lib/password';

const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://invalid');
if (
  url.hostname !== '127.0.0.1' ||
  url.port !== '55439' ||
  url.username !== 'codex_db_test' ||
  url.pathname !== '/reabilitah'
)
  throw new Error('Use somente um banco vazio na instância temporária de testes.');
const db = new Client({ connectionString: url.href });
await db.connect();
const root = await mkdtemp(join(tmpdir(), 'reabilitah-bootstrap-'));
let app: Client | undefined;
try {
  assert.equal(
    (await db.query("SELECT to_regnamespace('reabilitah') IS NULL AS vazio")).rows[0].vazio,
    true,
  );
  await mkdir(join(root, 'database'));
  await copyFile('database/estrutura.sql', join(root, 'database', 'estrutura.sql'));
  const setup = await prepareLocalSetup(root, 'bootstrap@test.invalid');
  const sql = await readFile(setup.sqlPath, 'utf8');
  await db.query(sql);
  const user = (await db.query('SELECT id,senha_hash,exige_troca_senha FROM reabilitah.usuario'))
    .rows;
  assert.equal(user.length, 1);
  assert.equal(user[0].exige_troca_senha, true);
  assert(await verifyPassword(setup.temporaryPassword, user[0].senha_hash));
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.paciente')).rows[0].count, '0');
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.documento')).rows[0].count, '0');
  const rights = (
    await db.query(
      "SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='reabilitah_app'",
    )
  ).rows[0];
  assert(Object.values(rights).every((value) => value === false));
  const env = await readFile(join(root, '.env.local'), 'utf8');
  const appUrl = new URL(
    env
      .split('\n')
      .find((line) => line.startsWith('DATABASE_URL='))!
      .slice('DATABASE_URL='.length),
  );
  appUrl.port = url.port;
  app = new Client({ connectionString: appUrl.href });
  await app.connect();
  await assert.rejects(app.query('SELECT senha_hash FROM reabilitah.usuario'), /permission denied/);
  const token = randomBytes(32).toString('hex');
  await app.query('SELECT reabilitah_auth.abrir_sessao($1,1,$2)', [user[0].id, token]);
  await app.query('BEGIN');
  await app.query("SELECT set_config('reabilitah.token_hash',$1,true)", [token]);
  assert.equal(
    (await app.query('SELECT * FROM reabilitah_auth.instituicoes_disponiveis()')).rowCount,
    0,
  );
  const nextHash = await hashPassword('SenhaPessoalInstalacao!');
  await app.query('SELECT reabilitah_auth.trocar_senha($1,$2)', [nextHash, user[0].senha_hash]);
  await app.query('COMMIT');
  const nextToken = randomBytes(32).toString('hex');
  await app.query('SELECT reabilitah_auth.abrir_sessao($1,2,$2)', [user[0].id, nextToken]);
  await app.query('BEGIN');
  await app.query("SELECT set_config('reabilitah.token_hash',$1,true)", [nextToken]);
  const institutions = (await app.query('SELECT * FROM reabilitah_auth.instituicoes_disponiveis()'))
    .rows;
  assert.equal(institutions.length, 1);
  await app.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [institutions[0].id]);
  assert.equal(
    (await app.query('SELECT * FROM reabilitah_gestao.listar_equipe($1)', [institutions[0].id]))
      .rowCount,
    0,
  );
  assert((await app.query('SELECT * FROM reabilitah_gestao.tipos_atividade()')).rowCount! > 0);
  await app.query('COMMIT');
  await assert.rejects(db.query(sql), /schema "reabilitah" already exists/);
  await db.query('ROLLBACK');
  const preserved = (await db.query('SELECT id,senha_hash FROM reabilitah.usuario')).rows;
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].id, user[0].id);
  assert(preserved[0].senha_hash === nextHash);
  console.log(
    'OK: instalação completa em banco vazio, primeiro login, troca obrigatória, conta restrita e preservação em nova tentativa.',
  );
} finally {
  await app?.end();
  await db.end();
  if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}reabilitah-bootstrap-`))
    throw new Error('Pasta fora do ambiente temporário.');
  await rm(root, { recursive: true });
}
