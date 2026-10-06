import Link from 'next/link';
import { requireReady, memberships } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Home, Users, FileText, Settings, Building2 } from 'lucide-react';

const links = [
  ['/inicio', 'Início', Home],
  ['/pacientes', 'Pacientes', Users],
  ['/documentos', 'Documentos', FileText],
  ['/configuracoes', 'Config.', Settings],
] as const;

export async function Shell({
  children,
  active,
  pending = 0,
}: {
  children: React.ReactNode;
  active: string;
  pending?: number;
}) {
  const session = await requireReady();
  const institution = (await memberships()).find((i) => i.id === session.instituicao_id);
  if (!institution) redirect('/instituicoes');
  return (
    <div className={`workspace ${active === '/inicio' ? 'workspace-home' : ''}`}>
      <a href="#conteudo" className="skip-link">
        Ir para o conteúdo
      </a>
      <div className="app-context">
        <div className="institution-name">
          <Building2 size={16} aria-hidden="true" />
          <span>{institution.nome}</span>
        </div>
      </div>
      <main id="conteudo" className="workspace-main" tabIndex={-1}>
        {children}
      </main>
      <nav className="bottom-nav" aria-label="Navegação principal">
        <div className="bottom-nav-inner">
          {links.map(([href, label, Icon]) => (
            <Link
              href={href}
              key={href}
              className={`nav-link ${active === href ? 'selected' : ''}`}
              aria-current={active === href ? 'page' : undefined}
              aria-label={label}
              aria-describedby={
                href === '/documentos' && pending > 0 ? 'pendencias-documentos' : undefined
              }
            >
              <span className="nav-icon">
                <Icon size={24} aria-hidden="true" />
                {href === '/documentos' && pending > 0 && (
                  <span className="nav-badge" aria-hidden="true">
                    {pending > 9 ? '9+' : pending}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          ))}
        </div>
        {pending > 0 && (
          <span id="pendencias-documentos" className="sr-only">
            {pending} documentos pendentes
          </span>
        )}
      </nav>
    </div>
  );
}
