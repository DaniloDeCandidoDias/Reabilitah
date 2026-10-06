import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ManagementPage, SetupNotice } from '@/components/management-page';
import { HistoryList } from '@/components/history-list';
import { HistoryFilters } from '@/components/history-filters';
import { historySelectionSchema } from '@/lib/management';
import {
  getHistory,
  listTeam,
  managementReady,
  requireManager,
  listHistoryTypes,
} from '@/server/management/queries';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    membro?: string;
    pagina?: string;
    tipo?: string | string[];
    filtrar?: string;
  }>;
}) {
  await requireManager();
  if (!(await managementReady()))
    return (
      <ManagementPage title="Histórico de atividades">
        <SetupNotice />
      </ManagementPage>
    );
  const search = await searchParams;
  const member = search.membro ? (await listTeam()).find((m) => m.id === search.membro) : undefined;
  if (search.membro && !member) notFound();
  const page = Number(search.pagina ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const options = await listHistoryTypes();
  const raw = search.tipo ? (Array.isArray(search.tipo) ? search.tipo : [search.tipo]) : [];
  const parsed = historySelectionSchema.safeParse(raw);
  if (!parsed.success || (search.filtrar !== undefined && search.filtrar !== '1')) notFound();
  let selected: string[] | null =
    search.filtrar === '1' || raw.length ? [...new Set(parsed.data)] : null;
  // Preserva os links dos filtros anteriores.
  if (!search.filtrar && typeof search.tipo === 'string') {
    if (search.tipo === 'todos') selected = null;
    if (search.tipo === 'sem-acessos')
      selected = options
        .filter((option) => option.codigo !== 'acessos')
        .map((option) => option.codigo);
    if (search.tipo === 'documentos')
      selected = [
        'criacao-documentos',
        'desconsideracao-documentos',
        'arquivos-documentos',
        'assinaturas',
      ];
  }
  if (selected?.some((code) => !options.some((option) => option.codigo === code))) notFound();
  if (selected?.length === options.length) selected = null;
  const { entries, more } = await getHistory(member?.usuario_id ?? null, page, selected);
  const pageHref = (number: number) => {
    const params = new URLSearchParams({ pagina: String(number) });
    if (selected !== null) {
      params.set('filtrar', '1');
      for (const code of selected) params.append('tipo', code);
    }
    if (member) params.set('membro', member.id);
    return `/configuracoes/historico?${params}`;
  };
  return (
    <ManagementPage
      title={member ? 'Histórico da pessoa' : 'Histórico de atividades'}
      subtitle={
        member
          ? `${member.nome} · Atividades e alterações relacionadas a esta pessoa na instituição.`
          : 'Atividades da instituição, com autor e data de cada registro.'
      }
      back={member ? `/configuracoes/equipe/${member.id}` : '/configuracoes/equipe'}
      backLabel={member ? 'Voltar ao cadastro' : 'Voltar à equipe'}
    >
      <HistoryFilters
        key={`${member?.id ?? 'instituicao'}-${selected?.join(',') ?? 'todos'}`}
        options={options}
        selected={selected}
        memberId={member?.id}
      />
      <HistoryList entries={entries} filtered={selected !== null} />
      <nav className="pagination" aria-label="Páginas do histórico">
        {page > 1 && (
          <Link className="secondary" href={pageHref(page - 1)}>
            Anterior
          </Link>
        )}
        <span>Página {page}</span>
        {more && page < 10000 && (
          <Link className="secondary" href={pageHref(page + 1)}>
            Próxima
          </Link>
        )}
      </nav>
    </ManagementPage>
  );
}
