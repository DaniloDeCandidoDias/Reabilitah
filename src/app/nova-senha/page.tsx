import { Brand } from '@/components/brand';
import { BackLink } from '@/components/back-link';
import { ArrowLeft } from 'lucide-react';
import { PasswordForm } from '@/components/forms';
import { requireSession, memberships } from '@/lib/session';
import { logout } from '@/app/actions';
export default async function Page() {
  const s = await requireSession();
  const choices = s.exige_troca_senha ? [] : await memberships();
  const hasInstitution = choices.some((i) => i.id === s.instituicao_id);
  const backHref = hasInstitution
    ? '/configuracoes'
    : s.super_administrador
      ? '/administracao'
      : '/instituicoes';
  return (
    <main className="center-page">
      <div className="card compact">
        {s.exige_troca_senha ? (
          <form action={logout} className="back-form">
            <button className="back-link">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Voltar ao login</span>
            </button>
          </form>
        ) : (
          <BackLink href={backHref}>
            {hasInstitution
              ? 'Voltar às configurações'
              : s.super_administrador
                ? 'Voltar à administração'
                : 'Voltar à seleção de instituição'}
          </BackLink>
        )}
        <Brand />
        <h1>{s.exige_troca_senha ? 'Defina sua nova senha' : 'Alterar minha senha'}</h1>
        <p className="subtitle">
          {s.exige_troca_senha
            ? 'Para continuar, substitua a senha temporária por uma senha pessoal.'
            : 'Sua senha é pessoal e vale para todas as suas instituições.'}
        </p>
        <PasswordForm />
        {!s.exige_troca_senha && (
          <form action={logout}>
            <button className="text-button">Sair do sistema</button>
          </form>
        )}
      </div>
    </main>
  );
}
