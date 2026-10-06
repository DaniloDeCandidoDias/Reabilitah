'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkOrigin } from '@/lib/request-origin';
import { currentHash } from '@/lib/session';
import { transaction } from '@/lib/db';
import { hashPassword, validPassword } from '@/lib/password';
import {
  memberSchema,
  institutionSchema,
  managementError,
  type ManagementState,
} from '@/lib/management';
import { requireManager, requireSuper } from './queries';

const idSchema = z.uuid();
const versionSchema = z.coerce.number().int().positive();
const memberPath = (id: string) => `/configuracoes/equipe/${id}`;
function input(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}
function memberInput(form: FormData) {
  return memberSchema.safeParse({
    nome: input(form, 'nome'),
    email: input(form, 'email').toLowerCase(),
    perfil: input(form, 'perfil'),
    telefone: input(form, 'telefone'),
    registro_profissional: input(form, 'registro_profissional'),
    cargo: input(form, 'cargo'),
  });
}
function permissions(form: FormData) {
  return z.array(z.string().max(100)).max(30).parse(form.getAll('permissoes'));
}
function refreshTeam(id?: string) {
  revalidatePath('/configuracoes');
  revalidatePath('/configuracoes/equipe');
  revalidatePath('/configuracoes/historico');
  revalidatePath('/inicio');
  if (id) revalidatePath(memberPath(id));
}
export async function saveInstitution(
  _: ManagementState,
  form: FormData,
): Promise<ManagementState> {
  await checkOrigin();
  await requireSuper();
  const parsed = institutionSchema.safeParse({
    nome: input(form, 'nome'),
    nome_legal: input(form, 'nome_legal'),
    email: input(form, 'email').toLowerCase(),
    telefone: input(form, 'telefone'),
    cnpj: input(form, 'cnpj').replace(/\D/g, ''),
  });
  if (!parsed.success)
    return { error: 'Confira o nome, o e-mail e o CNPJ (14 dígitos, quando informado).' };
  let id: string;
  try {
    const target = input(form, 'id') ? idSchema.parse(input(form, 'id')) : null;
    const version = target ? versionSchema.parse(form.get('versao')) : null;
    id = await transaction(
      await currentHash(),
      async (db) =>
        (
          await db.query('SELECT reabilitah_gestao.salvar_instituicao($1,$2,$3) AS id', [
            target,
            parsed.data,
            version,
          ])
        ).rows[0].id,
    );
  } catch (error) {
    return { error: managementError(error) };
  }
  revalidatePath('/administracao');
  redirect(`/administracao/instituicoes/${id}?salvo=1`);
}
export async function createMember(_: ManagementState, form: FormData): Promise<ManagementState> {
  await checkOrigin();
  const { institution, session } = await requireManager();
  if (form.get('instituicao') !== institution.id)
    return { error: 'A instituição selecionada mudou. Atualize a página antes de continuar.' };
  const parsed = memberInput(form);
  if (!parsed.success) return { error: 'Confira o nome, o e-mail e os demais campos do cadastro.' };
  const existing = form.get('conta') === 'existente';
  if (existing && !session.super_administrador)
    return { error: managementError(new Error('VINCULO_RESTRITO')) };
  const password = String(form.get('senha') ?? '');
  if (!existing && (!validPassword(password) || password !== form.get('confirmacao')))
    return { error: 'As senhas devem ser iguais e ter entre 12 e 128 caracteres.' };
  let id: string;
  try {
    const codes = permissions(form);
    const hash = existing ? null : await hashPassword(password);
    id = await transaction(
      await currentHash(),
      async (db) =>
        (
          await db.query('SELECT reabilitah_gestao.criar_membro($1,$2,$3,$4,$5) AS id', [
            institution.id,
            parsed.data,
            codes,
            hash,
            existing,
          ])
        ).rows[0].id,
    );
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshTeam(id);
  redirect(`${memberPath(id)}?salvo=1`);
}
export async function saveMember(_: ManagementState, form: FormData): Promise<ManagementState> {
  await checkOrigin();
  const { institution } = await requireManager();
  if (form.get('instituicao') !== institution.id)
    return { error: 'A instituição selecionada mudou. Atualize a página antes de continuar.' };
  const parsed = memberInput(form);
  if (!parsed.success) return { error: 'Confira o nome, o e-mail e os demais campos do cadastro.' };
  let id: string;
  try {
    id = idSchema.parse(input(form, 'id'));
    const version = versionSchema.parse(form.get('versao'));
    const codes = permissions(form);
    await transaction(await currentHash(), (db) =>
      db.query('SELECT reabilitah_gestao.salvar_membro($1,$2,$3,$4,$5)', [
        institution.id,
        id,
        parsed.data,
        codes,
        version,
      ]),
    );
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshTeam(id);
  redirect(`${memberPath(id)}?salvo=1`);
}
export async function changeMemberAccess(
  _: ManagementState,
  form: FormData,
): Promise<ManagementState> {
  await checkOrigin();
  const { institution } = await requireManager();
  if (form.get('instituicao') !== institution.id)
    return { error: 'A instituição selecionada mudou. Atualize a página antes de continuar.' };
  if (form.get('confirmado') !== 'sim')
    return { error: 'Confirme que deseja alterar o acesso desta pessoa.' };
  let id: string;
  try {
    id = idSchema.parse(input(form, 'id'));
    const version = versionSchema.parse(form.get('versao'));
    const reason = z.string().min(10).max(1000).parse(input(form, 'justificativa'));
    const active = z.enum(['sim', 'nao']).parse(form.get('ativar')) === 'sim';
    await transaction(await currentHash(), (db) =>
      db.query('SELECT reabilitah_gestao.alterar_acesso($1,$2,$3,$4,$5)', [
        institution.id,
        id,
        active,
        reason,
        version,
      ]),
    );
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshTeam(id);
  redirect(`${memberPath(id)}?salvo=1`);
}
export async function resetMemberPassword(
  _: ManagementState,
  form: FormData,
): Promise<ManagementState> {
  await checkOrigin();
  const { institution } = await requireManager();
  if (form.get('instituicao') !== institution.id)
    return { error: 'A instituição selecionada mudou. Atualize a página antes de continuar.' };
  const password = String(form.get('senha') ?? '');
  if (!validPassword(password) || password !== form.get('confirmacao'))
    return { error: 'As senhas devem ser iguais e ter entre 12 e 128 caracteres.' };
  if (form.get('confirmado') !== 'sim')
    return { error: 'Confirme a redefinição da senha e o encerramento das sessões.' };
  try {
    const id = idSchema.parse(input(form, 'id'));
    const hash = await hashPassword(password);
    await transaction(await currentHash(), (db) =>
      db.query('SELECT reabilitah_gestao.redefinir_senha_membro($1,$2,$3)', [
        institution.id,
        id,
        hash,
      ]),
    );
    refreshTeam(id);
  } catch (error) {
    return { error: managementError(error) };
  }
  return {
    success:
      'Senha temporária definida. As sessões anteriores foram encerradas; a pessoa deverá criar uma senha pessoal ao entrar.',
  };
}
