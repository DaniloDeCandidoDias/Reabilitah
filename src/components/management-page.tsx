import { Shell } from './shell';
import { BackLink } from './back-link';

export function ManagementPage({
  title,
  subtitle,
  back = '/configuracoes',
  backLabel = 'Voltar às configurações',
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Shell active="/configuracoes">
      <header className="page-header management-header">
        <BackLink href={back}>{backLabel}</BackLink>
        <div className="page-title">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="header-actions">{actions}</div>}
        </div>
      </header>
      <div className="content management-content">{children}</div>
    </Shell>
  );
}
export function SetupNotice() {
  return (
    <p className="notice">
      A gestão de equipe está aguardando a atualização do sistema. Entre em contato com o
      responsável pelo suporte para concluir a configuração.
    </p>
  );
}
