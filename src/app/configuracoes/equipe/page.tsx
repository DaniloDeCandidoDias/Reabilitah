import Link from 'next/link';
import { Plus, History } from 'lucide-react';
import { ManagementPage, SetupNotice } from '@/components/management-page';
import { TeamList } from '@/components/team-list';
import { requireManager, managementReady, listTeam } from '@/server/management/queries';

export default async function Page() {
  await requireManager();
  const ready = await managementReady();
  const members = ready ? await listTeam() : [];
  return (
    <ManagementPage
      title="Equipe"
      subtitle="Pessoas, perfis e permissões desta instituição."
      actions={
        ready && (
          <>
            <Link href="/configuracoes/historico" className="secondary">
              <History size={18} aria-hidden="true" />
              Histórico
            </Link>
            <Link href="/configuracoes/equipe/novo" className="primary">
              <Plus size={18} aria-hidden="true" />
              Adicionar membro
            </Link>
          </>
        )
      }
    >
      {ready ? <TeamList members={members} /> : <SetupNotice />}
    </ManagementPage>
  );
}
