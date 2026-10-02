import { expect, test } from '@playwright/test';

test('options validate input and persist after refresh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Opções', exact: true }).click();
  await page.getByLabel('Duração da partida').fill('20');
  await page.getByRole('button', { name: 'Salvar opções' }).click();
  await expect(page.getByRole('alert')).toContainText('60 a 180');
  await page.getByLabel('Duração da partida').fill('90');
  await page.getByLabel('Intervalo de surgimento dos inimigos').fill('2.5');
  await page.getByRole('button', { name: 'Salvar opções' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Opções', exact: true }).click();
  await expect(page.getByLabel('Duração da partida')).toHaveValue('90');
  await expect(page.getByLabel('Intervalo de surgimento dos inimigos')).toHaveValue('2.5');
  await expect(page.getByRole('checkbox', { name: 'Corações de vida' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Ataque especial' })).toBeChecked();
});

test('entering and abandoning sessions does not duplicate canvases', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.getByRole('button', { name: 'Jogar', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Menu principal', exact: true }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Ver último resultado' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('failed textures expose a retry action and recover', async ({ page }) => {
  const asset = '**/assets/png/default/ships/ship_5.png';
  await page.route(asset, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar a arena');
  await page.unroute(asset);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
});
