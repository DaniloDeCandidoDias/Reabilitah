import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { hashPassword } from '../../src/lib/password';

type LocalSetup = {
  email: string;
  sqlPath: string;
  temporaryPassword: string;
};

export async function prepareLocalSetup(
  projectRoot: string,
  inputEmail: string,
): Promise<LocalSetup> {
  const email = z.email().max(254).parse(inputEmail.trim().toLowerCase());
  const envPath = join(projectRoot, '.env.local');
  const sqlPath = join(projectRoot, 'local', 'configurar-acesso.sql');
  const targets = [envPath, sqlPath];

  // Preserva qualquer configuração que já exista nessa pasta.
  for (const target of targets) {
    try {
      await access(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    throw new Error('Já existe uma configuração local. Nenhum arquivo foi substituído.');
  }

  const dbPassword = randomBytes(32).toString('hex');
  const temporaryPassword = randomBytes(18).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const schema = (await readFile(join(projectRoot, 'database', 'estrutura.sql'), 'utf8')).replace(
    /COMMIT;\s*$/,
    '',
  );

  // A estrutura e o primeiro acesso são confirmados na mesma transação.
  const setup = `
CREATE ROLE reabilitah_app LOGIN PASSWORD ${quote(dbPassword)}
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  IN ROLE reabilitah_runtime;
GRANT CONNECT ON DATABASE reabilitah TO reabilitah_app;

DO $$ BEGIN
  IF EXISTS (SELECT FROM reabilitah.usuario WHERE super_administrador) THEN
    RAISE EXCEPTION 'Super administrador já cadastrado. Não repetir a configuração.';
  END IF;
END $$;

WITH primeiro_acesso AS (
  INSERT INTO reabilitah.usuario(email, senha_hash, super_administrador, exige_troca_senha)
    VALUES (${quote(email)}, ${quote(passwordHash)}, true, true)
    RETURNING id
)
INSERT INTO reabilitah.instituicao(nome, criado_por)
  SELECT 'Instituição Luz do Vale', id FROM primeiro_acesso;

COMMIT;
SELECT 'Configuração concluída' AS resultado, current_database() AS banco;
`;

  const files = [
    {
      path: envPath,
      content: `DATABASE_URL=postgresql://reabilitah_app:${dbPassword}@127.0.0.1:5432/reabilitah\nAPP_ORIGIN=http://localhost:3000\nSUPPORT_EMAIL=${email}\n`,
    },
    { path: sqlPath, content: schema + setup },
  ];

  await mkdir(join(projectRoot, 'local'), { recursive: true });
  const created: string[] = [];
  try {
    for (const file of files) {
      await writeFile(file.path, file.content, { flag: 'wx', mode: 0o600 });
      created.push(file.path);
    }
  } catch (error) {
    // Em caso de falha, remove somente os arquivos criados nesta execução.
    for (const file of created.reverse()) await unlink(file);
    throw error;
  }

  return { email, sqlPath, temporaryPassword };
}
