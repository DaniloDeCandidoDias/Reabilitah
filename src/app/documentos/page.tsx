import { Shell } from '@/components/shell';
import { DocumentList } from '@/components/records';
import { listDocuments } from '@/server/documents/queries';

export default async function Page() {
  const documents = await listDocuments();
  return (
    <Shell
      active="/documentos"
      pending={documents.filter((d) => !['concluido', 'desconsiderado'].includes(d.status)).length}
    >
      <DocumentList documents={documents} />
    </Shell>
  );
}
