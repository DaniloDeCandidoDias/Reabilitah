import assert from 'node:assert/strict';
import { Client } from 'pg';
import { hashPassword } from '../src/lib/password';
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).port !== '55439' ||
  new URL(url).username !== 'codex_db_test'
)
  throw new Error('Este teste exige a instancia temporaria independente em 127.0.0.1:55439.');
const db = new Client({ connectionString: url });
await db.connect();
await db.query('BEGIN');
try {
  const password = await hashPassword('SenhaSomenteParaTeste!');
  const makeUser = async (email: string, superadmin = false, mustChange = false) =>
    (
      await db.query(
        'INSERT INTO reabilitah.usuario(email,senha_hash,super_administrador,exige_troca_senha) VALUES($1,$2,$3,$4) RETURNING id',
        [email, password, superadmin, mustChange],
      )
    ).rows[0].id as string;
  const superuser = await makeUser('super@access.invalid', true);
  const admin = await makeUser('admin@access.invalid');
  const member = await makeUser('member@access.invalid');
  const multi = await makeUser('multi@access.invalid');
  const initial = await makeUser('initial@access.invalid', false, true);
  const a = (
    await db.query(
      "INSERT INTO reabilitah.instituicao(nome,criado_por) VALUES('Instituicao teste A',$1) RETURNING id",
      [superuser],
    )
  ).rows[0].id;
  const b = (
    await db.query(
      "INSERT INTO reabilitah.instituicao(nome,criado_por) VALUES('Instituicao teste B',$1) RETURNING id",
      [superuser],
    )
  ).rows[0].id;
  for (const [u, i, role] of [
    [admin, a, 'ADMINISTRADOR'],
    [member, a, 'COLABORADOR'],
    [multi, a, 'COLABORADOR'],
    [multi, b, 'COLABORADOR'],
    [initial, a, 'COLABORADOR'],
  ])
    await db.query(
      'INSERT INTO reabilitah.vinculo_institucional(instituicao_id,usuario_id,perfil,nome,criado_por) VALUES($1,$2,$3,$4,$5)',
      [i, u, role, 'Pessoa teste', superuser],
    );
  for (const i of [a, b])
    await db.query(
      'INSERT INTO reabilitah.paciente(instituicao_id,nome_completo,criado_por) VALUES($1,$2,$3)',
      [i, `Paciente teste ${i}`, superuser],
    );
  const tokens = new Map<string, string>();
  for (const [index, u] of [superuser, admin, member, multi, initial].entries()) {
    const token = (index + 1).toString(16).padStart(64, '0');
    tokens.set(u, token);
    await db.query('SELECT reabilitah_auth.abrir_sessao($1,1,$2)', [u, token]);
  }
  const context = async (u: string) => {
    await db.query('SET LOCAL ROLE reabilitah_runtime');
    await db.query("SELECT set_config('reabilitah.token_hash',$1,true)", [tokens.get(u) ?? '']);
  };
  const denied = async (query: string, args: unknown[] = []) => {
    await db.query('SAVEPOINT refusal');
    await assert.rejects(db.query(query, args));
    await db.query('ROLLBACK TO SAVEPOINT refusal');
  };
  await context(member);
  for (let n = 0; n < 9; n++)
    assert.equal(
      (await db.query('SELECT reabilitah_auth.reservar_tentativa($1) AS ok', ['f'.repeat(64)]))
        .rows[0].ok,
      n < 8,
    );
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.paciente')).rows[0].count, '0');
  await db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [a]);
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.paciente')).rows[0].count, '1');
  assert.equal(
    (await db.query('SELECT * FROM reabilitah.paciente WHERE instituicao_id=$1', [b])).rowCount,
    0,
  );
  await denied('SELECT reabilitah_auth.selecionar_instituicao($1)', [b]);
  await denied('SELECT senha_hash FROM reabilitah.usuario');
  await denied('SELECT token_hash FROM reabilitah.sessao_usuario');
  await denied(
    "INSERT INTO reabilitah.paciente(instituicao_id,nome_completo,criado_por) VALUES($1,'Nao autorizado',$2)",
    [a, member],
  );
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.auditoria')).rows[0].count, '0');
  await denied('SELECT reabilitah_auth.redefinir_senha($1,$2)', [admin, password]);
  await context(initial);
  assert.equal(
    (await db.query('SELECT * FROM reabilitah_auth.instituicoes_disponiveis()')).rowCount,
    0,
  );
  await denied('SELECT reabilitah_auth.selecionar_instituicao($1)', [a]);
  await context(admin);
  await db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [a]);
  await db.query('SAVEPOINT multi_reset');
  await assert.rejects(
    db.query('SELECT reabilitah_auth.redefinir_senha($1,$2)', [multi, password]),
    /RESET_MULTIPLAS_INSTITUICOES/,
  );
  await db.query('ROLLBACK TO SAVEPOINT multi_reset');
  await db.query('SELECT reabilitah_auth.redefinir_senha($1,$2)', [member, password]);
  await context(member);
  assert.equal((await db.query('SELECT * FROM reabilitah_auth.sessao_atual()')).rowCount, 0);
  await context(multi);
  assert.equal(
    (await db.query('SELECT * FROM reabilitah_auth.instituicoes_disponiveis()')).rowCount,
    2,
  );
  await db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [b]);
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.paciente')).rows[0].count, '1');
  await db.query('RESET ROLE');
  await db.query("SELECT set_config('reabilitah.autor_id',$1,true)", [superuser]);
  await db.query(
    'UPDATE reabilitah.vinculo_institucional SET ativo=false WHERE usuario_id=$1 AND instituicao_id=$2',
    [multi, b],
  );
  await context(multi);
  assert.equal((await db.query('SELECT count(*) FROM reabilitah.paciente')).rows[0].count, '0');
  await context(superuser);
  await db.query('SELECT reabilitah_auth.redefinir_senha($1,$2)', [multi, password]);
  await context(multi);
  assert.equal((await db.query('SELECT * FROM reabilitah_auth.sessao_atual()')).rowCount, 0);
  await context(admin);
  await db.query('SELECT reabilitah_auth.trocar_senha($1,$2)', [password, password]);
  assert.equal((await db.query('SELECT * FROM reabilitah_auth.sessao_atual()')).rowCount, 0);
  await db.query('RESET ROLE');
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM reabilitah.auditoria WHERE antes ? 'senha_hash' OR depois ? 'senha_hash' OR antes ? 'token_hash' OR depois ? 'token_hash'",
      )
    ).rows[0].count,
    '0',
  );
  console.log(
    'OK: isolamento, acesso sem sessao/selecao, credenciais privadas, trocas obrigatorias, redefinicao, revogacao e auditoria sem segredos.',
  );
} finally {
  await db.query('ROLLBACK');
  await db.end();
}
