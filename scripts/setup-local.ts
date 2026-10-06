import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { prepareLocalSetup } from './lib/local-setup';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
  },
});
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const prompt = values.email ? null : createInterface({ input: stdin, output: stdout });

try {
  const email = values.email ?? (await prompt!.question('E-mail do super administrador: '));
  const result = await prepareLocalSetup(projectRoot, email);

  console.log(`Configuração preparada para ${result.email}.`);
  console.log('No pgAdmin, conectado ao banco postgres, crie um banco vazio:');
  console.log("CREATE DATABASE reabilitah WITH TEMPLATE template0 ENCODING 'UTF8';");
  console.log('Abra o Query Tool do novo banco reabilitah.');
  console.log(`Abra no pgAdmin e execute uma vez: ${result.sqlPath}`);
  console.log(`Senha temporária (copie agora): ${result.temporaryPassword}`);
  console.log('Depois execute npm run dev e abra http://localhost:3000.');
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  console.error(
    code === 'EEXIST'
      ? 'Já existe uma configuração local. Ela foi preservada.'
      : 'Não foi possível preparar o acesso. Confira o e-mail e se já existem arquivos de configuração.',
  );
  process.exitCode = 1;
} finally {
  prompt?.close();
}
