import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function startControlledGame(page: Page, scenario = 'navigation') {
  await page.goto(`/?scenario=${scenario}`);
  await page.getByRole('button', { name: 'Jogar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    if (!window.__PIRATE_TEST__) throw new Error('Use npm run build:test for controlled gameplay tests.');
    window.__PIRATE_TEST__.controlClock();
  });
  await page.getByTestId('arena').focus();
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    if (!window.__PIRATE_TEST__) throw new Error('The test observer is unavailable.');
    return window.__PIRATE_TEST__.snapshot();
  });
}

async function advance(page: Page, seconds: number) {
  await page.evaluate((duration) => {
    if (!window.__PIRATE_TEST__) throw new Error('The controlled clock is unavailable.');
    window.__PIRATE_TEST__.advance(duration);
  }, seconds);
}

test('real keyboard movement reaches the island without penetrating it', async ({ page }) => {
  await startControlledGame(page);
  const before = await snapshot(page);
  await page.keyboard.down('w');
  await advance(page, 2);
  await page.keyboard.up('w');
  const after = await snapshot(page);
  expect(after.player.x).toBeGreaterThan(before.player.x + 200);
  expect(Math.hypot(after.player.x - 640, after.player.y - 360)).toBeGreaterThanOrEqual(96 + after.player.radius);
});

test('rotation and forward input work together', async ({ page }) => {
  await startControlledGame(page);
  const before = await snapshot(page);
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await advance(page, 0.5);
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  const after = await snapshot(page);
  expect(after.player.heading).toBeGreaterThan(before.player.heading);
  expect(after.player.y).toBeGreaterThan(before.player.y);
  expect(after.player.x).toBeGreaterThan(before.player.x);
});

test('pause freezes the clock and explicit resume does not replay held input', async ({ page }) => {
  await startControlledGame(page);
  await page.keyboard.down('w');
  await advance(page, 0.5);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = await snapshot(page);
  await advance(page, 10);
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await advance(page, 0.5);
  const after = await snapshot(page);
  expect(after.player).toEqual(before.player);
  await page.keyboard.up('w');
});

