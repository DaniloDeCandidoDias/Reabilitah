import 'server-only';
import { transaction } from '@/lib/db';
import { currentHash, requireReady } from '@/lib/session';
import type { PatientSummary } from '@/lib/presentation';

export async function listPatients(): Promise<PatientSummary[]> {
  await requireReady();
  return transaction(await currentHash(), async (db) => {
    const result = await db.query<
      Omit<PatientSummary, 'ultimo_documento'> & { ultimo_documento: Date | null }
    >(`
      SELECT p.id, p.nome_completo, p.apelido,
        EXISTS (SELECT FROM reabilitah.acolhimento a WHERE a.paciente_id=p.id AND a.encerrado_em IS NULL) AS ativo,
        (SELECT max(d.criado_em) FROM reabilitah.documento d WHERE d.paciente_id=p.id) AS ultimo_documento
      FROM reabilitah.paciente p ORDER BY p.nome_completo, p.id
    `);
    return result.rows.map((row) => ({
      ...row,
      ultimo_documento: row.ultimo_documento?.toISOString() ?? null,
    }));
  });
}
