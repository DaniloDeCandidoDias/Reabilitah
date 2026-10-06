import { requireReady, memberships } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { BackLink } from '@/components/back-link';
import { logout, selectInstitution } from '@/app/actions';
import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { managementReady } from '@/server/management/queries';
import { SetupNotice } from '@/components/management-page';
export default async function Page() {
  const s = await requireReady();
  if (!s.super_administrador) redirect('/inicio');
  const choices = await memberships();
  const hasInstitution = choices.some((i) => i.id === s.instituicao_id);
  const ready = await managementReady();
  return (
    <main className="admin-page">
      <header>
        <Brand compact />
        <form action={logout}>
          <button className="secondary">Sair</button>
        </form>
      </header>
      {hasInstitution && <BackLink href="/configuracoes">Voltar às configurações</BackLink>}
      <div className="page-heading">
        <div>
          <span className="eyebrow">Super administrador</span>
          <h1>Instituições do sistema</h1>
          <p className="subtitle">Selecione uma instituição para acessar seu prontuário.</p>
        </div>
      </div>
      {ready ? (
        <div className="admin-toolbar">
          <Link className="primary" href="/administracao/instituicoes/nova">
            <Plus size={18} aria-hidden="true" />
            Nova instituição
          </Link>
        </div>
      ) : (
        <SetupNotice />
      )}
      {choices.length ? (
        <div className="stat-grid">
          {choices.map((i) => (
            <form action={selectInstitution} className="card" key={i.id}>
              <div className="institution-card-heading">
                <h2>{i.nome}</h2>
                {ready && (
                  <Link
                    href={`/administracao/instituicoes/${i.id}`}
                    className="icon-button edit-institution"
                    aria-label={`Editar dados de ${i.nome}`}
                    title="Editar dados da instituição"
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <input name="instituicao" type="hidden" value={i.id} />
              <button className="primary">Acessar instituição</button>
            </form>
          ))}
        </div>
      ) : (
        <section className="card empty">
          <h2>Nenhuma instituição cadastrada</h2>
          <p>As instituições cadastradas aparecerão aqui.</p>
        </section>
      )}
    </main>
  );
}