test('focus loss pauses and requires an explicit resume', async ({ page }) => {
  await startControlledGame(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog')).toBeVisible();
  await advance(page, 10);
  expect((await snapshot(page)).status).toBe('paused');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  expect((await snapshot(page)).status).toBe('running');
});

test('refresh opens the menu while the persisted timeout result can restart a clean ship', async ({ page }) => {
  await startControlledGame(page);
  await advance(page, 120);
  await expect(page.getByRole('heading', { name: 'De volta ao porto.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Último resultado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'De volta ao porto.' })).toBeVisible();
  await page.getByRole('button', { name: 'Jogar novamente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
  const restarted = await snapshot(page);
  expect(restarted.player.x).toBe(220);
  expect(restarted.player.y).toBe(360);
  expect(restarted.player.heading).toBe(0);
  expect(restarted.activeDuration).toBeLessThan(1);
  expect(restarted.projectiles).toEqual([]);
  expect(restarted.effects).toEqual([]);
  expect(restarted.cooldowns).toEqual({ front: 0, left: 0, right: 0 });
});

test('mouse steers the ship while forward input controls movement', async ({ page }) => {
  await startControlledGame(page);
  const arena = await page.getByTestId('arena').boundingBox();
  if (!arena) throw new Error('The arena is not visible.');
  const before = await snapshot(page);
  await page.mouse.move(arena.x + arena.width * 0.75, arena.y + arena.height * 0.7);
  await advance(page, 0.5);
  const steered = await snapshot(page);
  expect(steered.player.x).toBe(before.player.x);
  expect(steered.player.y).toBe(before.player.y);
  expect(steered.player.heading).not.toBe(before.player.heading);
  await page.keyboard.down('w');
  await advance(page, 0.5);
  await page.keyboard.up('w');
  const moved = await snapshot(page);
  expect(Math.hypot(moved.player.x - steered.player.x, moved.player.y - steered.player.y)).toBeGreaterThan(0);
  await advance(page, 0.5);
  const stopped = await snapshot(page);
  expect(stopped.player.x).toBe(moved.player.x);
  expect(stopped.player.y).toBe(moved.player.y);
});

test('front fire uses real input and repeats only after its cooldown', async ({ page }) => {
  await startControlledGame(page);
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  expect((await snapshot(page)).projectiles).toHaveLength(1);
  await advance(page, 0.4);
  expect((await snapshot(page)).projectiles).toHaveLength(1);
  await advance(page, 0.05);
  expect((await snapshot(page)).projectiles).toHaveLength(2);
  await page.keyboard.up('Space');
});

test('left and right keyboard commands create independent parallel broadsides', async ({ page }) => {
  await startControlledGame(page);
  await page.keyboard.down('q');
  await page.keyboard.down('e');
  await advance(page, 1 / 60);
  await page.keyboard.up('q');
  await page.keyboard.up('e');
  const world = await snapshot(page);
  for (const weapon of ['left', 'right'] as const) {
    const salvo = world.projectiles.filter((projectile) => projectile.weapon === weapon);
    expect(salvo).toHaveLength(3);
    expect(new Set(salvo.map((projectile) => projectile.heading)).size).toBe(1);
    expect(new Set(salvo.map((projectile) => projectile.x)).size).toBe(3);
  }
});

test('forward movement and turning continue while firing', async ({ page }) => {
  await startControlledGame(page);
  const before = await snapshot(page);
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.keyboard.down('Space');
  await advance(page, 0.5);
  await page.keyboard.up('w');
  await page.keyboard.up('d');
  await page.keyboard.up('Space');
  const after = await snapshot(page);
  expect(after.player.x).toBeGreaterThan(before.player.x);
  expect(after.player.heading).toBeGreaterThan(before.player.heading);
  expect(after.projectiles.length).toBeGreaterThan(0);
});

test('a cannonball stops at the island and produces impact feedback', async ({ page }) => {
  await startControlledGame(page);
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  await page.keyboard.up('Space');
  await advance(page, 0.6);
  const world = await snapshot(page);
  expect(world.projectiles).toHaveLength(0);
  expect(world.effects.some((effect) => effect.kind === 'impact')).toBe(true);
});

test('paused shots and weapon cooldowns remain frozen and do not replay old fire', async ({ page }) => {
  await startControlledGame(page);
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const paused = await snapshot(page);
  await advance(page, 10);
  expect(await snapshot(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await advance(page, 1 / 60);
  const resumed = await snapshot(page);
  expect(resumed.projectiles).toHaveLength(1);
  expect(resumed.projectiles[0]?.id).toBe(paused.projectiles[0]?.id);
  expect(resumed.cooldowns.front).toBeLessThan(paused.cooldowns.front);
  await page.keyboard.down('Space');
  await advance(page, 0.5);
  expect((await snapshot(page)).projectiles).toHaveLength(0);
  await page.keyboard.up('Space');
  await page.keyboard.down('Space');
  await advance(page, 1 / 60);
  expect((await snapshot(page)).projectiles).toHaveLength(1);
  await page.keyboard.up('Space');
});

test('two touch pointers can move and fire together and release clears movement', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile-'), 'Touch controls are presented on coarse pointers.');
  await startControlledGame(page);
  const arena = await page.getByTestId('arena').boundingBox();
  const fire = await page.getByRole('button', { name: 'Atirar à frente', exact: true }).boundingBox();
  if (!arena || !fire) throw new Error('The touch controls are not visible.');
  const before = await snapshot(page);
  const session = await context.newCDPSession(page);
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: arena.x + arena.width * 0.75, y: arena.y + arena.height * 0.6 },
        { id: 2, x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 },
      ],
    });
    await advance(page, 0.1);
    const moved = await snapshot(page);
    expect(moved.player.x).toBeGreaterThan(before.player.x);
    expect(moved.projectiles.length).toBeGreaterThan(0);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await advance(page, 0.1);
    expect((await snapshot(page)).player).toEqual(moved.player);
  } finally {
    await session.detach();
  }
});

test('real front attacks damage and destroy an enemy for exactly one point', async ({ page }) => {
  await startControlledGame(page, 'front-target');
  await page.keyboard.down('Space');
  await advance(page, 0.35);
  let world = await snapshot(page);
  expect(world.enemies[0]?.health).toBe(50);
  expect(world.score).toBe(0);
  await advance(page, 0.85);
  await page.keyboard.up('Space');
  world = await snapshot(page);
  expect(world.enemies).toHaveLength(0);
  expect(world.score).toBe(1);
  expect(world.effects.some((effect) => effect.kind === 'destruction')).toBe(true);
  await expect(page.getByTestId('score')).toHaveText('1');
  await advance(page, 1);
  expect((await snapshot(page)).score).toBe(1);
});

test('Chaser approaches and self-destructs on contact without awarding points', async ({ page }) => {
  await startControlledGame(page, 'chaser-contact');
  const original = (await snapshot(page)).enemies[0];
  expect(original?.kind).toBe('chaser');
  await advance(page, 0.05);
  const approaching = (await snapshot(page)).enemies[0];
  expect(approaching?.x).toBeLessThan(original?.x ?? 0);
  await advance(page, 0.2);
  const world = await snapshot(page);
  expect(world.enemies).toHaveLength(0);
  expect(world.player.health).toBe(75);
  expect(world.score).toBe(0);
  await expect(page.getByTestId('ship-health')).toHaveText('75 / 100');
});

test('Shooter respects its cooldown and its shot damages the player', async ({ page }) => {
  await startControlledGame(page, 'shooter-fire');
  await advance(page, 1.5);
  expect((await snapshot(page)).projectiles).toHaveLength(0);
  await advance(page, 0.2);
  expect((await snapshot(page)).projectiles.filter((projectile) => projectile.faction === 'enemy')).toHaveLength(1);
  await advance(page, 0.6);
  const world = await snapshot(page);
  expect(world.player.health).toBe(88);
  expect(world.enemies[0]?.health).toBe(75);
  await expect(page.getByTestId('ship-health')).toHaveText('88 / 100');
});

test('default spawns follow the interval and produce both enemy types', async ({ page }) => {
  await startControlledGame(page, 'standard');
  await advance(page, 3.9);
  expect((await snapshot(page)).spawnCount).toBe(0);
  await advance(page, 0.1);
  let world = await snapshot(page);
  expect(world.spawnCount).toBe(1);
  const chaser = world.enemies[0];
  expect(chaser?.kind).toBe('chaser');
  expect(Math.hypot((chaser?.x ?? 0) - world.player.x, (chaser?.y ?? 0) - world.player.y)).toBeGreaterThanOrEqual(320);
  await page.keyboard.press('Escape');
  const paused = await snapshot(page);
  await advance(page, 20);
  expect(await snapshot(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await advance(page, 4);
  world = await snapshot(page);
  expect(world.spawnCount).toBe(2);
  expect(world.enemies.some((enemy) => enemy.kind === 'shooter')).toBe(true);
});

test('both enemy types move around the island without crossing it', async ({ page }) => {
  await startControlledGame(page, 'enemy-navigation');
  const passed = new Set<string>();
  for (let interval = 0; interval < 60; interval += 1) {
    await advance(page, 0.2);
    const world = await snapshot(page);
    for (const enemy of world.enemies) {
      expect(Math.hypot(enemy.x - 640, enemy.y - 360)).toBeGreaterThanOrEqual(96 + enemy.radius);
      if (enemy.x < 510) passed.add(enemy.kind);
    }
  }
  expect(passed.has('chaser')).toBe(true);
  expect(passed.has('shooter')).toBe(true);
});

test('death persists while refresh opens the menu and Play Again resets health and score', async ({ page }) => {
  await startControlledGame(page, 'death-contact');
  await advance(page, 0.5);
  await expect(page.getByRole('heading', { name: 'Seu navio afundou.' })).toBeVisible();
  await expect(page.getByText('Navio destruído', { exact: true })).toBeVisible();
  const result = await page.evaluate(() => {
    const raw = window.localStorage.getItem('pirate-battle.last-result.v1');
    if (!raw) throw new Error('A completed result was not saved.');
    return raw;
  });
  expect(result).toContain('"endReason":"death"');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jogar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Último resultado', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seu navio afundou.' })).toBeVisible();
  await page.getByRole('button', { name: 'Jogar novamente', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Atirar à frente', exact: true })).toBeEnabled();
  const fresh = await snapshot(page);
  expect(fresh.player.health).toBe(100);
  expect(fresh.score).toBe(0);
  expect(fresh.activeDuration).toBe(0);
  expect(fresh.projectiles).toEqual([]);
  expect(fresh.spawnCount).toBe(0);
});
