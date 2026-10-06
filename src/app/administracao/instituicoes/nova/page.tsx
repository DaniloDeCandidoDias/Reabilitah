import { Brand } from '@/components/brand';
import { BackLink } from '@/components/back-link';
import { InstitutionForm } from '@/components/management-forms';
import { SetupNotice } from '@/components/management-page';
import { managementReady, requireSuper } from '@/server/management/queries';

export default async function Page() {
  await requireSuper();
  const ready = await managementReady();
  return (
    <main className="admin-page">
      <header>
        <Brand compact />
      </header>
      <BackLink href="/administracao">Voltar às instituições</BackLink>
      <div className="page-heading">
        <h1>Nova instituição</h1>
        <p className="subtitle">Cadastre a instituição e depois adicione sua equipe.</p>
      </div>
      {ready ? <InstitutionForm /> : <SetupNotice />}
    </main>
  );
}
