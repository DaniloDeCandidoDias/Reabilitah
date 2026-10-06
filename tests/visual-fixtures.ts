import type { Client } from 'pg';

export async function prepareVisualFixtures(db: Client, userId: string, adminId: string) {
  let institution = (
    await db.query<{ id: string }>(
      "SELECT id FROM reabilitah.instituicao WHERE nome='Instituição de teste Visual'",
    )
  ).rows[0]?.id;
  if (!institution)
    institution = (
      await db.query<{ id: string }>(
        "INSERT INTO reabilitah.instituicao(nome,criado_por) VALUES('Instituição de teste Visual',$1) RETURNING id",
        [adminId],
      )
    ).rows[0].id;
  await db.query(
    "INSERT INTO reabilitah.vinculo_institucional(instituicao_id,usuario_id,perfil,nome,criado_por) VALUES($1,$2,'COLABORADOR','Pessoa de teste visual',$3) ON CONFLICT DO NOTHING",
    [institution, userId, adminId],
  );
  if (
    (await db.query('SELECT id FROM reabilitah.paciente WHERE instituicao_id=$1', [institution]))
      .rowCount
  )
    return;
  const patient = (
    await db.query<{ id: string }>(
      "INSERT INTO reabilitah.paciente(instituicao_id,nome_completo,apelido,criado_por) VALUES($1,'Luiz Antônio de Albuquerque e Vasconcelos','Toninho',$2) RETURNING id",
      [institution, adminId],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO reabilitah.paciente(instituicao_id,nome_completo,criado_por) VALUES($1,'Marina de teste',$2)",
    [institution, adminId],
  );
  const admission = (
    await db.query<{ id: string }>(
      'INSERT INTO reabilitah.acolhimento(instituicao_id,paciente_id,data_entrada,criado_por) VALUES($1,$2,current_date-15,$3) RETURNING id',
      [institution, patient, adminId],
    )
  ).rows[0].id;
  const model = async (code: string, signers: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO reabilitah.modelo_documento(tipo_documento_id,versao,campos,assinantes,identificador_layout,publicado_por)
    SELECT id, coalesce((SELECT max(m.versao)+1 FROM reabilitah.modelo_documento m WHERE m.tipo_documento_id=t.id),1), '{}', $2::jsonb, 'teste-visual', $3 FROM reabilitah.tipo_documento t WHERE codigo=$1 RETURNING id`,
        [code, signers, adminId],
      )
    ).rows[0].id;
  const signedModel = await model('termo-acolhimento', '["Paciente","Responsável","Instituição"]');
  const unsignedModel = await model('evolucao-geral', '[]');
  for (const state of [
    'concluido',
    'assinatura',
    'conferencia',
    'reenvio',
    'desconsiderado',
    'aprovado',
  ]) {
    const noSignature = state === 'concluido';
    const doc = (
      await db.query<{ id: string }>(
        `INSERT INTO reabilitah.documento(instituicao_id,paciente_id,acolhimento_id,modelo_documento_id,dados,dados_paciente,dados_instituicao,dados_autor,assinantes,hash_conteudo,criado_por)
      VALUES($1,$2,$3,$4,'{}','{}','{}','{"nome":"Profissional de teste"}',$5::jsonb,repeat('a',64),$6) RETURNING id`,
        [
          institution,
          patient,
          admission,
          noSignature ? unsignedModel : signedModel,
          noSignature ? '[]' : '["Paciente","Responsável","Instituição"]',
          adminId,
        ],
      )
    ).rows[0].id;
    const upload = async () =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO reabilitah.documento_arquivo(instituicao_id,documento_id,tipo,chave_armazenamento,mime_type,tamanho_bytes,hash_arquivo,enviado_por)
      VALUES($1,$2,'DIGITALIZACAO',gen_random_uuid()::text,'application/pdf',100,repeat('b',64),$3) RETURNING id`,
          [institution, doc, adminId],
        )
      ).rows[0].id;
    const review = async (fileId: string, decision: string) =>
      db.query(
        "INSERT INTO reabilitah.conferencia_assinatura(instituicao_id,documento_id,arquivo_id,decisao,justificativa,conferido_por) VALUES($1,$2,$3,$4,'Justificativa de teste',$5)",
        [institution, doc, fileId, decision, adminId],
      );
    if (['conferencia', 'reenvio', 'aprovado'].includes(state)) {
      const first = await upload();
      await review(first, 'REJEITADA');
      if (state !== 'reenvio') {
        const second = await upload();
        if (state === 'aprovado') await review(second, 'APROVADA');
      }
    }
    if (state === 'desconsiderado')
      await db.query(
        "UPDATE reabilitah.documento SET desconsiderado_em=now(),desconsiderado_por=$1,justificativa_desconsideracao='Teste visual' WHERE id=$2",
        [adminId, doc],
      );
  }
  await db.query(
    "INSERT INTO reabilitah.aviso(instituicao_id,mensagem,inicio_em,fim_em,criado_por) VALUES($1,'Aviso fictício exclusivo do ambiente de testes.',now()-interval '1 hour',now()+interval '1 year',$2)",
    [institution, adminId],
  );
}
