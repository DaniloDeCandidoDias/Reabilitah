import { expect, type Page } from '@playwright/test';

export async function expectClearFields(page: Page) {
  const fields = await page.locator('.input-wrap:visible').evaluateAll((wrappers) =>
    wrappers.map((wrapper) => {
      const input = wrapper.querySelector('input')!;
      const icon = wrapper.querySelector('.input-icon')!;
      const button = wrapper.querySelector('button');
      const rect = input.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      const style = getComputedStyle(input);
      return {
        name: input.name || input.id,
        leftGap: rect.left + parseFloat(style.paddingLeft) - iconRect.right,
        iconOffset: Math.abs(iconRect.top + iconRect.height / 2 - rect.top - rect.height / 2),
        rightGap: buttonRect
          ? buttonRect.left - (rect.right - parseFloat(style.paddingRight))
          : null,
        buttonOffset: buttonRect
          ? Math.abs(buttonRect.top + buttonRect.height / 2 - rect.top - rect.height / 2)
          : null,
      };
    }),
  );
  for (const field of fields) {
    expect(field.leftGap, `Espaço entre ícone e texto: ${field.name}`).toBeGreaterThanOrEqual(8);
    expect(field.iconOffset, `Centro do ícone: ${field.name}`).toBeLessThanOrEqual(1);
    if (field.rightGap !== null)
      expect(field.rightGap, `Espaço para botão: ${field.name}`).toBeGreaterThanOrEqual(2);
    if (field.buttonOffset !== null)
      expect(field.buttonOffset, `Centro do botão: ${field.name}`).toBeLessThanOrEqual(1);
  }
}
