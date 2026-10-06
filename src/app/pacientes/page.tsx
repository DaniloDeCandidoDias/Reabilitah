import { Shell } from '@/components/shell';
import { PatientList } from '@/components/records';
import { listPatients } from '@/server/patients/queries';

export default async function Page() {
  const rows = await listPatients();
  return (
    <Shell active="/pacientes">
      <PatientList patients={rows} />
    </Shell>
  );
}
