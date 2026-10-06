import { redirect } from 'next/navigation';
import { Brand } from '@/components/brand';
import { LoginForm } from '@/components/forms';
import { getSession, landing } from '@/lib/session';

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ senha?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(await landing(session));
  const message = (await searchParams).senha === 'alterada';
  const support = process.env.SUPPORT_EMAIL;
  return (
    <main className="login-page">
      <div className="login-card enter">
        <header className="login-heading">
          <Brand />
          <h1>Bem-vindo</h1>
          <p>Reabilitah · Prontuário eletrônico</p>
        </header>
        {message && (
          <p className="notice success" role="status">
            Senha alterada. Entre com a nova senha.
          </p>
        )}
        <LoginForm />
        <p className="support">
          Precisa de ajuda? Entre em contato com o{' '}
          {support ? (
            <a href={`mailto:${support}`}>suporte</a>
          ) : (
            <a aria-disabled="true" role="link">
              suporte
            </a>
          )}
        </p>
      </div>
    </main>
  );
}
