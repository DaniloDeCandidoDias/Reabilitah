import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { History } from 'lucide-react';
import { ManagementPage, SetupNotice } from '@/components/management-page';
import { MemberForm, MemberAccess, ResetMemberPassword } from '@/components/management-forms';
import {
  requireManager,
  managementReady,
  listTeam,
  listPermissions,
  listJobs,
} from '@/server/management/queries';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const { session, institution } = await requireManager();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (!(await managementReady()))
    return (
      <ManagementPage title="Membro da equipe">
        <SetupNotice />
      </ManagementPage>
    );
  const [members, permissions, jobs, search] = await Promise.all([
    listTeam(),
    listPermissions(),
    listJobs(),
    searchParams,
  ]);
  const member = members.find((m) => m.id === id);
  if (!member) notFound();
  const own = member.usuario_id === session.usuario_id;
  return (
    <ManagementPage
      title={member.nome}
      subtitle={`${member.cargo || 'Cargo não informado'}${member.perfil === 'ADMINISTRADOR' ? ' · Administrador' : ''} · ${member.ativo ? 'Acesso ativo' : 'Acesso inativo'}`}
      back="/configuracoes/equipe"
      backLabel="Voltar à equipe"
      actions={
        <Link href={`/configuracoes/historico?membro=${member.id}`} className="secondary">
          <History size={18} aria-hidden="true" />
          Histórico da pessoa
        </Link>
      }
    >
      {search.salvo === '1' && (
        <p className="notice success-notice" role="status">
          Cadastro salvo. A alteração foi registrada no histórico.
        </p>
      )}
      <MemberForm
        jobs={jobs}
        institutionId={institution.id}
        key={`${id}-${member.versao}`}
        member={member}
        permissions={permissions}
        superAdmin={session.super_administrador}
        ownAccount={own}
      />
      {own ? (
        <p className="hint">
          Para alterar sua senha, acesse <Link href="/nova-senha">Alterar minha senha</Link>.
        </p>
      ) : (
        <>
          {member.ativo && (
            <ResetMemberPassword
              institutionId={institution.id}
              member={member}
              superAdmin={session.super_administrador}
            />
          )}
          <MemberAccess
            institutionId={institution.id}
            key={`acesso-${member.versao}`}
            member={member}
            superAdmin={session.super_administrador}
          />
        </>
      )}
    </ManagementPage>
  );
}
