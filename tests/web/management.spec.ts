import { test, expect, type Page } from '@playwright/test';
import { expectClearFields } from './field-layout';

const temporary = 'SenhaTemporariaTeste!';
async function login(page: Page, email: string, password = 'SenhaSomenteParaTeste!') {
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
async function newMember(page: Page, name: string, email: string, profile: string) {
  await page.getByRole('link', { name: 'Adicionar membro', exact: true }).click();
  await page.getByLabel('Nome completo', { exact: true }).fill(name);
  await page.getByLabel('E-mail de acesso', { exact: true }).fill(email);
  await page.getByLabel('Perfil na instituição', { exact: true }).selectOption(profile);
  if (profile === 'ADMINISTRADOR') {
    await page.getByLabel('Cargo na instituição', { exact: true }).selectOption('Coordenador(a)');
  } else {
    await page.setViewportSize({ width: 320, height: 900 });
    const add = page.getByRole('button', { name: 'Adicionar novo cargo', exact: true });
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Novo cargo', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Nome do cargo')).toBeFocused();
    await dialog.getByLabel('Nome do cargo').fill('Cargo cancelado');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(page.getByLabel('Cargo na instituição')).toHaveValue('');
    await add.click();
    await expect(dialog.getByLabel('Nome do cargo')).toHaveValue('');
    await dialog.getByLabel('Nome do cargo').fill('Assistente social');
    const rect = (await dialog.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(320);
    await page.screenshot({ path: 'local/novo-cargo-320.png', animations: 'disabled' });
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel('Cargo na instituição')).toHaveValue('Assistente social');
    await expect(page.getByLabel('Nome completo')).toHaveValue(name);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Adicionar membro');
  }
  await page.getByLabel('Senha temporária', { exact: true }).fill(temporary);
  await page.getByLabel('Confirme a senha temporária', { exact: true }).fill(temporary);
  await screenshotFit(page, 'novo-membro');
  await page.getByRole('button', { name: 'Cadastrar membro', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}
async function screenshotFit(page: Page, name: string) {
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expectClearFields(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `local/${name}-${width}.png`,
      animations: 'disabled',
      fullPage: true,
    });
  }
}
async function selectActivities(page: Page, labels: string[] | 'sem-acessos') {
  const filters = page.locator('.history-filters');
  if ((await filters.getAttribute('open')) === null) await filters.locator('summary').click();
  if (labels === 'sem-acessos') {
    await filters.getByRole('button', { name: 'Marcar todas', exact: true }).click();
    await filters.getByLabel('Acessos e saídas', { exact: true }).uncheck();
  } else {
    await filters.getByRole('button', { name: 'Desmarcar todas', exact: true }).click();
    for (const label of labels) await filters.getByLabel(label, { exact: true }).check();
  }
  await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
}
test('super cria instituição e administrador; administrador gerencia equipe sem promover', async ({
  page,
}) => {
  test.setTimeout(120000);
  const suffix = Date.now();
  const institution = `Instituição Gestão ${suffix}`;
  const adminEmail = `admin-${suffix}@management.invalid`;
  const memberEmail = `member-${suffix}@management.invalid`;
  await login(page, 'super@web.invalid');
  await expect(page).toHaveURL(/\/administracao$/);
  await page.getByRole('link', { name: 'Nova instituição', exact: true }).click();
  await page.getByLabel('Nome da instituição', { exact: true }).fill(institution);
  await page.getByLabel('E-mail de contato', { exact: true }).fill('contato@institution.invalid');
  await screenshotFit(page, 'nova-instituicao');
  await page.getByRole('button', { name: 'Cadastrar instituição', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(institution);
  await page.getByRole('link', { name: 'Voltar às instituições', exact: true }).click();
  const edit = page.getByRole('link', { name: `Editar dados de ${institution}`, exact: true });
  await expect(edit).toBeVisible();
  expect((await edit.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await expect(page.getByText('Cadastro e equipe', { exact: true })).toHaveCount(0);
  await edit.click();
  await expect(page.getByLabel('Nome da instituição', { exact: true })).toHaveValue(institution);
  await page.getByRole('button', { name: 'Acessar instituição', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('link', { name: /Gerenciar equipe/ }).click();
  await newMember(page, 'Administrador Funcional', adminEmail, 'ADMINISTRADOR');
  await expect(
    page.getByText('O administrador também faz parte da equipe', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Histórico da pessoa', exact: true }).click();
  await expect(page.locator('.history-list')).toContainText('super@web.invalid');
  await screenshotFit(page, 'historico-equipe');
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('button', { name: /Sair da conta/ }).click();
  await login(page, adminEmail, temporary);
  await expect(page).toHaveURL(/\/nova-senha$/);
  await page.getByLabel('Senha atual', { exact: true }).fill(temporary);
  await page.getByLabel('Nova senha', { exact: true }).fill('SenhaPessoalGestor!');
  await page.getByLabel('Confirme a nova senha', { exact: true }).fill('SenhaPessoalGestor!');
  await page.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await expect(page).toHaveURL(/senha=alterada/);
  await login(page, adminEmail, 'SenhaPessoalGestor!');
  await expect(page).toHaveURL(/\/inicio$/);
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await expect(page.getByRole('link', { name: /Administrar sistema/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Gerenciar equipe/ }).click();
  await newMember(page, 'Colaborador Funcional', memberEmail, 'COLABORADOR');
  const memberUrl = page.url();
  await expect(page.getByLabel('Cargo na instituição', { exact: true })).toHaveValue(
    'Assistente social',
  );
  await screenshotFit(page, 'cadastro-equipe');
  await expect(page.locator('select[name="perfil"] option[value="ADMINISTRADOR"]')).toHaveCount(0);
  await page.locator('select[name="perfil"]').evaluate((el) => {
    const select = el as HTMLSelectElement;
    select.add(new Option('Administrador', 'ADMINISTRADOR'));
    select.value = 'ADMINISTRADOR';
  });
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Somente o Super Administrador' }),
  ).toBeVisible();
  await page.goto(memberUrl);
  await page.getByLabel('Nome completo', { exact: true }).fill('Colaborador Atualizado');
  await page.getByLabel('Criar Evolução Geral', { exact: true }).check();
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Colaborador Atualizado');
  await expect(page.getByLabel('Criar Evolução Geral', { exact: true })).toBeChecked();
  await page
    .locator('summary')
    .filter({ hasText: /^Redefinir senha$/ })
    .click();
  const reset = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Redefinir senha' }) });
  await reset.getByLabel('Senha temporária', { exact: true }).fill('OutraSenhaTemporaria!');
  await reset
    .getByLabel('Confirme a senha temporária', { exact: true })
    .fill('OutraSenhaTemporaria!');
  await reset.getByRole('checkbox').check();
  await reset.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
  await expect(reset.getByRole('status')).toContainText('Senha temporária definida');
  await page.getByText('Desativar acesso à instituição', { exact: true }).click();
  const access = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Desativar acesso à instituição' }) });
  await access
    .getByLabel('Justificativa', { exact: true })
    .fill('Fim do vínculo de trabalho para teste.');
  await access.getByRole('checkbox').check();
  await access.getByRole('button', { name: 'Confirmar desativação', exact: true }).click();
  await expect(page.locator('.page-header')).toContainText('Acesso inativo');
  await page.getByRole('link', { name: 'Voltar à equipe', exact: true }).click();
  await page.getByLabel('Situação', { exact: true }).selectOption('inativos');
  await page.getByRole('searchbox').fill('assistente');
  await expect(page.locator('.team-card')).toHaveCount(1);
  await screenshotFit(page, 'equipe');
  await page.locator('.team-card').click();
  await page.getByText('Reativar acesso à instituição', { exact: true }).click();
  await page.getByLabel('Justificativa', { exact: true }).fill('Retorno autorizado para teste.');
  await page.getByRole('checkbox', { name: /Confirmo a alteração/ }).check();
  await page.getByRole('button', { name: 'Confirmar reativação', exact: true }).click();
  await expect(page.locator('.page-header')).toContainText('Acesso ativo');
  await page.getByRole('link', { name: 'Histórico da pessoa', exact: true }).click();
  await expect(page.locator('.history-list')).toContainText('Administrador Funcional');
  await expect(page.locator('.history-list')).toContainText(
    'Fim do vínculo de trabalho para teste.',
  );
  const memberHistoryUrl = new URL(page.url());
  await selectActivities(page, 'sem-acessos');
  await expect(page).toHaveURL(/filtrar=1/);
  expect(new URL(page.url()).searchParams.getAll('tipo')).not.toContain('acessos');
  expect(new URL(page.url()).searchParams.get('membro')).toBe(
    memberHistoryUrl.searchParams.get('membro'),
  );
  await expect(page.locator('.history-list')).toContainText(
    'Fim do vínculo de trabalho para teste.',
  );
  await expect(page.locator('.history-list')).not.toContainText('Acesso à instituição');
  await selectActivities(page, ['Criação de documentos']);
  await expect(page.getByRole('heading', { name: 'Nenhuma atividade encontrada' })).toBeVisible();
  await screenshotFit(page, 'historico-filtrado');
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('membro')).toBe(
    memberHistoryUrl.searchParams.get('membro'),
  );
  await expect(page.locator('.history-filters summary')).toContainText('Todas selecionadas');
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('link', { name: /Gerenciar equipe/ }).click();
  await page.getByRole('link', { name: 'Adicionar membro', exact: true }).click();
  await expect(page.getByLabel('Vincular conta existente', { exact: true })).toHaveCount(0);
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa compartilhada');
  await page.getByLabel('E-mail de acesso', { exact: true }).fill('multi@web.invalid');
  await page.getByLabel('Cargo na instituição', { exact: true }).selectOption('Assistente social');
  await page.getByLabel('Senha temporária', { exact: true }).fill(temporary);
  await page.getByLabel('Confirme a senha temporária', { exact: true }).fill(temporary);
  await page.getByRole('button', { name: 'Cadastrar membro', exact: true }).click();
  const registrationAlert = page.locator('.management-form').getByRole('alert');
  await expect(registrationAlert).toContainText('vinculada a outra instituição');
  await expect(registrationAlert).toContainText('Entre em contato com o Super Administrador');
  await page.locator('input[name="conta"]').evaluate((el) => {
    (el as HTMLInputElement).value = 'existente';
  });
  await page.getByLabel('Senha temporária', { exact: true }).fill(temporary);
  await page.getByLabel('Confirme a senha temporária', { exact: true }).fill(temporary);
  await page.getByRole('button', { name: 'Cadastrar membro', exact: true }).click();
  await expect(registrationAlert).toContainText('Somente o Super Administrador pode vincular');
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('button', { name: /Sair da conta/ }).click();
  await login(page, 'super@web.invalid');
  await expect(page).toHaveURL(/\/administracao$/);
  await page
    .locator('form.card')
    .filter({ has: page.getByRole('heading', { name: institution, exact: true }) })
    .getByRole('button', { name: 'Acessar instituição' })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/configuracoes/equipe/novo');
  await page.getByLabel('Vincular conta existente', { exact: true }).check();
  await page.getByLabel('Nome completo', { exact: true }).fill('Pessoa compartilhada');
  await page.getByLabel('E-mail de acesso', { exact: true }).fill('multi@web.invalid');
  await page.getByLabel('Cargo na instituição', { exact: true }).selectOption('Assistente social');
  await expect(page.getByLabel('Senha temporária', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vincular à instituição', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pessoa compartilhada');
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('button', { name: /Sair da conta/ }).click();
  await login(page, adminEmail, 'SenhaPessoalGestor!');
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/configuracoes/equipe');
  await page.locator('.team-card').filter({ hasText: 'Pessoa compartilhada' }).click();
  await expect(
    page.getByText('Este usuário está vinculado a mais de uma instituição.', { exact: false }),
  ).toBeVisible();
});

test('colaborador não acessa a gestão por URL e troca de instituição invalida formulário aberto', async ({
  page,
  context,
}) => {
  await login(page, 'single@web.invalid');
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/configuracoes/equipe');
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/administracao/instituicoes/nova');
  await expect(page).toHaveURL(/\/inicio$/);
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('button', { name: /Sair da conta/ }).click();
  await login(page, 'super@web.invalid');
  await expect(page).toHaveURL(/\/administracao$/);
  await page
    .locator('form.card')
    .filter({ has: page.getByRole('heading', { name: 'Instituição de teste A', exact: true }) })
    .getByRole('button', { name: 'Acessar instituição' })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/configuracoes/equipe/novo');
  await page.getByLabel('Nome completo', { exact: true }).fill('Formulário de outra instituição');
  await page
    .getByLabel('E-mail de acesso', { exact: true })
    .fill(`changed-${Date.now()}@management.invalid`);
  await page.getByLabel('Cargo na instituição', { exact: true }).selectOption('Monitor(a)');
  await page.getByLabel('Senha temporária', { exact: true }).fill(temporary);
  await page.getByLabel('Confirme a senha temporária', { exact: true }).fill(temporary);
  const other = await context.newPage();
  await other.goto('/instituicoes');
  await other.getByRole('button', { name: /Instituição de teste B/ }).click();
  await expect(other).toHaveURL(/\/inicio$/);
  await page.getByRole('button', { name: 'Cadastrar membro', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'A instituição selecionada mudou' }),
  ).toBeVisible();
  await other.close();
});

test('histórico filtra documentos e acessos, conserva o filtro na URL e reinicia a página', async ({
  page,
}) => {
  await login(page, 'super@web.invalid');
  await expect(page).toHaveURL(/\/administracao$/);
  await page
    .locator('form.card')
    .filter({
      has: page.getByRole('heading', { name: 'Instituição de teste Visual', exact: true }),
    })
    .getByRole('button', { name: 'Acessar instituição' })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/configuracoes/historico?pagina=2');
  await selectActivities(page, ['Criação de documentos']);
  await expect(page.locator('.pagination')).toContainText('Página 1');
  await expect(page.locator('.history-card')).toHaveCount(6);
  await expect(page.locator('.history-heading h2')).toHaveText(Array(6).fill('Documento emitido'));
  await page.reload();
  await expect(page.getByLabel('Criação de documentos', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Acessos e saídas', { exact: true })).not.toBeChecked();
  await selectActivities(page, ['Criação de documentos', 'Conferência de assinaturas']);
  expect(new URL(page.url()).searchParams.getAll('tipo')).toEqual([
    'criacao-documentos',
    'assinaturas',
  ]);
  await expect(page.locator('.history-list')).toContainText('Assinatura rejeitada');
  await expect(page.locator('.history-list')).not.toContainText('Acesso à instituição');
  await selectActivities(page, ['Acessos e saídas']);
  await expect(page.locator('.history-list')).toContainText('Acesso à instituição');
  await expect(page.locator('.history-list')).not.toContainText('Documento emitido');
  await selectActivities(page, []);
  await expect(page.getByRole('heading', { name: 'Nenhuma atividade encontrada' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('filtrar')).toBe('1');
  expect(new URL(page.url()).searchParams.getAll('tipo')).toEqual([]);
  await page.reload();
  await expect(page.locator('.history-filters input:checked')).toHaveCount(0);
  await page.getByRole('link', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.locator('.history-filters summary')).toContainText('Todas selecionadas');
  await expect(page).toHaveURL(/\/configuracoes\/historico$/);
});
