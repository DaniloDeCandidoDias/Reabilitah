import { Shell } from '@/components/shell';
import { EmptyState } from '@/components/ui';
import { DocumentCard } from '@/components/records';
import { MonthCounter } from '@/components/month-counter';
import { requireReady } from '@/lib/session';
import { getDashboard } from '@/server/dashboard/queries';
import { listDocuments } from '@/server/documents/queries';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, Clock3, FileText, PenLine, CircleAlert, ClipboardCheck } from 'lucide-react';

export default async function Page() {
  const session = await requireReady();
  if (!session.instituicao_id) redirect('/instituicoes');
  const [data, documents] = await Promise.all([getDashboard(), listDocuments()]);
  const pending = documents.filter((d) => ['assinatura', 'reenvio'].includes(d.status)).length;
  const reviewing = documents.filter((d) => d.status === 'conferencia').length;
  const monthFormat = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  const monthly: Record<string, number> = {};
  for (const doc of documents) {
    const month = monthFormat.format(new Date(doc.criado_em));
    monthly[month] = (monthly[month] ?? 0) + 1;
  }
  const indicators = [
    { label: 'Pacientes ativos', value: data.acolhidos, icon: Users },
    { label: 'Média de acolhimento (dias)', value: data.media_dias ?? '—', icon: Clock3 },
    { label: 'Documentos', value: documents.length, icon: FileText },
    { label: 'Pendentes de assinatura', value: pending, icon: PenLine },
  ];
  return (
    <Shell active="/inicio" pending={pending + reviewing}>
      <header className="dashboard-header">
        <div className="greeting">
          <p>Olá,</p>
          <h1>{data.name}</h1>
        </div>
        <div className="stat-grid">
          {indicators.map(({ label, value, icon: Icon }, index) => (
            <div
              className={`stat enter ${index === 3 && pending > 0 ? 'stat-warning' : ''}`}
              style={{ animationDelay: `${index * 60}ms` }}
              key={label}
            >
              <Icon size={16} aria-hidden="true" />
              <strong>{value}</strong>
              <p>{label}</p>
            </div>
          ))}
        </div>
        <MonthCounter initialMonth={monthFormat.format(new Date())} counts={monthly} />
      </header>
      <div className="content dashboard-content">
        {reviewing > 0 && (
          <Link className="review-notice" href="/documentos">
            <ClipboardCheck size={20} aria-hidden="true" />
            <span>
              {reviewing} {reviewing === 1 ? 'documento aguarda' : 'documentos aguardam'}{' '}
              conferência de assinatura
            </span>
          </Link>
        )}
        <section>
          <div className="section-heading">
            <h2>
              <CircleAlert size={20} className="amber" aria-hidden="true" />
              Quadro de Avisos
            </h2>
          </div>
          {data.notices.length ? (
            <div className="record-list">
              {data.notices.map((notice) => (
                <article className="card notice-card" key={notice.id}>
                  <p>{notice.mensagem}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="card quiet-empty">Nenhum aviso ativo no momento</div>
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>Últimos documentos criados</h2>
            <Link className="text-button" href="/documentos">
              Ver todos
            </Link>
          </div>
          {documents.length ? (
            <div className="record-list">
              {documents.slice(0, 3).map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          ) : (
            <div className="card">
              <EmptyState
                icon={FileText}
                title="Nenhum documento por enquanto"
                description="Os registros mais recentes dos pacientes aparecerão aqui."
              />
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
