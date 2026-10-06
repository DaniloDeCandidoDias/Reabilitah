import 'server-only';
import { transaction } from '@/lib/db';
import { currentHash, requireReady } from '@/lib/session';

export async function getDashboard() {
  const session = await requireReady();
  return transaction(await currentHash(), async (db) => {
    const counts = await db.query<{ acolhidos: string; media_dias: string | null }>(`
      SELECT count(*) AS acolhidos,
        round(avg(greatest(0, (now() AT TIME ZONE 'America/Sao_Paulo')::date-data_entrada)))::text AS media_dias
      FROM reabilitah.acolhimento WHERE encerrado_em IS NULL
    `);
    const notices = await db.query<{ id: string; mensagem: string }>(`
      SELECT id, mensagem FROM reabilitah.aviso
      WHERE ativo AND inicio_em <= now() AND fim_em >= now()
      ORDER BY criado_em DESC, id
    `);
    const profile = await db.query<{ nome: string }>(
      'SELECT nome FROM reabilitah.vinculo_institucional WHERE usuario_id=$1 AND instituicao_id=$2 AND ativo',
      [session.usuario_id, session.instituicao_id],
    );
    return {
      ...counts.rows[0],
      notices: notices.rows,
      name: profile.rows[0]?.nome ?? session.email,
    };
  });
}
