import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Brand } from '@/components/brand';
import { BackLink } from '@/components/back-link';
import { InstitutionForm } from '@/components/management-forms';
import { SetupNotice } from '@/components/management-page';
import { managementReady, requireSuper, getInstitution } from '@/server/management/queries';
import { selectInstitution } from '@/app/actions';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  await requireSuper();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ready = await managementReady();
  const institution = ready ? await getInstitution(id) : undefined;
  if (ready && !institution) notFound();
  const search = await searchParams;
  return (
    <main className="admin-page">
      <header>
        <Brand compact />
      </header>
      <BackLink href="/administracao">Voltar às instituições</BackLink>
      <div className="page-heading">
        <h1>{institution?.nome ?? 'Instituição'}</h1>
        <p className="subtitle">Edite os dados cadastrais da instituição.</p>
      </div>
      {institution ? (
        <div className="management-content">
          {search.salvo === '1' && (
            <p className="notice success-notice" role="status">
              Instituição salva. A alteração foi registrada no histórico.
            </p>
          )}
          <form action={selectInstitution}>
            <input type="hidden" name="instituicao" value={id} />
            <button className="primary">Acessar instituição</button>
          </form>
          <InstitutionForm key={institution.versao} institution={institution} />
        </div>
      ) : (
        <SetupNotice />
      )}
    </main>
  );
}
