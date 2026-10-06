import { Brand } from '@/components/brand';
import { BackLink } from '@/components/back-link';
import { ArrowLeft } from 'lucide-react';
import { requireReady, memberships } from '@/lib/session';
import { logout, selectInstitution } from '@/app/actions';
export default async function Page() {
  const session = await requireReady();
  const choices = await memberships();
  const hasInstitution = choices.some((i) => i.id === session.instituicao_id);
  const backHref = hasInstitution
    ? '/configuracoes'
    : session.super_administrador
      ? '/administracao'
      : null;
  return (
    <main className="center-page">
      <div className="card compact">
        {backHref ? (
          <BackLink href={backHref}>
            {hasInstitution ? 'Voltar às configurações' : 'Voltar à administração'}
          </BackLink>
        ) : (
          <form action={logout} className="back-form">
            <button className="back-link">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Voltar ao login</span>
            </button>
          </form>
        )}
        <Brand />
        <h1>Selecione a instituição</h1>
        <p className="subtitle">Escolha em qual instituição deseja trabalhar agora.</p>
        {choices.length ? (
          <div className="institution-list">
            {choices.map((i) => (
              <form action={selectInstitution} key={i.id}>
                <input type="hidden" name="instituicao" value={i.id} />
                <button className="institution-button">
                  <strong>{i.nome}</strong>
                  <span>
                    {i.perfil === 'ADMINISTRADOR'
                      ? 'Administrador'
                      : i.perfil === 'SUPER_ADMINISTRADOR'
                        ? 'Super administrador'
                        : 'Colaborador'}{' '}
                    →
                  </span>
                </button>
              </form>
            ))}
          </div>
        ) : (
          <p className="notice">
            Você ainda não possui acesso a uma instituição ativa. Entre em contato com o suporte.
          </p>
        )}
        {backHref && (
          <form action={logout}>
            <button className="text-button">Sair do sistema</button>
          </form>
        )}
      </div>
    </main>
  );
}
