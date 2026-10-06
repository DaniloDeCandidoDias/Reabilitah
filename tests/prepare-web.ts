import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { hashPassword } from '../src/lib/password';
import { prepareVisualFixtures } from './visual-fixtures';
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).port !== '55439' ||
  new URL(url).username !== 'codex_db_test'
)
  throw new Error('Use somente a instancia temporaria de testes.');
const db = new Client({ connectionString: url });
await db.connect();
try {
  const installed = (await db.query("SELECT to_regnamespace('reabilitah') IS NOT NULL AS ok"))
    .rows[0].ok;
  if (!installed) await db.query(await readFile('database/estrutura.sql', 'utf8'));
  await db.query(
    "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='reabilitah_app_test') THEN CREATE ROLE reabilitah_app_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS IN ROLE reabilitah_runtime; END IF; END $$;",
  );
  const hash = await hashPassword('SenhaSomenteParaTeste!');
  const user = async (email: string, superadmin = false, change = false) => {
    const exists = await db.query('SELECT id FROM reabilitah.usuario WHERE email=$1', [email]);
    if (exists.rowCount) {
      await db.query("SELECT set_config('reabilitah.autor_id',$1,true)", [exists.rows[0].id]);
      await db.query(
        'UPDATE reabilitah.usuario SET senha_hash=$1,exige_troca_senha=$2,versao_credencial=versao_credencial+1 WHERE id=$3',
        [hash, change, exists.rows[0].id],
      );
      return exists.rows[0].id;
    }
    return (
      await db.query(
        'INSERT INTO reabilitah.usuario(email,senha_hash,super_administrador,exige_troca_senha) VALUES($1,$2,$3,$4) RETURNING id',
        [email, hash, superadmin, change],
      )
    ).rows[0].id;
  };
  await db.query('BEGIN');
  const s = await user('super@web.invalid', true);
  const single = await user('single@web.invalid');
  const multi = await user('multi@web.invalid');
  const first = await user('first@web.invalid', false, true);
  const admin = await user('admin@web.invalid');
  const inst = async (nome: string) => {
    const exists = await db.query('SELECT id FROM reabilitah.instituicao WHERE nome=$1', [nome]);
    if (exists.rowCount) return exists.rows[0].id;
    return (
      await db.query(
        'INSERT INTO reabilitah.instituicao(nome,criado_por) VALUES($1,$2) RETURNING id',
        [nome, s],
      )
    ).rows[0].id;
  };
  const a = await inst('Instituição de teste A'),
    b = await inst('Instituição de teste B');
  for (const [u, i] of [
    [single, a],
    [multi, a],
    [multi, b],
    [first, a],
  ])
    await db.query(
      "INSERT INTO reabilitah.vinculo_institucional(instituicao_id,usuario_id,perfil,nome,criado_por) VALUES($1,$2,'COLABORADOR','Pessoa teste',$3) ON CONFLICT DO NOTHING",
      [i, u, s],
    );
  await db.query(
    "INSERT INTO reabilitah.vinculo_institucional(instituicao_id,usuario_id,perfil,nome,criado_por) VALUES($1,$2,'ADMINISTRADOR','Administrador de teste',$3) ON CONFLICT DO NOTHING",
    [a, admin, s],
  );
  const visual = await user('visual@web.invalid');
  await prepareVisualFixtures(db, visual, s);
  await db.query('COMMIT');
  await db.query('DELETE FROM reabilitah_auth.tentativa_login');
  console.log('Fixtures web prontas SOMENTE no banco temporario, conta restrita criada.');
} finally {
  await db.end();
}
