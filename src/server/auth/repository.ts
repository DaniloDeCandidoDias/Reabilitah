import 'server-only';
import { transaction } from '@/lib/db';

export type Session = {
  usuario_id: string;
  email: string;
  super_administrador: boolean;
  exige_troca_senha: boolean;
  instituicao_id: string | null;
};

export type Membership = { id: string; nome: string; perfil: string };
type Credential = { id: string; senha_hash: string; versao_credencial: number };

// As credenciais são consultadas somente pelo fluxo de autenticação no servidor.
export async function findCredential(email: string): Promise<Credential | null> {
  return transaction(null, async (db) => {
    const result = await db.query<Credential>('SELECT * FROM reabilitah_auth.credencial($1)', [
      email,
    ]);
    return result.rows[0] ?? null;
  });
}

export async function reserveLoginAttempt(emailHash: string): Promise<boolean> {
  return transaction(null, async (db) => {
    const result = await db.query<{ ok: boolean }>(
      'SELECT reabilitah_auth.reservar_tentativa($1) AS ok',
      [emailHash],
    );
    return result.rows[0].ok;
  });
}

export async function openSession(userId: string, credentialVersion: number, tokenHash: string) {
  await transaction(null, (db) =>
    db.query('SELECT reabilitah_auth.abrir_sessao($1,$2,$3)', [
      userId,
      credentialVersion,
      tokenHash,
    ]),
  );
}

export async function findSession(hash: string): Promise<Session | null> {
  return transaction(hash, async (db) => {
    const result = await db.query<Session>('SELECT * FROM reabilitah_auth.sessao_atual()');
    return result.rows[0] ?? null;
  });
}

export async function listMemberships(hash: string | null): Promise<Membership[]> {
  return transaction(hash, async (db) => {
    const result = await db.query<Membership>(
      'SELECT * FROM reabilitah_auth.instituicoes_disponiveis()',
    );
    return result.rows;
  });
}

export async function selectSessionInstitution(hash: string | null, institutionId: string) {
  await transaction(hash, (db) =>
    db.query('SELECT reabilitah_auth.selecionar_instituicao($1)', [institutionId]),
  );
}

export async function closeSession(hash: string | null) {
  await transaction(hash, (db) => db.query('SELECT reabilitah_auth.encerrar_sessao()'));
}

export async function findSessionCredential(hash: string | null): Promise<string | null> {
  return transaction(hash, async (db) => {
    const result = await db.query<{ hash: string | null }>(
      'SELECT reabilitah_auth.minha_credencial() AS hash',
    );
    return result.rows[0]?.hash ?? null;
  });
}

export async function updateSessionPassword(
  sessionHash: string | null,
  newPasswordHash: string,
  previousPasswordHash: string,
) {
  // A rotina do banco também revoga as sessões anteriores.
  await transaction(sessionHash, (db) =>
    db.query('SELECT reabilitah_auth.trocar_senha($1,$2)', [newPasswordHash, previousPasswordHash]),
  );
}
