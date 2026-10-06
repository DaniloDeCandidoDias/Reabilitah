import 'server-only';
import { Pool, type PoolClient } from 'pg';
const globalDb = globalThis as unknown as { reabilitahPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL nao configurada.');
  const url = new URL(process.env.DATABASE_URL);
  if (url.username === 'postgres') throw new Error('Use a conta restrita da aplicacao.');
  return (globalDb.reabilitahPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
export async function transaction<T>(
  hash: string | null,
  work: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool().connect();
  try {
    await db.query('BEGIN');
    // O contexto expira com a transação e não acompanha a conexão reutilizada.
    await db.query("SELECT set_config('reabilitah.token_hash', $1, true)", [hash ?? '']);
    const result = await work(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
