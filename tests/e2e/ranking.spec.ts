import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function scenario(page: Page, value: string) {
  const details = page.locator('details.network-panel');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  await expect(page.getByText('API simulada: pronta', { exact: true })).toBeVisible();
  await page.getByLabel('Cenário de rede', { exact: true }).selectOption(value);
  await expect(page.getByLabel('Cenário de rede', { exact: true })).toHaveValue(value);
}

test('ranking paginates and history is empty for a new player', async ({ page }) => {
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.getByRole('table', { name: 'Ranking', exact: true })).toBeVisible();
  await expect(panel.locator('tbody tr')).toHaveCount(5);
  await panel.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(panel.getByText('Página 2 de 3 · 14 registros', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  await expect(panel.getByText(/Ainda não há partidas concluídas/)).toBeVisible();
});

test('multiple-page and empty scenarios affect both tabs reproducibly', async ({ page }) => {
  await page.goto('/');
  await scenario(page, 'multiple-pages');
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.locator('tbody tr')).toHaveCount(5);
  await expect(panel.getByText('Página 1 de 3 · 12 registros', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(panel.getByText('Página 2 de 3 · 12 registros', { exact: true })).toBeVisible();
  await scenario(page, 'empty');
  await expect(panel.getByText(/Ainda não há partidas concluídas/)).toBeVisible();
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(panel.getByText(/Ainda não há pontuações para esta configuração/)).toBeVisible();
});

test('a query error can recover while gameplay remains available', async ({ page }) => {
  await page.goto('/');
  await scenario(page, 'ranking-error');
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.getByRole('alert')).toContainText('Falha simulada no ranking');
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  await expect(panel.getByText(/Ainda não há partidas concluídas/)).toBeVisible();
  await scenario(page, 'success');
  await page.getByRole('tab', { name: 'Ranking', exact: true }).click();
  await expect(panel.getByRole('table')).toBeVisible();
});

test('ranking uses the selected gameplay configuration rather than mixing scores', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Opções', exact: true }).click();
  await page.getByLabel('Duração da partida').fill('90');
  await page.getByLabel('Intervalo de surgimento dos inimigos').fill('2.5');
  await page.getByRole('button', { name: 'Salvar opções', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.getByText('Página 1 de 1 · 3 registros', { exact: true })).toBeVisible();
  await expect(panel.locator('tbody tr')).toHaveCount(3);
});

test('a delayed response cannot replace data from a newer scenario', async ({ page }) => {
  await page.goto('/');
  await scenario(page, 'out-of-order');
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await panel.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await scenario(page, 'empty');
  await expect(panel.getByText(/Ainda não há pontuações para esta configuração/)).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(panel.getByText(/Ainda não há pontuações para esta configuração/)).toBeVisible();
  await expect(panel.locator('tbody tr')).toHaveCount(0);
});

test('history errors recover independently from ranking', async ({ page }) => {
  await page.goto('/');
  await scenario(page, 'history-error');
  await page.getByRole('tab', { name: 'Histórico de partidas', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.getByRole('alert')).toContainText('Falha simulada no histórico');
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeEnabled();
  await scenario(page, 'multiple-pages');
  await expect(panel.getByRole('table', { name: 'Histórico de partidas', exact: true })).toBeVisible();
  await expect(panel.locator('tbody tr')).toHaveCount(5);
});

test('slow queries show loading and background refresh without blocking Play', async ({ page }) => {
  await page.goto('/');
  await scenario(page, 'slow');
  const panel = page.getByRole('region', { name: 'Ranking e histórico de partidas' });
  await expect(panel.getByText('Carregando ranking…', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeEnabled();
  await expect(panel.getByRole('table')).toBeVisible();
  await panel.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(panel.getByText('Atualizando em segundo plano…', { exact: true })).toBeVisible();
  await expect(panel.getByRole('table')).toBeVisible();
  await expect(panel.getByText('Atualizando em segundo plano…', { exact: true })).toHaveCount(0);
});
