'use server';
import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { checkOrigin } from '@/lib/request-origin';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  findCredential,
  reserveLoginAttempt,
  openSession,
  selectSessionInstitution,
  closeSession,
  findSessionCredential,
  updateSessionPassword,
} from '@/server/auth/repository';
import { hashPassword, verifyPassword, validPassword } from '@/lib/password';
import {
  COOKIE,
  tokenHash,
  currentHash,
  requireSession,
  requireReady,
  getSession,
  landing,
  memberships,
} from '@/lib/session';
export type FormState = { error: string };
// Mantém a verificação de senha mesmo quando o e-mail não está cadastrado.
const dummy = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export async function login(_: FormState, form: FormData): Promise<FormState> {
  await checkOrigin();
  const parsed = z
    .object({ email: z.email().max(254), senha: z.string().min(1).max(128) })
    .safeParse({
      email: String(form.get('email') ?? '')
        .trim()
        .toLowerCase(),
      senha: form.get('senha'),
    });
  if (!parsed.success) return { error: 'Confira o e-mail e a senha informados.' };
  let token: string;
  try {
    const key = createHash('sha256').update(parsed.data.email).digest('hex');
    const allowed = await reserveLoginAttempt(key);
    if (!allowed) return { error: 'Muitas tentativas. Aguarde 15 minutos para tentar novamente.' };
    const user = await findCredential(parsed.data.email);
    const correct = await verifyPassword(parsed.data.senha, user?.senha_hash ?? dummy);
    if (!correct || !user) return { error: 'E-mail ou senha incorretos.' };
    token = randomBytes(32).toString('hex');
    await openSession(user.id, user.versao_credencial, tokenHash(token));
  } catch {
    return {
      error:
        'Não foi possível entrar. Verifique a configuração local ou entre em contato com o suporte.',
    };
  }
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  const session = await getSession();
  if (session && !session.exige_troca_senha && !session.super_administrador) {
    const choices = await memberships();
    if (choices.length === 1) {
      await selectSessionInstitution(await currentHash(), choices[0].id);
      redirect('/inicio');
    }
  }
  redirect(session ? await landing(session) : '/');
}
export async function logout() {
  await checkOrigin();
  await closeSession(await currentHash());
  (await cookies()).delete(COOKIE);
  redirect('/');
}
export async function selectInstitution(form: FormData) {
  await checkOrigin();
  await requireReady();
  const id = z.uuid().parse(form.get('instituicao'));
  await selectSessionInstitution(await currentHash(), id);
  redirect(form.get('destino') === 'equipe' ? '/configuracoes/equipe' : '/inicio');
}
export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  await checkOrigin();
  await requireSession();
  const password = String(form.get('senha') ?? '');
  const current = String(form.get('atual') ?? '');
  if (!validPassword(password)) return { error: 'Use uma senha com 12 a 128 caracteres.' };
  if (password !== form.get('confirmacao'))
    return { error: 'As novas senhas precisam ser iguais.' };
  if (password === current) return { error: 'Escolha uma senha diferente da atual.' };
  const hash = await currentHash();
  const credential = await findSessionCredential(hash);
  if (!credential || !(await verifyPassword(current, credential)))
    return { error: 'A senha atual está incorreta.' };
  const next = await hashPassword(password);
  await updateSessionPassword(hash, next, credential);
  (await cookies()).delete(COOKIE);
  redirect('/?senha=alterada');
}
