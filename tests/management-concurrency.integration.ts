import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Client } from 'pg';
import { hashPassword } from '../src/lib/password';

const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).port !== '55439' ||
  new URL(url).username !== 'codex_db_test'
)
  throw new Error('Use somente o banco temporário de testes.');
const observer = new Client({ connectionString: url }),
  first = new Client({ connectionString: url }),
  second = new Client({ connectionString: url });
await Promise.all([observer.connect(), first.connect(), second.connect()]);
try {
  const suffix = randomUUID();
  const hash = await hashPassword('SenhaConcorrenciaTeste!');
  const otherHash = await hashPassword('OutraSenhaConcorrencia!');
  const user = async (name: string, superAdmin = false) =>
    (
      await observer.query(
        'INSERT INTO reabilitah.usuario(email,senha_hash,super_administrador,exige_troca_senha) VALUES($1,$2,$3,false) RETURNING id,email',
        [`${name}-${suffix}@race.invalid`, hash, superAdmin],
      )
    ).rows[0];
  const root = await user('root', true),
    admin = await user('admin'),
    alternate = await user('alternate'),
    member = await user('member');
  const inst = async (name: string) =>
    (
      await observer.query(
        'INSERT INTO reabilitah.instituicao(nome,criado_por) VALUES($1,$2) RETURNING id',
        [name, root.id],
      )
    ).rows[0].id;
  const a = await inst(`Concorrência A ${suffix}`),
    b = await inst(`Concorrência B ${suffix}`);
  const link = async (person: { id: string }, profile: string) =>
    (
      await observer.query(
        "INSERT INTO reabilitah.vinculo_institucional(instituicao_id,usuario_id,perfil,nome,criado_por) VALUES($1,$2,$3,'Pessoa de teste',$4) RETURNING id",
        [a, person.id, profile, root.id],
      )
    ).rows[0].id;
  const adminLink = await link(admin, 'ADMINISTRADOR'),
    alternateLink = await link(alternate, 'ADMINISTRADOR');
  await link(member, 'COLABORADOR');
  const session = async (person: { id: string }, institution: string) => {
    const token = randomBytes(32).toString('hex');
    await observer.query('SELECT reabilitah_auth.abrir_sessao($1,1,$2)', [person.id, token]);
    await observer.query(
      'UPDATE reabilitah.sessao_usuario SET instituicao_selecionada_id=$1 WHERE token_hash=$2',
      [institution, token],
    );
    return token;
  };
  const superB = await session(root, b),
    superA = await session(root, a),
    adminA = await session(admin, a);
  const begin = async (db: Client, token: string) => {
    await db.query('BEGIN');
    await db.query('SET LOCAL ROLE reabilitah_runtime');
    await db.query("SELECT set_config('reabilitah.token_hash',$1,true)", [token]);
  };
  const pid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const waiting = async () => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const row = (
        await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])
      ).rows[0];
      if (row?.wait_event_type === 'Lock') return;
      await setTimeout(20);
    }
    throw new Error('A segunda operação deveria aguardar o bloqueio de acesso.');
  };
  await begin(first, superB);
  await first.query('SELECT reabilitah_gestao.criar_membro($1,$2,$3,NULL,true)', [
    b,
    {
      nome: 'Pessoa compartilhada',
      email: member.email,
      perfil: 'COLABORADOR',
      cargo: 'Monitor(a)',
    },
    [],
  ]);
  await begin(second, adminA);
  const reset = second
    .query('SELECT reabilitah_auth.redefinir_senha($1,$2)', [member.id, otherHash])
    .then(
      () => 'aceito',
      (error: Error) => error.message,
    );
  await waiting();
  await first.query('COMMIT');
  assert.equal(await reset, 'RESET_MULTIPLAS_INSTITUICOES');
  await second.query('ROLLBACK');
  assert.equal(
    (await observer.query('SELECT senha_hash FROM reabilitah.usuario WHERE id=$1', [member.id]))
      .rows[0].senha_hash,
    hash,
  );
  await begin(first, superA);
  await first.query('SELECT reabilitah_gestao.alterar_acesso($1,$2,false,$3,1)', [
    a,
    adminLink,
    'Desligamento autorizado para teste',
  ]);
  await begin(second, superA);
  const deactivate = second
    .query('SELECT reabilitah_gestao.alterar_acesso($1,$2,false,$3,1)', [
      a,
      alternateLink,
      'Outro desligamento simultâneo',
    ])
    .then(
      () => 'aceito',
      (error: Error) => error.message,
    );
  await waiting();
  await first.query('COMMIT');
  assert.equal(await deactivate, 'ULTIMO_ADMINISTRADOR');
  await second.query('ROLLBACK');
  assert.equal(
    (
      await observer.query(
        "SELECT count(*) FROM reabilitah.vinculo_institucional WHERE instituicao_id=$1 AND ativo AND perfil='ADMINISTRADOR'",
        [a],
      )
    ).rows[0].count,
    '1',
  );
  console.log(
    'OK: alterações simultâneas preservam o último administrador e bloqueiam redefinição de senha após novo vínculo.',
  );
} finally {
  await first.query('ROLLBACK');
  await second.query('ROLLBACK');
  await Promise.all([observer.end(), first.end(), second.end()]);
}
