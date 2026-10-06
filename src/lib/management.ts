import { z } from 'zod';

const email = z.email().max(254);
export const memberSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  email,
  perfil: z.enum(['ADMINISTRADOR', 'COLABORADOR']),
  telefone: z.string().trim().max(30),
  registro_profissional: z.string().trim().max(80),
  cargo: z.string().trim().min(2).max(80),
});
export const institutionSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  nome_legal: z.string().trim().max(200),
  email: z.union([email, z.literal('')]),
  telefone: z.string().trim().max(30),
  cnpj: z.union([z.string().regex(/^\d{14}$/), z.literal('')]),
});
export type MemberData = z.infer<typeof memberSchema>;
export type InstitutionData = z.infer<typeof institutionSchema>;
export type Member = MemberData & {
  id: string;
  usuario_id: string;
  ativo: boolean;
  versao: number;
  multiplas_instituicoes: boolean;
  permissoes: string[];
};
export type Institution = InstitutionData & { id: string; versao: number };
export type Permission = { codigo: string; nome: string };
export const standardJobs = ['Psicólogo(a)', 'Enfermeiro(a)', 'Coordenador(a)', 'Monitor(a)'];
export type HistoryType = { codigo: string; nome: string; grupo: string };
export const historySelectionSchema = z.array(z.string().regex(/^[a-z-]{1,60}$/)).max(100);
export type ManagementState = { error?: string; success?: string };
export type HistoryEntry = {
  id: string;
  ocorrido_em: string;
  autor: string;
  acao: string;
  entidade: string;
  descricao: string;
  justificativa: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

export const permissionLabels: Record<string, string> = {
  'pacientes.cadastrar': 'Cadastrar pacientes e gerar a Ficha de Acolhimento',
  'pacientes.corrigir': 'Corrigir cadastro de pacientes',
  'pacientes.readmitir': 'Readmitir pacientes',
  'documentos.enviar-digitalizacao': 'Enviar documentos digitalizados',
  'documentos.criar.termo-acolhimento': 'Criar Termo de Acolhimento',
  'documentos.criar.evolucao-geral': 'Criar Evolução Geral',
  'documentos.criar.declaracao-desligamento': 'Criar Declaração de Desligamento',
  'documentos.criar.evolucao-enfermagem': 'Criar Evolução de Enfermagem',
};

export function managementError(error: unknown): string {
  const messages: Record<string, string> = {
    ACESSO_NEGADO: 'Você não tem permissão para realizar esta ação nesta instituição.',
    PROMOCAO_RESTRITA:
      'Somente o Super Administrador pode conceder ou reativar o acesso de administrador.',
    CADASTRO_ALTERADO:
      'Este cadastro mudou desde que a página foi aberta. Atualize a página e confira os dados antes de salvar.',
    EMAIL_CADASTRADO:
      'Este e-mail já está cadastrado. Para adicionar uma conta existente, escolha “Vincular conta existente”.',
    VINCULO_RESTRITO:
      'Somente o Super Administrador pode vincular uma conta existente a outra instituição. Entre em contato com ele para solicitar o vínculo.',
    CONTA_OUTRA_INSTITUICAO:
      'Esta pessoa já está cadastrada no sistema e vinculada a outra instituição. Entre em contato com o Super Administrador para solicitar o vínculo com esta instituição.',
    CONTA_EXISTENTE_SUPER:
      'Esta pessoa já possui cadastro no sistema. Entre em contato com o Super Administrador para verificar o acesso e solicitar o vínculo.',
    CONTA_INDISPONIVEL:
      'A conta não está disponível para esta operação. Confira o e-mail ou contate o Super Administrador.',
    VINCULO_EXISTENTE:
      'Esta pessoa já possui um vínculo com a instituição. Abra seu cadastro na lista da equipe, incluindo os inativos.',
    ULTIMO_ADMINISTRADOR:
      'A instituição precisa manter pelo menos um administrador ativo. O Super Administrador deve designar outro antes desta alteração.',
    PROPRIO_ACESSO:
      'Você não pode remover ou mudar o próprio perfil de acesso. Para sua senha, use “Alterar minha senha”.',
    RESET_MULTIPLAS_INSTITUICOES:
      'Este usuário está vinculado a mais de uma instituição. Somente o Super Administrador pode redefinir sua senha.',
    EMAIL_MULTIPLAS_INSTITUICOES:
      'Este e-mail é usado em mais de uma instituição. Somente o Super Administrador pode alterá-lo.',
    JUSTIFICATIVA_OBRIGATORIA: 'Informe uma justificativa com 10 a 1.000 caracteres.',
    PERMISSAO_INVALIDA: 'Confira as permissões selecionadas.',
    DADOS_INVALIDOS: 'Confira os dados informados.',
    SENHA_INVALIDA: 'Informe uma senha temporária com 12 a 128 caracteres.',
    CARGO_INDISPONIVEL:
      'Este cargo está inativo. Selecione outro cargo ou procure o administrador.',
  };
  const message = error instanceof Error ? error.message : '';
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505')
    return 'Já existe um cadastro com estes dados. Confira a lista antes de tentar novamente.';
  if (code === '55P03')
    return 'Outra alteração está em andamento. Aguarde alguns instantes e tente novamente.';
  return (
    messages[message] ??
    'Não foi possível salvar. Tente novamente; se persistir, entre em contato com o suporte.'
  );
}
