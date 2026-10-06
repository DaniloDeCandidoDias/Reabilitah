import 'server-only';
import { cache } from 'react';
import { transaction } from '@/lib/db';
import { currentHash, requireReady } from '@/lib/session';
import type { DocumentSummary } from '@/lib/presentation';

// O estado é derivado dos registros preservados de emissão, envio e conferência.
export const documentStateSql = `
  SELECT d.id, d.codigo::text, t.codigo AS tipo, p.nome_completo AS paciente,
    d.paciente_id, d.criado_por AS autor_id,
    coalesce(nullif(d.dados_autor->>'nome', ''), nullif(d.dados_autor->>'nome_completo', ''), 'Autor não informado') AS autor,
    d.criado_em,
    CASE
      WHEN d.desconsiderado_em IS NOT NULL THEN 'desconsiderado'
      WHEN jsonb_array_length(d.assinantes) = 0 THEN 'concluido'
      WHEN EXISTS (SELECT FROM reabilitah.conferencia_assinatura c WHERE c.documento_id=d.id AND c.decisao='APROVADA') THEN 'concluido'
      WHEN envio.id IS NULL THEN 'assinatura'
      WHEN conferencia.decisao IS NULL THEN 'conferencia'
      ELSE 'reenvio'
    END AS status
  FROM reabilitah.documento d
  JOIN reabilitah.paciente p ON p.id=d.paciente_id AND p.instituicao_id=d.instituicao_id
  JOIN reabilitah.modelo_documento m ON m.id=d.modelo_documento_id
  JOIN reabilitah.tipo_documento t ON t.id=m.tipo_documento_id
  LEFT JOIN LATERAL (
    SELECT f.id FROM reabilitah.documento_arquivo f
    WHERE f.documento_id=d.id AND f.tipo='DIGITALIZACAO'
    ORDER BY f.numero_envio DESC LIMIT 1
  ) envio ON true
  LEFT JOIN reabilitah.conferencia_assinatura conferencia ON conferencia.arquivo_id=envio.id
`;

export const listDocuments = cache(async (): Promise<DocumentSummary[]> => {
  await requireReady();
  return transaction(await currentHash(), async (db) => {
    const result = await db.query<Omit<DocumentSummary, 'criado_em'> & { criado_em: Date }>(
      `${documentStateSql} ORDER BY d.criado_em DESC, d.id`,
    );
    return result.rows.map((row) => ({ ...row, criado_em: row.criado_em.toISOString() }));
  });
});
