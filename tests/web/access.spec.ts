import { test, expect } from '@playwright/test';
const password = 'SenhaSomenteParaTeste!';
async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
test('acesso sem autenticacao e login invalido', async ({ page }) => {
  await page.goto('/inicio');
  await expect(page).toHaveURL('http://localhost:3001/');
  await page.getByLabel('E-mail', { exact: true }).fill('missing@web.invalid');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' }),
  ).toHaveText('E-mail ou senha incorretos.');
  await page.goto('/');
  await page.screenshot({
    path: 'local/login-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'local/login-mobile.png', fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('vinculo unico entra direto, logout invalida sessao', async ({ page }) => {
  await login(page, 'single@web.invalid');
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByText('Instituição de teste A', { exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === 'reabilitah_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  await expect(page.locator('.stat strong').first()).toHaveText('0');
  await page.screenshot({
    path: 'local/inicio-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('link', { name: /Alterar minha senha/ }).click();
  await expect(page).toHaveURL(/\/nova-senha$/);
  await page.getByRole('link', { name: 'Voltar às configurações' }).click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await page.goto('/nova-senha');
  await page.getByRole('link', { name: 'Voltar às configurações' }).click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await page.getByRole('button', { name: /Sair da conta/ }).click();
  await expect(page).toHaveURL('http://localhost:3001/');
  await page.goto('/pacientes');
  await expect(page).toHaveURL('http://localhost:3001/');
});
test('multiplos vinculos pedem escolha e permitem trocar', async ({ page }) => {
  await login(page, 'multi@web.invalid');
  await expect(page).toHaveURL(/\/instituicoes$/);
  await page.getByRole('button', { name: 'Voltar ao login' }).click();
  await expect(page).toHaveURL('http://localhost:3001/');
  await login(page, 'multi@web.invalid');
  await page.getByRole('button', { name: /Instituição de teste B/ }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByText('Instituição de teste B', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('link', { name: /Trocar instituição/ }).click();
  await page.getByRole('link', { name: 'Voltar às configurações' }).click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.locator('.profile-card')).toContainText('Instituição de teste B');
  await page.getByRole('link', { name: /Trocar instituição/ }).click();
  await page.getByRole('button', { name: /Instituição de teste A/ }).click();
  await expect(page.getByText('Instituição de teste A', { exact: true })).toBeVisible();
});
test('super administrador recebe area propria', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page, 'super@web.invalid');
  await expect(page).toHaveURL(/\/administracao$/);
  await expect(page.getByRole('heading', { name: 'Instituições do sistema' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar às configurações' })).toHaveCount(0);
  await page
    .locator('form.card')
    .filter({ has: page.getByRole('heading', { name: 'Instituição de teste A', exact: true }) })
    .getByRole('button', { name: 'Acessar instituição' })
    .click();
  await page.getByRole('link', { name: 'Config.', exact: true }).click();
  const profile = (await page.locator('.profile-card').boundingBox())!;
  for (const row of await page.locator('.settings-group, .logout-button').all()) {
    const box = (await row.boundingBox())!;
    expect(box.x).toBe(profile.x);
    expect(box.width).toBe(profile.width);
  }
  await page.screenshot({ path: 'local/configuracoes-admin-1920.png', animations: 'disabled' });
  await page.getByRole('link', { name: /Administrar sistema/ }).click();
  await expect(page).toHaveURL(/\/administracao$/);
  await page.getByRole('link', { name: 'Voltar às configurações' }).click();
  await expect(page).toHaveURL(/\/configuracoes$/);
});
test('primeiro acesso exige senha pessoal e revoga acesso anterior', async ({ page }) => {
  await login(page, 'first@web.invalid');
  await expect(page).toHaveURL(/\/nova-senha$/);
  await expect(page.getByRole('link', { name: 'Voltar às configurações' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voltar ao login' }).click();
  await expect(page).toHaveURL('http://localhost:3001/');
  await page.goto('/inicio');
  await expect(page).toHaveURL('http://localhost:3001/');
  await login(page, 'first@web.invalid');
  await expect(page).toHaveURL(/\/nova-senha$/);
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/nova-senha$/);
  await page.getByLabel('Senha atual', { exact: true }).fill(password);
  await page.getByLabel('Nova senha', { exact: true }).fill('SenhaPessoalTeste2026!');
  await page.getByLabel('Confirme a nova senha', { exact: true }).fill('SenhaPessoalTeste2026!');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page).toHaveURL(/senha=alterada/);
  await expect(page.getByRole('status')).toContainText('Senha alterada');
  await page.getByLabel('E-mail', { exact: true }).fill('first@web.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaPessoalTeste2026!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
});
