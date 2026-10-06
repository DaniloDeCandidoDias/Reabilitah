import 'server-only';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { findSession, listMemberships, type Session } from '@/server/auth/repository';
export const COOKIE = 'reabilitah_session';
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export type { Session, Membership } from '@/server/auth/repository';
export async function currentHash() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? tokenHash(token) : null;
}
export async function getSession(): Promise<Session | null> {
  const hash = await currentHash();
  if (!hash) return null;
  return findSession(hash);
}
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/');
  return session;
}
export async function requireReady() {
  const session = await requireSession();
  if (session.exige_troca_senha) redirect('/nova-senha');
  return session;
}
export async function memberships() {
  return listMemberships(await currentHash());
}
export async function landing(session: Session) {
  if (session.exige_troca_senha) return '/nova-senha';
  if (session.super_administrador) return '/administracao';
  const choices = await memberships();
  if (choices.length === 1 && session.instituicao_id === choices[0].id) return '/inicio';
  return '/instituicoes';
}
