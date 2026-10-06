'use client';
import Link from 'next/link';
import { useActionState, useState, useId, type ComponentProps } from 'react';
import { LoaderCircle } from 'lucide-react';
import { PasswordField } from './forms';
import { JobPicker } from './job-picker';
import {
  changeMemberAccess,
  createMember,
  resetMemberPassword,
  saveInstitution,
  saveMember,
} from '@/server/management/actions';
import {
  permissionLabels,
  type Institution,
  type Member,
  type MemberData,
  type Permission,
  type ManagementState,
} from '@/lib/management';

function TextField({ label, ...props }: ComponentProps<'input'> & { label: string }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}
function Feedback({ state }: { state: ManagementState }) {
  return state.error ? (
    <p className="notice error" role="alert">
      {state.error}
    </p>
  ) : state.success ? (
    <p className="notice success-notice" role="status">
      {state.success}
    </p>
  ) : null;
}
function SaveButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button className="primary" disabled={pending}>
      {pending && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
      {pending ? 'Salvando…' : children}
    </button>
  );
}
export function InstitutionForm({ institution }: { institution?: Institution }) {
  const [state, action, pending] = useActionState(saveInstitution, {});
  const [values, setValues] = useState({
    nome: institution?.nome ?? '',
    nome_legal: institution?.nome_legal ?? '',
    cnpj: institution?.cnpj ?? '',
    email: institution?.email ?? '',
    telefone: institution?.telefone ?? '',
  });
  const field = (name: keyof typeof values) => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues({ ...values, [name]: event.target.value }),
  });
  return (
    <form action={action} className="card management-form form-stack" aria-busy={pending}>
      {institution && (
        <>
          <input type="hidden" name="id" value={institution.id} />
          <input type="hidden" name="versao" value={institution.versao} />
        </>
      )}
      <div>
        <h2>Dados da instituição</h2>
        <p className="hint">Nome obrigatório. Os dados de contato podem ser completados depois.</p>
      </div>
      <div className="form-grid">
        <TextField
          label="Nome da instituição"
          {...field('nome')}
          required
          minLength={2}
          maxLength={160}
          autoComplete="organization"
        />
        <TextField label="Razão social" {...field('nome_legal')} maxLength={200} />
        <TextField label="CNPJ" {...field('cnpj')} inputMode="numeric" maxLength={18} />
        <TextField label="E-mail de contato" {...field('email')} type="email" maxLength={254} />
        <TextField label="Telefone" {...field('telefone')} type="tel" maxLength={30} />
      </div>
      <Feedback state={state} />
      <div className="form-actions">
        <Link href="/administracao" className="secondary">
          Cancelar
        </Link>
        <SaveButton pending={pending}>
          {institution ? 'Salvar alterações' : 'Cadastrar instituição'}
        </SaveButton>
      </div>
    </form>
  );
}
export function MemberForm({
  institutionId,
  member,
  permissions,
  jobs,
  superAdmin,
  ownAccount = false,
}: {
  institutionId: string;
  member?: Member;
  permissions: Permission[];
  jobs: string[];
  superAdmin: boolean;
  ownAccount?: boolean;
}) {
  const [state, action, pending] = useActionState(member ? saveMember : createMember, {});
  const profileId = useId();
  const [mode, setMode] = useState('nova');
  const [values, setValues] = useState<MemberData>({
    nome: member?.nome ?? '',
    email: member?.email ?? '',
    perfil: member?.perfil ?? 'COLABORADOR',
    telefone: member?.telefone ?? '',
    registro_profissional: member?.registro_profissional ?? '',
    cargo: member?.cargo ?? '',
  });
  const [codes, setCodes] = useState(member?.permissoes ?? []);
  const field = (name: 'nome' | 'email' | 'telefone' | 'registro_profissional' | 'cargo') => ({
    name,
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues({ ...values, [name]: event.target.value }),
  });
  const sharedEmail = !superAdmin && member?.multiplas_instituicoes;
  return (
    <form action={action} className="card management-form form-stack" aria-busy={pending}>
      <input type="hidden" name="instituicao" value={institutionId} />
      {member && (
        <>
          <input type="hidden" name="id" value={member.id} />
          <input type="hidden" name="versao" value={member.versao} />
        </>
      )}
      {!member && !superAdmin && <input type="hidden" name="conta" value="nova" />}
      {!member && superAdmin && (
        <fieldset className="form-section">
          <legend>Acesso ao sistema</legend>
          <div className="choice-group">
            <label className="check-row">
              <input
                type="radio"
                name="conta"
                value="nova"
                checked={mode === 'nova'}
                onChange={() => setMode('nova')}
              />
              Criar novo acesso
            </label>
            <label className="check-row">
              <input
                type="radio"
                name="conta"
                value="existente"
                checked={mode === 'existente'}
                onChange={() => setMode('existente')}
              />
              Vincular conta existente
            </label>
          </div>
          <p className="hint">
            {mode === 'nova'
              ? 'Cadastre uma pessoa que ainda não possui acesso ao Reabilitah.'
              : 'Informe o e-mail já utilizado no Reabilitah. A senha atual e os acessos às outras instituições serão preservados.'}
          </p>
        </fieldset>
      )}
      <fieldset className="form-section">
        <legend>Dados do membro da equipe</legend>
        <div className="form-grid">
          <TextField
            label="Nome completo"
            {...field('nome')}
            required
            minLength={2}
            maxLength={160}
            autoComplete="name"
          />
          <TextField
            label="E-mail de acesso"
            {...field('email')}
            required
            type="email"
            maxLength={254}
            readOnly={Boolean(sharedEmail)}
          />
          <TextField
            label="Telefone"
            {...field('telefone')}
            type="tel"
            maxLength={30}
            autoComplete="tel"
          />
          <TextField
            label="Registro profissional"
            {...field('registro_profissional')}
            maxLength={80}
            placeholder="Conselho, número e UF, se houver"
          />
          <JobPicker
            jobs={jobs}
            value={values.cargo}
            onChange={(cargo) => setValues({ ...values, cargo })}
          />
        </div>
        <p className="hint">
          O cargo identifica a função profissional. As permissões de acesso são definidas abaixo.
        </p>
        {sharedEmail && (
          <p className="hint">
            O e-mail é compartilhado entre instituições. Somente o Super Administrador pode
            alterá-lo.
          </p>
        )}
      </fieldset>
      <fieldset className="form-section">
        <legend>Perfil e permissões</legend>
        <div className="field">
          <label htmlFor={profileId}>Perfil na instituição</label>
          {ownAccount ? (
            <>
              <input
                id={profileId}
                value={
                  values.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Permissões específicas'
                }
                readOnly
              />
              <input type="hidden" name="perfil" value={values.perfil} />
            </>
          ) : (
            <select
              id={profileId}
              name="perfil"
              value={values.perfil}
              onChange={(e) =>
                setValues({ ...values, perfil: e.target.value as MemberData['perfil'] })
              }
            >
              <option value="COLABORADOR">Permissões específicas</option>
              {(superAdmin || member?.perfil === 'ADMINISTRADOR') && (
                <option value="ADMINISTRADOR">Administrador</option>
              )}
            </select>
          )}
        </div>
        {values.perfil === 'ADMINISTRADOR' ? (
          <p className="notice">
            O administrador também faz parte da equipe e tem acesso a todas as atividades da
            instituição. Somente o Super Administrador pode conceder o papel de administrador.
          </p>
        ) : (
          <>
            <p className="hint">
              Todos os colaboradores podem consultar os pacientes e documentos da própria
              instituição. Selecione as atividades que esta pessoa poderá realizar. Desconsiderar
              documentos e conferir assinaturas são atribuições dos administradores.
            </p>
            <div className="permission-grid">
              {permissions.map((p) => (
                <label className="check-row" key={p.codigo}>
                  <input
                    type="checkbox"
                    name="permissoes"
                    value={p.codigo}
                    checked={codes.includes(p.codigo)}
                    onChange={(e) =>
                      setCodes(
                        e.target.checked
                          ? [...codes, p.codigo]
                          : codes.filter((c) => c !== p.codigo),
                      )
                    }
                  />
                  <span>{permissionLabels[p.codigo] ?? p.nome}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </fieldset>
      {!member && mode === 'nova' && (
        <fieldset className="form-section">
          <legend>Senha temporária</legend>
          <div className="form-grid">
            <PasswordField label="Senha temporária" autoComplete="new-password" />
            <PasswordField
              label="Confirme a senha temporária"
              name="confirmacao"
              autoComplete="new-password"
            />
          </div>
          <p className="hint">
            Use de 12 a 128 caracteres. Informe esta senha à pessoa por um canal privado. Ela deverá
            escolher uma senha pessoal no primeiro acesso.
          </p>
        </fieldset>
      )}
      <Feedback state={state} />
      <div className="form-actions">
        <Link href="/configuracoes/equipe" className="secondary">
          Cancelar
        </Link>
        <SaveButton pending={pending}>
          {member
            ? 'Salvar alterações'
            : mode === 'existente'
              ? 'Vincular à instituição'
              : 'Cadastrar membro'}
        </SaveButton>
      </div>
    </form>
  );
}
export function ResetMemberPassword({
  institutionId,
  member,
  superAdmin,
}: {
  institutionId: string;
  member: Member;
  superAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(resetMemberPassword, {});
  if (!superAdmin && member.multiplas_instituicoes)
    return (
      <section className="card management-form">
        <h2>Redefinir senha</h2>
        <p className="notice">
          Este usuário está vinculado a mais de uma instituição. Somente o Super Administrador pode
          redefinir sua senha.
        </p>
      </section>
    );
  return (
    <details className="card management-details">
      <summary>Redefinir senha</summary>
      <form action={action} className="form-stack" aria-busy={pending}>
        <input type="hidden" name="instituicao" value={institutionId} />
        <input type="hidden" name="id" value={member.id} />
        <p className="hint">
          A pessoa perderá as sessões abertas e deverá escolher uma nova senha pessoal ao entrar
          novamente.
        </p>
        <div className="form-grid">
          <PasswordField label="Senha temporária" autoComplete="new-password" />
          <PasswordField
            label="Confirme a senha temporária"
            name="confirmacao"
            autoComplete="new-password"
          />
        </div>
        <label className="check-row">
          <input type="checkbox" name="confirmado" value="sim" required />
          Confirmo a redefinição da senha e o encerramento das sessões.
        </label>
        <Feedback state={state} />
        <div className="form-actions">
          <SaveButton pending={pending}>Redefinir senha</SaveButton>
        </div>
      </form>
    </details>
  );
}
export function MemberAccess({
  member,
  superAdmin,
  institutionId,
}: {
  member: Member;
  superAdmin: boolean;
  institutionId: string;
}) {
  const [state, action, pending] = useActionState(changeMemberAccess, {});
  const [reason, setReason] = useState('');
  if (!member.ativo && member.perfil === 'ADMINISTRADOR' && !superAdmin)
    return (
      <p className="notice">
        Somente o Super Administrador pode reativar este acesso de administrador.
      </p>
    );
  return (
    <details className="card management-details">
      <summary>
        {member.ativo ? 'Desativar acesso à instituição' : 'Reativar acesso à instituição'}
      </summary>
      <form action={action} className="form-stack" aria-busy={pending}>
        <input type="hidden" name="instituicao" value={institutionId} />
        <input type="hidden" name="id" value={member.id} />
        <input type="hidden" name="versao" value={member.versao} />
        <input type="hidden" name="ativar" value={member.ativo ? 'nao' : 'sim'} />
        <p className="hint">
          {member.ativo
            ? 'A pessoa perderá o acesso a esta instituição. Os documentos e o histórico serão preservados; os vínculos com outras instituições continuarão ativos.'
            : 'A pessoa voltará a acessar esta instituição com o perfil e as permissões exibidos no cadastro.'}
        </p>
        <label className="field">
          Justificativa
          <textarea
            name="justificativa"
            required
            minLength={10}
            maxLength={1000}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="check-row">
          <input type="checkbox" name="confirmado" value="sim" required />
          Confirmo a alteração do acesso de {member.nome}.
        </label>
        <Feedback state={state} />
        <div className="form-actions">
          <SaveButton pending={pending}>
            {member.ativo ? 'Confirmar desativação' : 'Confirmar reativação'}
          </SaveButton>
        </div>
      </form>
    </details>
  );
}
