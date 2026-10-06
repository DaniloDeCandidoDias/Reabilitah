import Link from 'next/link';
import { Shell } from '@/components/shell';
import { Avatar } from '@/components/ui';
import { BackLink } from '@/components/back-link';
import { requireReady, memberships } from '@/lib/session';
import { logout } from '@/app/actions';
import { currentJob } from '@/server/management/queries';
import {
  Building2,
  ChevronRight,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  Users,
  History,
} from 'lucide-react';

export default async function Page() {
  const session = await requireReady();
  const choices = await memberships();
  const institution = choices.find((i) => i.id === session.instituicao_id);
  const job = await currentJob();
  const role = session.super_administrador
    ? 'Super administrador'
    : institution?.perfil === 'ADMINISTRADOR'
      ? 'Administrador'
      : job || 'Profissional';
  const support = process.env.SUPPORT_EMAIL;
  return (
    <Shell active="/configuracoes">
      <header className="page-header">
        <BackLink href="/inicio">Voltar ao início</BackLink>
        <div className="page-title">
          <h1>Configurações</h1>
        </div>
        <div className="profile-card">
          <Avatar name={session.email} />
          <div>
            <h2>{role}</h2>
            {institution?.perfil === 'ADMINISTRADOR' && job && <p>{job}</p>}
            <p>{session.email}</p>
            <span className="badge success">{institution?.nome}</span>
          </div>
        </div>
      </header>
      <div className="content settings-content">
        <section>
          <h2 className="section-label">Conta</h2>
          <div className="settings-group">
            <Link href="/nova-senha" className="settings-row">
              <span className="settings-icon">
                <LockKeyhole size={20} aria-hidden="true" />
              </span>
              <span>
                <strong>Alterar minha senha</strong>
                <small>Proteja o acesso à sua conta</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            {choices.length > 1 && (
              <Link href="/instituicoes" className="settings-row">
                <span className="settings-icon">
                  <Building2 size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>Trocar instituição</strong>
                  <small>Escolha onde deseja trabalhar</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
        {(session.super_administrador || institution?.perfil === 'ADMINISTRADOR') && (
          <section>
            <h2 className="section-label">Gestão</h2>
            <div className="settings-group">
              <Link href="/configuracoes/equipe" className="settings-row">
                <span className="settings-icon">
                  <Users size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>Gerenciar equipe</strong>
                  <small>Cadastros, acessos e permissões</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/configuracoes/historico" className="settings-row">
                <span className="settings-icon">
                  <History size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>Histórico de atividades</strong>
                  <small>Consulte o que foi feito e por quem</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              {session.super_administrador && (
                <Link href="/administracao" className="settings-row">
                  <span className="settings-icon">
                    <ShieldCheck size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>Administrar sistema</strong>
                    <small>Acesse as instituições cadastradas</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              )}
            </div>
          </section>
        )}
        <section>
          <h2 className="section-label">Suporte</h2>
          <div className="settings-group">
            {support ? (
              <a href={`mailto:${support}`} className="settings-row">
                <span className="settings-icon">
                  <Mail size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>Ajuda e suporte</strong>
                  <small>Entre em contato por e-mail</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </a>
            ) : (
              <div className="settings-row">
                <span className="settings-icon">
                  <Mail size={20} aria-hidden="true" />
                </span>
                <span>
                  <strong>Ajuda e suporte</strong>
                  <small>Em caso de dúvidas, procure o administrador da instituição.</small>
                </span>
              </div>
            )}
          </div>
        </section>
        <form action={logout}>
          <button className="settings-row logout-button">
            <span className="settings-icon">
              <LogOut size={20} aria-hidden="true" />
            </span>
            <span>
              <strong>Sair da conta</strong>
              <small>Encerrar esta sessão</small>
            </span>
          </button>
        </form>
        <p className="settings-footer">Reabilitah · Prontuário eletrônico</p>
      </div>
    </Shell>
  );
}
