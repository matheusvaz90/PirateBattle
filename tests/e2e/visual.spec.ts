import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openStableMenu(page: Page, scenario: string) {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00.000Z'));
  await page.goto(`/?scenario=${scenario}`);
  await expect(page.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
  await expect(page.getByText('Atualizando em segundo plano…', { exact: true })).toHaveCount(0);
  await page.locator('.game-menu-title img').evaluate(async (element) => {
    if (!(element instanceof HTMLImageElement)) throw new Error('The menu title image is unavailable.');
    await element.decode();
  });
  await page.evaluate(async () => { await document.fonts.ready; });
}

async function startGame(page: Page) {
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.evaluate(() => {
    if (!window.__PIRATE_TEST__) throw new Error('Visual gameplay requires npm run build:test.');
    window.__PIRATE_TEST__.controlClock();
  });
}

test('menu has a stable desktop/mobile visual baseline', async ({ page }) => {
  await openStableMenu(page, 'navigation');
  await expect(page).toHaveScreenshot('menu.png', { fullPage: true });
});

test('arena shows stable ships, health bars, island, projectiles, and controls', async ({ page }) => {
  await openStableMenu(page, 'enemy-navigation');
  await startGame(page);
  await page.getByTestId('arena').focus();
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.keyboard.down('Space');
  await page.evaluate(() => {
    if (!window.__PIRATE_TEST__) throw new Error('The controlled simulation clock is unavailable.');
    window.__PIRATE_TEST__.advance(0.1);
  });
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  await page.keyboard.up('Space');
  await expect(page).toHaveScreenshot('arena.png');
});

test('result has a stable completed and registered visual baseline', async ({ page }) => {
  await openStableMenu(page, 'death-contact');
  await startGame(page);
  await page.evaluate(() => {
    if (!window.__PIRATE_TEST__) throw new Error('The controlled simulation clock is unavailable.');
    window.__PIRATE_TEST__.advance(0.5);
  });
  await expect(page.getByRole('heading', { name: 'Seu navio afundou.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Registro da partida' }).getByRole('status')).toHaveText('Partida registrada com sucesso.');
  await expect(page.locator('.pending-panel')).toHaveCount(0);
  await expect(page).toHaveScreenshot('result.png', { fullPage: true });
});
