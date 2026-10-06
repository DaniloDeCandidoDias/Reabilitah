import { History } from 'lucide-react';
import { EmptyState } from './ui';
import { formatDateTime } from '@/lib/presentation';
import type { HistoryEntry } from '@/lib/management';

const actions: Record<string, string> = {
  INSERT: 'Cadastro criado',
  UPDATE: 'Cadastro atualizado',
  ALTERAR_EMAIL: 'E-mail de acesso alterado',
  REATIVAR_ACESSO: 'Acesso reativado',
  DESATIVAR_ACESSO: 'Acesso desativado',
  REDEFINIR_SENHA: 'Senha temporária redefinida',
  TROCAR_SENHA: 'Senha pessoal alterada',
  LOGIN: 'Entrada no sistema',
  LOGOUT: 'Saída do sistema',
  SELECIONAR_INSTITUICAO: 'Acesso à instituição',
  EMISSAO: 'Documento emitido',
  DESCONSIDERACAO: 'Documento desconsiderado',
  ORIGINAL_ARMAZENADO: 'Original armazenado',
  DIGITALIZACAO_ARMAZENADO: 'Digitalização enviada',
  CONFERENCIA_APROVADA: 'Assinatura aprovada',
  CONFERENCIA_REJEITADA: 'Assinatura rejeitada',
};
const entities: Record<string, string> = {
  usuario: 'Conta de usuário',
  vinculo_institucional: 'Membro da equipe',
  permissao_vinculo: 'Permissões',
  instituicao: 'Instituição',
  sessao_usuario: 'Acesso',
  documento: 'Documento',
  paciente: 'Paciente',
  responsavel: 'Responsável',
  cargo: 'Cargo',
  aviso: 'Aviso',
  configuracao_institucional: 'Configurações',
};
const fields: Record<string, string> = {
  nome: 'Nome',
  nome_completo: 'Nome completo',
  email: 'E-mail',
  perfil: 'Perfil',
  telefone: 'Telefone',
  registro_profissional: 'Registro profissional',
  cargo: 'Cargo',
  ativo: 'Acesso ativo',
  ativa: 'Ativa',
  nome_legal: 'Razão social',
  cnpj: 'CNPJ',
};
function value(input: unknown) {
  if (input === true) return 'Sim';
  if (input === false) return 'Não';
  if (input === 'ADMINISTRADOR') return 'Administrador';
  if (input === 'COLABORADOR') return 'Permissões específicas';
  return typeof input === 'string' && input ? input : 'Não informado';
}
export function HistoryList({
  entries,
  filtered = false,
}: {
  entries: HistoryEntry[];
  filtered?: boolean;
}) {
  if (!entries.length)
    return (
      <EmptyState
        icon={History}
        title={filtered ? 'Nenhuma atividade encontrada' : 'Nenhuma atividade registrada'}
        description={
          filtered
            ? 'Não há registros que correspondam ao filtro selecionado.'
            : 'As atividades realizadas aparecerão neste histórico.'
        }
      />
    );
  return (
    <ol className="history-list">
      {entries.map((e) => {
        const changes = Object.keys(fields).filter(
          (key) => e.depois && key in e.depois && e.depois[key] !== e.antes?.[key],
        );
        return (
          <li className="card history-card" key={e.id}>
            <div className="history-heading">
              <h2>{actions[e.acao] ?? 'Atividade registrada'}</h2>
              <time dateTime={e.ocorrido_em}>{formatDateTime(e.ocorrido_em)}</time>
            </div>
            <p className="history-author">
              Por <strong>{e.autor}</strong>
            </p>
            <p className="hint">
              {entities[e.entidade] ?? 'Registro'}
              {e.descricao ? ` · ${e.descricao}` : ''}
            </p>
            {e.justificativa && (
              <p className="history-reason">
                <strong>Justificativa:</strong> {e.justificativa}
              </p>
            )}
            {changes.length > 0 && (
              <details>
                <summary>Ver alterações</summary>
                <dl className="change-list">
                  {changes.map((key) => (
                    <div key={key}>
                      <dt>{fields[key]}</dt>
                      <dd>
                        {e.antes && key in e.antes ? `${value(e.antes[key])} → ` : ''}
                        {value(e.depois![key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
