import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { currentHash, requireReady, memberships } from '@/lib/session';
import { transaction } from '@/lib/db';
import type { HistoryEntry, HistoryType, Institution, Member, Permission } from '@/lib/management';

export const requireManager = cache(async () => {
  const session = await requireReady();
  const institution = (await memberships()).find((i) => i.id === session.instituicao_id);
  if (!institution) redirect('/instituicoes');
  if (!session.super_administrador && institution.perfil !== 'ADMINISTRADOR') redirect('/inicio');
  return { session, institution };
});
export async function requireSuper() {
  const session = await requireReady();
  if (!session.super_administrador) redirect('/inicio');
  return session;
}
export const managementReady = cache(async () =>
  transaction(await currentHash(), async (db) =>
    Boolean(
      (
        await db.query(
          "SELECT to_regprocedure('reabilitah_gestao.historico_selecionado(uuid,uuid,integer,text[])') IS NOT NULL AS ok",
        )
      ).rows[0].ok,
    ),
  ),
);
export async function listTeam() {
  const { institution } = await requireManager();
  return transaction(await currentHash(), async (db) => {
    const result = await db.query<Member>(
      `SELECT equipe.*,coalesce(c.nome,'') AS cargo
      FROM reabilitah_gestao.listar_equipe($1) equipe
      JOIN reabilitah.vinculo_institucional v ON v.id=equipe.id AND v.instituicao_id=$1
      LEFT JOIN reabilitah.cargo c ON c.id=v.cargo_id AND c.instituicao_id=v.instituicao_id
      ORDER BY equipe.ativo DESC,equipe.nome,equipe.id`,
      [institution.id],
    );
    return result.rows.map((row) => ({
      ...row,
      telefone: row.telefone ?? '',
      registro_profissional: row.registro_profissional ?? '',
    }));
  });
}
export async function listJobs() {
  const { institution } = await requireManager();
  return transaction(await currentHash(), async (db) =>
    (
      await db.query<{ nome: string }>(
        'SELECT nome FROM reabilitah.cargo WHERE instituicao_id=$1 AND ativo ORDER BY nome',
        [institution.id],
      )
    ).rows.map((row) => row.nome),
  );
}
export async function currentJob() {
  const session = await requireReady();
  return transaction(
    await currentHash(),
    async (db) =>
      (
        await db.query<{ cargo: string }>(
          `SELECT c.nome AS cargo FROM reabilitah.vinculo_institucional v
      JOIN reabilitah.cargo c ON c.id=v.cargo_id AND c.instituicao_id=v.instituicao_id
      WHERE v.usuario_id=$1 AND v.instituicao_id=$2 AND v.ativo`,
          [session.usuario_id, session.instituicao_id],
        )
      ).rows[0]?.cargo,
  );
}
export async function listPermissions() {
  await requireManager();
  return transaction(
    await currentHash(),
    async (db) =>
      (await db.query<Permission>('SELECT codigo,nome FROM reabilitah.permissao ORDER BY codigo'))
        .rows,
  );
}
export async function getInstitution(id: string) {
  await requireSuper();
  return transaction(
    await currentHash(),
    async (db) =>
      (
        await db.query<Institution>(
          `SELECT id,nome,coalesce(nome_legal,'') AS nome_legal,coalesce(email,'') AS email,
      coalesce(telefone,'') AS telefone,coalesce(cnpj,'') AS cnpj,versao FROM reabilitah.instituicao WHERE id=$1`,
          [id],
        )
      ).rows[0],
  );
}
export async function listHistoryTypes() {
  await requireManager();
  return transaction(
    await currentHash(),
    async (db) =>
      (
        await db.query<HistoryType>(
          'SELECT codigo,nome,grupo FROM reabilitah_gestao.tipos_atividade() ORDER BY ordem',
        )
      ).rows,
  );
}
export async function getHistory(person: string | null, page: number, selected: string[] | null) {
  const { institution } = await requireManager();
  return transaction(await currentHash(), async (db) => {
    const result = await db.query<Omit<HistoryEntry, 'ocorrido_em'> & { ocorrido_em: Date }>(
      'SELECT * FROM reabilitah_gestao.historico_selecionado($1,$2,$3,$4)',
      [institution.id, person, page, selected],
    );
    return {
      more: result.rows.length > 50,
      entries: result.rows
        .slice(0, 50)
        .map((r) => ({ ...r, ocorrido_em: r.ocorrido_em.toISOString() })),
    };
  });
}
