export const documentNames: Record<string, string> = {
  'ficha-acolhimento': 'Ficha de Acolhimento',
  'termo-acolhimento': 'Termo de Acolhimento',
  'evolucao-geral': 'Evolução Geral',
  'declaracao-desligamento': 'Declaração de Desligamento',
  'evolucao-enfermagem': 'Evolução de Enfermagem',
};

export const documentStatuses = {
  concluido: { label: 'Concluído', tone: 'success' },
  assinatura: { label: 'Pendente de assinatura', tone: 'warning' },
  conferencia: { label: 'Em conferência', tone: 'info' },
  reenvio: { label: 'Aguardando novo envio', tone: 'warning' },
  desconsiderado: { label: 'Desconsiderado', tone: 'danger' },
} as const;
export type DocumentStatus = keyof typeof documentStatuses;
export type DocumentSummary = {
  id: string;
  codigo: string;
  tipo: string;
  paciente: string;
  paciente_id: string;
  autor: string;
  autor_id: string;
  criado_em: string;
  status: DocumentStatus;
};
export type PatientSummary = {
  id: string;
  nome_completo: string;
  apelido: string | null;
  ativo: boolean;
  ultimo_documento: string | null;
};

export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
