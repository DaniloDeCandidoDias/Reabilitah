import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
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
const db = new Client({ connectionString: url });
await db.connect();
await db.query('BEGIN');
try {
  const hash = await hashPassword('SenhaTemporariaTeste!');
  const superId = (
    await db.query(
      "INSERT INTO reabilitah.usuario(email,senha_hash,super_administrador,exige_troca_senha) VALUES('gestor@management.invalid',$1,true,false) RETURNING id",
      [hash],
    )
  ).rows[0].id;
  const tokens = new Map<string, string>();
  const open = async (id: string) => {
    await db.query('RESET ROLE');
    const token = randomBytes(32).toString('hex');
    tokens.set(id, token);
    await db.query('SELECT reabilitah_auth.abrir_sessao($1,1,$2)', [id, token]);
  };
  const context = async (id: string, inst?: string) => {
    await db.query('SET LOCAL ROLE reabilitah_runtime');
    await db.query("SELECT set_config('reabilitah.token_hash',$1,true)", [tokens.get(id) ?? '']);
    if (inst) await db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [inst]);
  };
  const denied = async (sql: string, args: unknown[], message: RegExp) => {
    await db.query('SAVEPOINT refused');
    await assert.rejects(db.query(sql, args), message);
    await db.query('ROLLBACK TO SAVEPOINT refused');
  };
  const institution = async (name: string) =>
    (
      await db.query('SELECT reabilitah_gestao.salvar_instituicao(NULL,$1,NULL) AS id', [
        { nome: name },
      ])
    ).rows[0].id as string;
  const create = async (
    inst: string,
    name: string,
    profile = 'COLABORADOR',
    codes: string[] = [],
    job = 'Psicólogo(a)',
  ) => {
    const data = {
      nome: name,
      email: `${name}@management.invalid`,
      perfil: profile,
      cargo: job,
      telefone: '',
      registro_profissional: '',
    };
    const id = (
      await db.query('SELECT reabilitah_gestao.criar_membro($1,$2,$3,$4,false) AS id', [
        inst,
        data,
        codes,
        hash,
      ])
    ).rows[0].id;
    return {
      ...(
        await db.query('SELECT * FROM reabilitah_gestao.listar_equipe($1) WHERE id=$2', [inst, id])
      ).rows[0],
      cargo: data.cargo,
    };
  };
  const ready = async (userId: string) => {
    await db.query('RESET ROLE');
    await db.query("SELECT set_config('reabilitah.autor_id',$1,true)", [superId]);
    await db.query('UPDATE reabilitah.usuario SET exige_troca_senha=false WHERE id=$1', [userId]);
    await open(userId);
  };
  const can = async (inst: string, permission: string) =>
    (await db.query('SELECT reabilitah_gestao.pode_executar($1,$2) AS ok', [inst, permission]))
      .rows[0].ok;
  await context('anonymous');
  await denied(
    'SELECT reabilitah_gestao.salvar_instituicao(NULL,$1,NULL)',
    [{ nome: 'Negada' }],
    /ACESSO_NEGADO/,
  );
  await open(superId);
  await context(superId);
  const a = await institution('Gestão A'),
    b = await institution('Gestão B');
  await context(superId, a);
  const admin = await create(a, 'admin', 'ADMINISTRADOR');
  const member = await create(a, 'member', 'COLABORADOR', ['documentos.criar.evolucao-geral']);
  await db.query('RESET ROLE');
  assert.equal(
    (
      await db.query('SELECT exige_troca_senha FROM reabilitah.usuario WHERE id=$1', [
        admin.usuario_id,
      ])
    ).rows[0].exige_troca_senha,
    true,
  );
  await open(admin.usuario_id);
  await context(admin.usuario_id);
  await denied('SELECT reabilitah_gestao.listar_equipe($1)', [a], /ACESSO_NEGADO/);
  await ready(admin.usuario_id);
  await ready(member.usuario_id);
  await context(member.usuario_id, a);
  assert.equal(await can(a, 'documentos.criar.evolucao-geral'), true);
  assert.equal(await can(a, 'pacientes.cadastrar'), false);
  assert.equal(await can(b, 'documentos.criar.evolucao-geral'), false);
  await denied('SELECT reabilitah_gestao.listar_equipe($1)', [a], /ACESSO_NEGADO/);
  await denied('SELECT reabilitah_gestao.historico($1,NULL,1)', [a], /ACESSO_NEGADO/);
  await denied(
    "UPDATE reabilitah.vinculo_institucional SET perfil='ADMINISTRADOR' WHERE id=$1",
    [member.id],
    /permission denied/,
  );
  await denied(
    'SELECT reabilitah_gestao.gravar_permissoes($1,$2,$3,$4)',
    [a, member.id, [], member.usuario_id],
    /permission denied/,
  );
  await denied(
    'SELECT reabilitah_gestao.resolver_cargo($1,$2)',
    [a, 'Administrador'],
    /permission denied/,
  );
  await context(admin.usuario_id, a);
  const permissions = (await db.query('SELECT codigo FROM reabilitah.permissao')).rows;
  for (const p of permissions) assert.equal(await can(a, p.codigo), true);
  await denied(
    'SELECT reabilitah_gestao.salvar_instituicao(NULL,$1,NULL)',
    [{ nome: 'Negada' }],
    /ACESSO_NEGADO/,
  );
  await denied('SELECT reabilitah_gestao.listar_equipe($1)', [b], /ACESSO_NEGADO/);
  await denied('SELECT reabilitah_gestao.historico($1,NULL,1)', [b], /ACESSO_NEGADO/);
  await denied(
    'SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,1)',
    [a, member.id, { ...member, perfil: 'ADMINISTRADOR' }, []],
    /PROMOCAO_RESTRITA/,
  );
  await denied(
    'SELECT reabilitah_gestao.criar_membro($1,$2,$3,$4,false)',
    [a, { ...member, email: 'newadmin@management.invalid', perfil: 'ADMINISTRADOR' }, [], hash],
    /PROMOCAO_RESTRITA/,
  );
  await denied(
    'SELECT reabilitah_gestao.alterar_acesso($1,$2,false,$3,1)',
    [a, admin.id, 'Tentativa de remover a si mesmo'],
    /PROPRIO_ACESSO/,
  );
  await db.query("SELECT set_config('reabilitah.autor_id',$1,true)", [superId]);
  const other = await create(a, 'other', 'COLABORADOR', [], 'Assistente social');
  await create(a, 'samejob', 'COLABORADOR', [], 'assistente  SOCIAL');
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM reabilitah.cargo WHERE instituicao_id=$1 AND lower(nome)='assistente social'",
        [a],
      )
    ).rows[0].count,
    '1',
  );
  await db.query('RESET ROLE');
  assert.equal(
    (
      await db.query('SELECT criado_por FROM reabilitah.vinculo_institucional WHERE id=$1', [
        other.id,
      ])
    ).rows[0].criado_por,
    admin.usuario_id,
  );
  await context(admin.usuario_id, a);
  await db.query('SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,1)', [
    a,
    member.id,
    { ...member, nome: 'Nome atualizado', cargo: 'Administrador' },
    [],
  ]);
  await denied(
    'SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,1)',
    [a, member.id, { ...member, nome: 'Versão antiga' }, []],
    /CADASTRO_ALTERADO/,
  );
  await context(member.usuario_id, a);
  assert.equal(await can(a, 'documentos.criar.evolucao-geral'), false);
  await denied('SELECT reabilitah_gestao.listar_equipe($1)', [a], /ACESSO_NEGADO/);
  const ownJobs = (
    await db.query(`SELECT c.nome FROM reabilitah.vinculo_institucional v
    JOIN reabilitah.cargo c ON c.id=v.cargo_id AND c.instituicao_id=v.instituicao_id`)
  ).rows;
  assert.deepEqual(ownJobs, [{ nome: 'Administrador' }]);
  await context(superId, a);
  for (const p of permissions) assert.equal(await can(a, p.codigo), true);
  await denied(
    'SELECT reabilitah_gestao.alterar_acesso($1,$2,false,$3,1)',
    [a, admin.id, 'Último administrador da instituição'],
    /ULTIMO_ADMINISTRADOR/,
  );
  await db.query('SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,1)', [
    a,
    other.id,
    { ...other, perfil: 'ADMINISTRADOR' },
    [],
  ]);
  await ready(other.usuario_id);
  await context(other.usuario_id, a);
  assert.equal(await can(a, 'pacientes.cadastrar'), true);
  await context(superId, b);
  const foreign = await create(b, 'foreign');
  assert.equal(
    (await db.query("SELECT count(*) FROM reabilitah.cargo WHERE nome='Assistente social'")).rows[0]
      .count,
    '0',
  );
  await db.query('SELECT reabilitah_gestao.criar_membro($1,$2,$3,NULL,true)', [b, member, []]);
  await context(admin.usuario_id, a);
  await denied(
    'SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,1)',
    [a, foreign.id, foreign, []],
    /ACESSO_NEGADO/,
  );
  await denied(
    'SELECT reabilitah_gestao.criar_membro($1,$2,$3,NULL,true)',
    [a, foreign, []],
    /VINCULO_RESTRITO/,
  );
  await denied(
    'SELECT reabilitah_gestao.criar_membro($1,$2,$3,$4,false)',
    [a, foreign, [], hash],
    /CONTA_OUTRA_INSTITUICAO/,
  );
  await denied(
    'SELECT reabilitah_gestao.criar_membro($1,$2,$3,$4,false)',
    [a, member, [], hash],
    /VINCULO_EXISTENTE/,
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*) FROM reabilitah.vinculo_institucional WHERE instituicao_id=$1 AND usuario_id=$2',
        [a, foreign.usuario_id],
      )
    ).rows[0].count,
    '0',
  );
  await denied(
    'SELECT reabilitah_gestao.redefinir_senha_membro($1,$2,$3)',
    [a, member.id, hash],
    /RESET_MULTIPLAS_INSTITUICOES/,
  );
  await denied(
    'SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,2)',
    [a, member.id, { ...member, email: 'outro@management.invalid' }, []],
    /EMAIL_MULTIPLAS_INSTITUICOES/,
  );
  await db.query('SELECT reabilitah_gestao.alterar_acesso($1,$2,false,$3,2)', [
    a,
    member.id,
    'Encerramento do vínculo de trabalho',
  ]);
  await context(member.usuario_id);
  assert.equal(await can(a, 'documentos.criar.evolucao-geral'), false);
  await denied('SELECT reabilitah_auth.selecionar_instituicao($1)', [a], /indisponivel/);
  await db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [b]);
  await context(admin.usuario_id, a);
  await db.query('SELECT reabilitah_gestao.alterar_acesso($1,$2,true,$3,3)', [
    a,
    member.id,
    'Retorno autorizado à equipe',
  ]);
  const history = (
    await db.query('SELECT * FROM reabilitah_gestao.historico($1,$2,1)', [a, member.usuario_id])
  ).rows;
  assert(
    history.some(
      (h) =>
        h.acao === 'DESATIVAR_ACESSO' &&
        h.autor === 'admin' &&
        h.justificativa === 'Encerramento do vínculo de trabalho',
    ),
  );
  assert(!history.some((h) => h.descricao.includes('foreign')));
  assert(
    history.some((h) => h.antes?.cargo === 'Psicólogo(a)' && h.depois?.cargo === 'Administrador'),
  );

  // As consultas filtradas alcançam registros antigos e preservam a instituição de cada evento.
  await db.query('RESET ROLE');
  const model = (
    await db.query(
      `INSERT INTO reabilitah.modelo_documento(tipo_documento_id,versao,campos,assinantes,identificador_layout,publicado_por)
    SELECT id,coalesce((SELECT max(m.versao)+1 FROM reabilitah.modelo_documento m WHERE m.tipo_documento_id=t.id),1),'{}','[]','teste-historico',$1
    FROM reabilitah.tipo_documento t WHERE codigo='evolucao-geral' RETURNING id`,
      [superId],
    )
  ).rows[0].id;
  const document = async (inst: string, name: string) => {
    const patient = (
      await db.query(
        'INSERT INTO reabilitah.paciente(instituicao_id,nome_completo,criado_por) VALUES($1,$2,$3) RETURNING id',
        [inst, name, member.usuario_id],
      )
    ).rows[0].id;
    const admission = (
      await db.query(
        'INSERT INTO reabilitah.acolhimento(instituicao_id,paciente_id,data_entrada,criado_por) VALUES($1,$2,current_date,$3) RETURNING id',
        [inst, patient, member.usuario_id],
      )
    ).rows[0].id;
    return (
      await db.query(
        `INSERT INTO reabilitah.documento(instituicao_id,paciente_id,acolhimento_id,modelo_documento_id,dados,dados_paciente,dados_instituicao,dados_autor,assinantes,hash_conteudo,criado_por)
      VALUES($1,$2,$3,$4,'{}','{}','{}','{}','[]',repeat('a',64),$5) RETURNING id`,
        [inst, patient, admission, model, member.usuario_id],
      )
    ).rows[0].id;
  };
  await document(a, 'Paciente somente da instituição A');
  await document(b, 'Paciente somente da instituição B');
  await db.query(
    "INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao) VALUES($1,$2,'atividade_futura','teste','ACAO_FUTURA')",
    [a, member.usuario_id],
  );
  await context(member.usuario_id, b);
  await db.query('SELECT reabilitah_auth.encerrar_sessao()');
  await context(admin.usuario_id, a);
  for (let i = 0; i < 60; i++)
    await db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [a]);
  const filtered = async (filter: string, person: string | null = null, page = 1) =>
    (
      await db.query('SELECT * FROM reabilitah_gestao.historico($1,$2,$3,$4)', [
        a,
        person,
        page,
        filter,
      ])
    ).rows;
  const accessActions = ['LOGIN', 'LOGOUT', 'SELECIONAR_INSTITUICAO'];
  const accesses = await filtered('acessos');
  assert.equal(accesses.length, 51);
  assert(accesses.every((e) => accessActions.includes(e.acao)));
  const nextAccesses = await filtered('acessos', null, 2);
  assert(nextAccesses.length > 0);
  assert(!nextAccesses.some((e) => accesses.slice(0, 50).some((first) => first.id === e.id)));
  assert((await filtered('sem-acessos')).every((e) => !accessActions.includes(e.acao)));
  const created = await filtered('criacao-documentos', member.usuario_id);
  assert.equal(created.length, 1);
  assert.equal(created[0].acao, 'EMISSAO');
  assert.match(created[0].descricao, /Paciente somente da instituição A/);
  assert.equal((await filtered('documentos')).length, 1);
  assert.equal((await filtered('criacao-documentos', admin.usuario_id)).length, 0);
  const selected = async (types: string[] | null, person: string | null = null, page = 1) =>
    (
      await db.query('SELECT * FROM reabilitah_gestao.historico_selecionado($1,$2,$3,$4)', [
        a,
        person,
        page,
        types,
      ])
    ).rows;
  const categories = (
    await db.query('SELECT codigo FROM reabilitah_gestao.tipos_atividade()')
  ).rows.map((r) => r.codigo as string);
  assert.equal(new Set(categories).size, categories.length);
  assert.deepEqual(await selected([]), []);
  assert.deepEqual(await selected(null), await selected(categories));
  assert.equal((await selected(['criacao-documentos'])).length, 1);
  const combined = await selected(['criacao-documentos', 'acesso-equipe']);
  assert(combined.some((e) => e.acao === 'EMISSAO'));
  assert(combined.some((e) => e.acao === 'DESATIVAR_ACESSO'));
  assert(
    combined.every((e) => ['EMISSAO', 'DESATIVAR_ACESSO', 'REATIVAR_ACESSO'].includes(e.acao)),
  );
  assert.deepEqual(await selected(['acessos'], null, 2), await filtered('acessos', null, 2));
  assert(
    (await selected(categories.filter((code) => code !== 'acessos'))).every(
      (e) => !accessActions.includes(e.acao),
    ),
  );
  assert((await selected(['outras'])).some((e) => e.acao === 'ACAO_FUTURA'));
  assert(
    !(
      await selected(
        categories.filter((code) => code !== 'outras'),
        member.usuario_id,
      )
    ).some((e) => e.acao === 'ACAO_FUTURA'),
  );
  assert(
    !(await selected(null, member.usuario_id)).some(
      (e) => /Paciente somente da instituição B/.test(e.descricao) || e.acao === 'LOGOUT',
    ),
  );
  await denied(
    'SELECT reabilitah_gestao.historico_selecionado($1,$2,1,$3)',
    [a, foreign.usuario_id, ['acessos']],
    /ACESSO_NEGADO/,
  );
  await denied(
    'SELECT reabilitah_gestao.historico_selecionado($1,NULL,1,$2)',
    [b, []],
    /ACESSO_NEGADO/,
  );
  await denied(
    'SELECT reabilitah_gestao.historico_selecionado($1,NULL,1,$2)',
    [a, ['invalido']],
    /DADOS_INVALIDOS/,
  );
  await denied(
    'SELECT reabilitah_gestao.historico_selecionado($1,NULL,1,$2)',
    [a, [null]],
    /DADOS_INVALIDOS/,
  );
  const sharedHistory = await filtered('todos', member.usuario_id);
  assert(
    !sharedHistory.some(
      (e) =>
        /Paciente somente da instituição B/.test(e.descricao) ||
        e.acao === 'LOGOUT' ||
        e.acao === 'LOGIN',
    ),
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*) FROM reabilitah.auditoria WHERE instituicao_id IS NULL OR instituicao_id<>$1',
        [a],
      )
    ).rows[0].count,
    '0',
  );
  await denied(
    'SELECT reabilitah_gestao.historico($1,$2,1,$3)',
    [a, foreign.usuario_id, 'documentos'],
    /ACESSO_NEGADO/,
  );
  await denied(
    'SELECT reabilitah_gestao.historico($1,NULL,1,$2)',
    [a, 'invalido'],
    /DADOS_INVALIDOS/,
  );
  await denied('SELECT reabilitah_gestao.historico($1,NULL,1,$2)', [b, 'acessos'], /ACESSO_NEGADO/);
  await db.query('SELECT reabilitah_auth.encerrar_sessao()');
  await open(admin.usuario_id);
  await context(admin.usuario_id, a);
  assert((await filtered('acessos', admin.usuario_id)).some((e) => e.acao === 'LOGOUT'));
  await context(superId, a);
  await db.query('SELECT reabilitah_gestao.redefinir_senha_membro($1,$2,$3)', [a, member.id, hash]);
  await context(member.usuario_id);
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
    'OK: gestão, permissões dos administradores, cargos personalizados sem promoção, isolamento entre instituições, autoria, filtros antes da paginação, histórico de cargos, vínculos compartilhados e revogação.',
  );
} finally {
  await db.query('ROLLBACK');
  await db.end();
}
