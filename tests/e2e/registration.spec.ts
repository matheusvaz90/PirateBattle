import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { isRecord } from '../../src/game/config.ts';
import { isMatchResult } from '../../src/storage/preferences.ts';

async function setScenario(page: Page, value: string) {
  const details = page.locator('details.network-panel');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await expect(page.getByText('API simulada: pronta', { exact: true })).toBeVisible();
  await page.getByLabel('Cenário de rede', { exact: true }).selectOption(value);
  await expect(page.getByLabel('Cenário de rede', { exact: true })).toHaveValue(value);
}

async function finishMatch(page: Page, button = 'Jogar') {
  await page.getByRole('button', { name: button, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    if (!window.__PIRATE_TEST__) throw new Error('Use the dedicated test build for registration flows.');
    window.__PIRATE_TEST__.advance(0.5);
  });
  await expect(page.getByRole('heading', { name: 'Seu navio afundou.' })).toBeVisible();
}

async function matchId(page: Page): Promise<string> {
  const raw = await page.evaluate(() => localStorage.getItem('pirate-battle.last-result.v1'));
  if (!raw) throw new Error('The result was not persisted.');
  const saved: unknown = JSON.parse(raw);
  if (!isRecord(saved) || !isMatchResult(saved.value)) throw new Error('The persisted result is invalid.');
  return saved.value.matchId;
}

test('a completed match updates history and ranking with the same match ID', async ({ page }) => {
  await page.goto('/?scenario=death-contact');
  await setScenario(page, 'success');
  await finishMatch(page);
  await expect(page.getByRole('region', { name: 'Registro da partida' }).getByRole('status')).toContainText('Partida registrada');
  const id = await matchId(page);
  await page.getByRole('button', { name: 'Menu principal', exact: true }).click();
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.locator(`tr[data-match-id="${id}"]`)).toHaveCount(1);
  await expect(panel.getByText('Página 1 de 1 · 1 registros', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(panel.getByRole('table')).toBeVisible();
  for (let pageIndex = 0; pageIndex < 2; pageIndex += 1) {
    await expect(panel.getByRole('button', { name: 'Próxima', exact: true })).toBeEnabled();
    await panel.getByRole('button', { name: 'Próxima', exact: true }).click();
    await expect(panel.getByText(`Página ${pageIndex + 2} de 3 · 15 registros`, { exact: true })).toBeVisible();
  }
  await expect(panel.locator(`tr[data-match-id="${id}"]`)).toHaveCount(1);
});

test('timeout after commit survives refresh and retry does not duplicate the result', async ({ page }) => {
  await page.goto('/?scenario=death-contact');
  await setScenario(page, 'timeout-after-commit');
  await finishMatch(page);
  const status = page.getByRole('region', { name: 'Registro da partida' });
  await expect(status.getByRole('status')).toHaveText('Registro pendente.');
  const id = await matchId(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Último resultado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu navio afundou.' })).toBeVisible();
  await expect(status.getByRole('status')).toHaveText('Registro pendente.');
  await setScenario(page, 'success');
  await expect(status.getByRole('button', { name: 'Tentar registro novamente' })).toBeEnabled();
  await status.getByRole('button', { name: 'Tentar registro novamente' }).dblclick();
  await expect(status.getByRole('status')).toContainText('Partida registrada');
  await page.getByRole('button', { name: 'Menu principal', exact: true }).click();
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.locator(`tr[data-match-id="${id}"]`)).toHaveCount(1);
  await expect(panel.getByText('Página 1 de 1 · 1 registros', { exact: true })).toBeVisible();
});

test('new games remain available with multiple pending matches and recovery registers each once', async ({ page }) => {
  await page.goto('/?scenario=death-contact');
  await setScenario(page, 'unavailable');
  await finishMatch(page);
  await expect(page.getByRole('region', { name: 'Registro da partida' }).getByRole('status')).toHaveText('Registro pendente.');
  await finishMatch(page, 'Jogar novamente');
  await expect(page.getByRole('region', { name: 'Registro da partida' }).getByRole('status')).toHaveText('Registro pendente.');
  await expect(page.locator('.pending-panel li')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
  await expect(page.locator('.pending-panel li')).toHaveCount(2);
  await setScenario(page, 'success');
  await page.getByRole('button', { name: 'Tentar todas novamente', exact: true }).click();
  await expect(page.locator('.pending-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu principal', exact: true }).click();
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.locator('tbody tr')).toHaveCount(2);
  await expect(panel.getByText('Página 1 de 1 · 2 registros', { exact: true })).toBeVisible();
});
