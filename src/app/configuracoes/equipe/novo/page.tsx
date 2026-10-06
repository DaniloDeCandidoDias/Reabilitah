import { ManagementPage, SetupNotice } from '@/components/management-page';
import { MemberForm } from '@/components/management-forms';
import {
  requireManager,
  managementReady,
  listPermissions,
  listJobs,
} from '@/server/management/queries';

export default async function Page() {
  const { session, institution } = await requireManager();
  const ready = await managementReady();
  const permissions = ready ? await listPermissions() : [];
  const jobs = ready ? await listJobs() : [];
  return (
    <ManagementPage
      title="Adicionar membro"
      subtitle={
        session.super_administrador
          ? 'Cadastre uma pessoa ou vincule uma conta existente.'
          : 'Cadastre uma nova pessoa na equipe da instituição.'
      }
      back="/configuracoes/equipe"
      backLabel="Voltar à equipe"
    >
      {ready ? (
        <MemberForm
          jobs={jobs}
          institutionId={institution.id}
          permissions={permissions}
          superAdmin={session.super_administrador}
        />
      ) : (
        <SetupNotice />
      )}
    </ManagementPage>
  );
}
