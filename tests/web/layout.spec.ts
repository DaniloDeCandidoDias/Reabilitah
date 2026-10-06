import { test, expect, type Page } from '@playwright/test';
import { expectClearFields } from './field-layout';

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill('visual@web.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSomenteParaTeste!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

async function fitsViewport(page: Page) {
  await expectClearFields(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  const rect = await nav.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  for (const link of await nav.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
}

for (const width of [320, 390, 768, 1440, 1920, 2560]) {
  test(`navegação e filtros cabem em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(page.getByRole('heading', { name: 'Quadro de Avisos' })).toBeVisible();
    await fitsViewport(page);
    await expect(page.getByText('Minha conta', { exact: true })).toHaveCount(0);
    const availableWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hero = (await page.locator('.dashboard-header').boundingBox())!;
    expect(hero.x).toBe(0);
    expect(hero.width).toBe(availableWidth);
    if (width >= 1024) {
      await page.locator('.dashboard-header').evaluate(async (element) => {
        await Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      const cards = await page.locator('.stat').all();
      const first = (await cards[0].boundingBox())!;
      const last = (await cards[3].boundingBox())!;
      expect(last.y).toBe(first.y);
      expect(last.width).toBeCloseTo(first.width, 0);
      expect(Math.abs(first.x - (availableWidth - last.x - last.width))).toBeLessThan(1);
    }
    if (width === 320) {
      const month = page.getByLabel('Mês dos documentos');
      const current = await month.inputValue();
      await month.fill('1900-01');
      await expect(page.locator('.month-controls strong')).toContainText('0');
      await month.fill(current);
      await expect(page.locator('.month-controls strong')).toContainText('6');
    }
    await page.screenshot({
      path: `local/inicio-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    for (const name of ['Pacientes', 'Documentos', 'Config.']) {
      await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        name === 'Config.' ? 'Configurações' : name,
      );
      await fitsViewport(page);
      const back = page.getByRole('link', { name: 'Voltar ao início', exact: true });
      await expect(back).toBeVisible();
      expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (name === 'Config.') {
        const profile = (await page.locator('.profile-card').boundingBox())!;
        for (const item of await page.locator('.settings-group, .logout-button').all()) {
          const box = (await item.boundingBox())!;
          expect(box.x).toBe(profile.x);
          expect(box.width).toBe(profile.width);
        }
        expect(profile.width).toBeGreaterThan(availableWidth * 0.85);
      }
      if (name === 'Documentos') {
        await page.getByRole('button', { name: 'Filtros', exact: true }).click();
        await expect(page.getByLabel('Status', { exact: true })).toBeVisible();
        await page.getByLabel('Status', { exact: true }).selectOption('conferencia');
        await expect(page.getByRole('status')).toHaveText('1 documento');
        await fitsViewport(page);
      }
      await page.screenshot({
        path: `local/${name === 'Config.' ? 'configuracoes' : name.toLowerCase()}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await back.click();
      await expect(page).toHaveURL(/\/inicio$/);
    }
  });
}

test('busca por apelido, filtros combinados e isolamento dos documentos', async ({ page }) => {
  await login(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Pacientes', exact: true }).click();
  const search = page.getByRole('searchbox');
  await search.fill('antonio');
  await expectClearFields(page);
  await expect(page.getByRole('status')).toHaveText('1 paciente');
  await search.fill('toninho');
  await expect(page.getByRole('status')).toHaveText('1 paciente');
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(page.getByRole('status')).toHaveText('2 pacientes');
  await page.getByRole('navigation').getByRole('link', { name: 'Documentos', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('6 documentos');
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  for (const [status, count] of [
    ['concluido', 2],
    ['conferencia', 1],
    ['reenvio', 1],
    ['assinatura', 1],
    ['desconsiderado', 1],
  ] as const) {
    await page.getByLabel('Status', { exact: true }).selectOption(status);
    await expect(page.locator('.document-card')).toHaveCount(count);
  }
  await page.getByLabel('Tipo', { exact: true }).selectOption('evolucao-geral');
  await expect(page.getByRole('heading', { name: 'Nenhum documento encontrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca e filtros', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('6 documentos');
  await page.getByRole('navigation').getByRole('link', { name: 'Config.', exact: true }).click();
  await page.getByRole('button', { name: /Sair da conta/ }).click();
  await page.getByLabel('E-mail', { exact: true }).fill('single@web.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('SenhaSomenteParaTeste!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Documentos', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('0 documentos');
  await expect(page.locator('.document-card')).toHaveCount(0);
});

test('login acessível por teclado, movimento reduzido e recursos locais', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.locator('.login-card').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await expect(page.locator('.brand')).toHaveText('Reabilitah');
  await expectClearFields(page);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('E-mail', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await expectClearFields(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const external = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => /^https?:/.test(url) && new URL(url).origin !== location.origin),
  );
  expect(external).toEqual([]);
  await page.screenshot({ path: 'local/login-320.png', fullPage: true, animations: 'disabled' });
});
