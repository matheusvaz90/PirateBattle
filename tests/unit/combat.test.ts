import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameConfig, DEFAULT_OPTIONS, FIXED_STEP } from '../../src/game/config.ts';
import { isPositionBlocked } from '../../src/game/collision.ts';
import { GameEngine } from '../../src/game/GameEngine.ts';
import { createRandom } from '../../src/game/random.ts';
import type { EnemyPlacement, GameConfig, GameSetup, MatchResult } from '../../src/game/types.ts';

function engine(initialEnemies: readonly EnemyPlacement[] = [], config: GameConfig = createGameConfig(DEFAULT_OPTIONS), setup: GameSetup = {}) {
  const results: MatchResult[] = [];
  const game = new GameEngine(config, 'combat-test', (result) => results.push(result), { seed: 1337, spawning: false, initialEnemies, ...setup });
  game.start();
  return { game, results };
}

function advance(game: GameEngine, seconds: number) {
  for (let remaining = seconds; remaining > 1e-8; remaining -= FIXED_STEP) game.advance(Math.min(FIXED_STEP, remaining));
}

test('a player cannonball applies damage exactly once and is removed', () => {
  const { game } = engine([{ kind: 'shooter', x: 420, y: 360 }]);
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 0.3);
  assert.equal(game.getWorld().enemies[0]?.health, 50);
  assert.equal(game.getWorld().projectiles.length, 0);
  advance(game, 0.5);
  assert.equal(game.getWorld().enemies[0]?.health, 50);
  assert.equal(game.getHud().score, 0);
});

test('one projectile hits only the closest live enemy, without piercing', () => {
  const { game } = engine([{ kind: 'shooter', x: 420, y: 360, health: 25 }, { kind: 'shooter', x: 510, y: 360, health: 25 }]);
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 0.35);
  assert.equal(game.getHud().score, 1);
  assert.equal(game.getWorld().enemies.length, 1);
  assert.equal(game.getWorld().enemies[0]?.health, 25);
  assert.equal(game.getWorld().projectiles.length, 0);
});

test('multiple broadside shots cannot award duplicate points for one destruction', () => {
  const { game } = engine([{ kind: 'shooter', x: 220, y: 170, health: 18 }]);
  game.setActions(new Set(['fireLeft']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 0.35);
  assert.equal(game.getHud().score, 1);
  assert.equal(game.getWorld().enemies.length, 0);
  assert.equal(game.getWorld().effects.filter((effect) => effect.kind === 'destruction').length, 1);
  advance(game, 1);
  assert.equal(game.getHud().score, 1);
});

test('a health pickup appears on simulation time, heals 20 health, and is consumed', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const compact = {
    ...config,
    arena: { width: 400, height: 300 },
    islands: [],
    player: { ...config.player, start: { x: 200, y: 150 }, radius: 300 },
    enemies: { ...config.enemies, chaser: { ...config.enemies.chaser, contactDamage: 12 } },
    healthPickup: { ...config.healthPickup, interval: 0.1, minimumDistance: 0 },
  };
  const { game } = engine([{ kind: 'chaser', x: 270, y: 150 }], compact);
  advance(game, 0.1);
  assert.equal(game.getHud().health, 88);
  assert.ok(game.getWorld().healthPickup);
  game.advance(FIXED_STEP);
  assert.equal(game.getHud().health, 100);
  assert.equal(game.getWorld().healthPickup, null);
  assert.ok(game.getWorld().effects.some((effect) => effect.kind === 'heal'));
});

test('a full-health player does not consume an active health pickup and pause freezes it', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const { game } = engine([], { ...config, healthPickup: { ...config.healthPickup, interval: 0.1, minimumDistance: 0 } });
  advance(game, 0.1);
  const pickup = game.getWorld().healthPickup;
  assert.ok(pickup);
  game.pause();
  game.advance(30);
  assert.deepEqual(game.getWorld().healthPickup, pickup);
});

test('five cannon kills charge a special attack that clears enemies and hostile shots without recharging', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const fast = {
    ...config,
    weapons: { ...config.weapons, front: { ...config.weapons.front, cooldown: FIXED_STEP, speed: 60000 } },
    enemies: { ...config.enemies, shooter: { ...config.enemies.shooter, weapon: { ...config.enemies.shooter.weapon, cooldown: FIXED_STEP } } },
  };
  const placements = Array.from({ length: 7 }, () => ({ kind: 'shooter' as const, x: 420, y: 360, health: 25 }));
  const { game } = engine(placements, fast);
  game.setActions(new Set(['fireFront']));
  advance(game, FIXED_STEP * 5);
  assert.equal(game.getHud().specialReady, true);
  assert.equal(game.getHud().specialCharge, 5);
  assert.ok(game.getWorld().projectiles.some((projectile) => projectile.faction === 'enemy'));
  game.setActions(new Set());
  game.setActions(new Set(['specialAttack']));
  game.advance(FIXED_STEP);
  assert.equal(game.getWorld().enemies.length, 0);
  assert.equal(game.getWorld().projectiles.some((projectile) => projectile.faction === 'enemy'), false);
  assert.equal(game.getHud().score, 7);
  assert.equal(game.getHud().specialCharge, 0);
  assert.equal(game.getHud().specialReady, false);
});

test('an empty arena does not consume a ready special attack', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const fast = { ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, cooldown: FIXED_STEP, speed: 60000 } } };
  const placements = Array.from({ length: 5 }, () => ({ kind: 'shooter' as const, x: 420, y: 360, health: 25 }));
  const { game } = engine(placements, fast);
  game.setActions(new Set(['fireFront']));
  advance(game, FIXED_STEP * 5);
  game.setActions(new Set());
  game.setActions(new Set(['specialAttack']));
  game.advance(FIXED_STEP);
  assert.equal(game.getHud().specialCharge, 5);
  assert.equal(game.getHud().specialReady, true);
});

test('disabled survival features neither spawn pickups nor accumulate special charge', () => {
  const config = createGameConfig({ ...DEFAULT_OPTIONS, healthPickupsEnabled: false, specialAttackEnabled: false });
  const fast = { ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, speed: 60000 } } };
  const { game } = engine([{ kind: 'shooter', x: 420, y: 360, health: 25 }], fast);
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 20);
  assert.equal(game.getHud().score, 1);
  assert.equal(game.getHud().specialCharge, 0);
  assert.equal(game.getWorld().healthPickup, null);
});

test('an island shields an enemy from a shot beyond it', () => {
  const { game } = engine([{ kind: 'shooter', x: 820, y: 360 }]);
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 0.6);
  assert.equal(game.getWorld().enemies[0]?.health, 75);
  assert.equal(game.getWorld().projectiles.length, 0);
  assert.equal(game.getHud().score, 0);
});

test('a killed Shooter cannot fire later in the same simulation step', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const fast = { ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, speed: 60000 } }, enemies: { ...config.enemies, shooter: { ...config.enemies.shooter, weapon: { ...config.enemies.shooter.weapon, cooldown: FIXED_STEP } } } };
  const { game } = engine([{ kind: 'shooter', x: 420, y: 360, health: 25 }], fast);
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  assert.equal(game.getWorld().enemies.length, 0);
  assert.equal(game.getWorld().projectiles.filter((projectile) => projectile.faction === 'enemy').length, 0);
  assert.equal(game.getHud().health, 100);
  assert.equal(game.getHud().score, 1);
});

test('destroying a Chaser before contact prevents contact damage', () => {
  const { game } = engine([{ kind: 'chaser', x: 295, y: 360, health: 25 }]);
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  assert.equal(game.getWorld().enemies.length, 0);
  assert.equal(game.getHud().health, 100);
  assert.equal(game.getHud().score, 1);
});

test('Chaser impact applies contact damage once and destroys itself without points', () => {
  const { game } = engine([{ kind: 'chaser', x: 310, y: 360 }]);
  advance(game, 0.2);
  assert.equal(game.getWorld().enemies.length, 0);
  assert.equal(game.getHud().health, 75);
  assert.equal(game.getHud().score, 0);
  assert.ok(game.getWorld().effects.some((effect) => effect.kind === 'destruction'));
  advance(game, 0.5);
  assert.equal(game.getHud().health, 75);
});

test('Shooter fires in range after cooldown and its projectile damages the player', () => {
  const { game } = engine([{ kind: 'shooter', x: 480, y: 360 }]);
  advance(game, 1.5);
  assert.equal(game.getWorld().projectiles.length, 0);
  advance(game, 0.2);
  assert.equal(game.getWorld().projectiles.filter((projectile) => projectile.faction === 'enemy').length, 1);
  advance(game, 0.6);
  assert.equal(game.getHud().health, 88);
  assert.equal(game.getWorld().enemies[0]?.health, 75);
  assert.equal(game.getWorld().projectiles.length, 0);
});

test('enemy shots ignore other enemies and player shots do not hurt the player', () => {
  const { game } = engine([{ kind: 'shooter', x: 480, y: 360 }, { kind: 'shooter', x: 350, y: 360 }]);
  advance(game, 2.4);
  assert.equal(game.getHud().health, 76);
  assert.ok(game.getWorld().enemies.every((enemy) => enemy.health === enemy.maxHealth));
  const friendly = engine().game;
  friendly.setActions(new Set(['fireLeft', 'fireRight']));
  advance(friendly, 0.5);
  assert.equal(friendly.getHud().health, 100);
});

test('Shooter approaches outside attack range and turns at its configured angular speed', () => {
  const { game } = engine([{ kind: 'shooter', x: 1100, y: 120, heading: 0 }]);
  const original = game.getWorld().enemies[0];
  assert.ok(original);
  game.advance(FIXED_STEP);
  const turning = game.getWorld().enemies[0];
  assert.ok(turning);
  assert.ok(Math.abs(turning.heading - original.heading) <= game.config.enemies.shooter.rotationSpeed * FIXED_STEP + 1e-8);
  advance(game, 2);
  const approaching = game.getWorld().enemies[0];
  assert.ok(approaching);
  assert.ok(Math.hypot(approaching.x - 220, approaching.y - 360) < Math.hypot(original.x - 220, original.y - 360));
  assert.equal(game.getWorld().projectiles.length, 0);
});

test('both enemy types route around the island without penetrating it or getting stuck', () => {
  for (const kind of ['chaser', 'shooter'] as const) {
    const { game } = engine([{ kind, x: 1060, y: 360 }]);
    let passedIsland = false;
    for (let frame = 0; frame < 60 * 14; frame += 1) {
      game.advance(FIXED_STEP);
      for (const enemy of game.getWorld().enemies) {
        assert.equal(isPositionBlocked(enemy, enemy.radius, game.config), false);
        if (enemy.x < 510) passedIsland = true;
      }
    }
    assert.ok(passedIsland, `${kind} did not reach the player's side of the island.`);
  }
});

test('the mixed browser navigation fixture reaches the player side while keeping the player alive', () => {
  const { game } = engine([{ kind: 'chaser', x: 1060, y: 360 }, { kind: 'shooter', x: 1080, y: 450 }]);
  const passed = new Set<string>();
  for (let frame = 0; frame < 60 * 12; frame += 1) {
    game.advance(FIXED_STEP);
    for (const enemy of game.getWorld().enemies) {
      assert.equal(isPositionBlocked(enemy, enemy.radius, game.config), false);
      if (enemy.x < 510) passed.add(enemy.kind);
    }
  }
  assert.ok(passed.has('chaser'));
  assert.ok(passed.has('shooter'));
  assert.equal(game.getWorld().status, 'running');
});

test('spawns occur at the configured interval and use both enemy types', () => {
  const { game } = engine([], createGameConfig(DEFAULT_OPTIONS), { spawning: true });
  advance(game, 3.9);
  assert.equal(game.getWorld().spawnCount, 0);
  advance(game, 0.1);
  assert.equal(game.getWorld().spawnCount, 1);
  assert.equal(game.getWorld().enemies[0]?.kind, 'chaser');
  advance(game, 4);
  assert.equal(game.getWorld().spawnCount, 2);
  assert.ok(game.getWorld().enemies.some((enemy) => enemy.kind === 'shooter'));
});

test('spawn candidates stay free of islands, arena edges, other enemies, and immediate player contact', () => {
  const config = createGameConfig({ ...DEFAULT_OPTIONS, enemySpawnTime: 1 });
  const { game } = engine([], { ...config, player: { ...config.player, maxHealth: 10000 } }, { spawning: true });
  const seen = new Set<number>();
  for (let frame = 0; frame < 60 * 20; frame += 1) {
    game.advance(FIXED_STEP);
    const world = game.getWorld();
    for (const enemy of world.enemies) {
      if (seen.has(enemy.id)) continue;
      seen.add(enemy.id);
      assert.equal(isPositionBlocked(enemy, enemy.radius, config), false);
      assert.ok(Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y) >= config.spawn.minimumDistance);
      assert.ok(world.enemies.every((other) => other.id === enemy.id || Math.hypot(enemy.x - other.x, enemy.y - other.y) >= enemy.radius + other.radius + config.spawn.separation));
    }
  }
  assert.ok(seen.size >= 15);
});

test('an impossible spawn is postponed rather than placed next to the player', () => {
  const config = createGameConfig({ ...DEFAULT_OPTIONS, enemySpawnTime: 1 });
  const { game } = engine([], { ...config, spawn: { ...config.spawn, minimumDistance: 10000 } }, { spawning: true });
  advance(game, 5);
  assert.equal(game.getWorld().spawnCount, 0);
  assert.equal(game.getWorld().enemies.length, 0);
  assert.ok(game.getWorld().spawnRemaining <= config.spawn.retryDelay + 1e-8);
});

test('seeded spawns and combat match across frame rates', () => {
  const worlds = [30, 60, 144].map((fps) => {
    const { game } = engine([], createGameConfig(DEFAULT_OPTIONS), { spawning: true });
    game.setActions(new Set(['moveForward', 'turnRight', 'fireFront']));
    for (let frame = 0; frame < fps * 10; frame += 1) game.advance(1 / fps);
    return game.getWorld();
  });
  assert.deepEqual(worlds[0], worlds[1]);
  assert.deepEqual(worlds[1], worlds[2]);
});

test('pause freezes enemy movement, attacks, damage feedback, and spawn time', () => {
  const { game } = engine([{ kind: 'shooter', x: 480, y: 360 }], createGameConfig(DEFAULT_OPTIONS), { spawning: true });
  advance(game, 1.7);
  game.pause();
  const paused = game.getWorld();
  game.advance(120);
  assert.deepEqual(game.getWorld(), paused);
  game.resume();
  advance(game, 0.1);
  assert.equal(game.getWorld().spawnCount, paused.spawnCount);
  assert.ok(game.getWorld().spawnRemaining < paused.spawnRemaining);
});

test('death emits one result with actual active duration and freezes all simulation', () => {
  const { game, results } = engine([
    { kind: 'chaser', x: 306, y: 360 }, { kind: 'chaser', x: 220, y: 274 },
    { kind: 'chaser', x: 134, y: 360 }, { kind: 'chaser', x: 220, y: 446 },
  ], createGameConfig(DEFAULT_OPTIONS), { spawning: true });
  advance(game, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.endReason, 'death');
  assert.ok((results[0]?.activeDuration ?? 0) > 0 && (results[0]?.activeDuration ?? 1) < 1);
  assert.equal(game.getHud().health, 0);
  assert.equal(game.getHud().score, 0);
  const finished = game.getWorld();
  game.setActions(new Set(['moveForward', 'fireFront']));
  game.advance(180);
  game.resume();
  assert.deepEqual(game.getWorld(), finished);
});

test('death takes precedence when lethal contact and timeout occur in the same step', () => {
  const config = createGameConfig({ ...DEFAULT_OPTIONS, sessionTime: 60 });
  const { game, results } = engine([{ kind: 'chaser', x: 474, y: 360 }], {
    ...config, player: { ...config.player, maxHealth: 25 },
    enemies: { ...config.enemies, chaser: { ...config.enemies.chaser, speed: 3 } },
  });
  advance(game, 60);
  assert.equal(results[0]?.endReason, 'death');
  assert.ok(Math.abs((results[0]?.activeDuration ?? 0) - 60) < 1e-7);
});

test('timeout does not create a spawn at the match end and restart resets score and enemies', () => {
  const config = createGameConfig({ ...DEFAULT_OPTIONS, sessionTime: 60, enemySpawnTime: 1 });
  const { game, results } = engine([], { ...config, player: { ...config.player, maxHealth: 100000 } }, { spawning: true });
  advance(game, 60);
  assert.equal(results[0]?.endReason, 'timeout');
  assert.equal(game.getWorld().spawnCount, 59);
  const finished = game.getWorld();
  game.advance(10);
  assert.deepEqual(game.getWorld(), finished);
  game.dispose();
  assert.equal(game.getWorld().enemies.length, 0);
  const restarted = engine().game;
  assert.equal(restarted.getWorld().spawnCount, 0);
  assert.equal(restarted.getHud().health, 100);
  assert.equal(restarted.getHud().score, 0);
});

test('seed generation is repeatable and invalid initial fixtures are rejected', () => {
  const first = createRandom(123);
  const second = createRandom(123);
  for (let index = 0; index < 100; index += 1) {
    const value = first();
    assert.equal(value, second());
    assert.ok(value >= 0 && value < 1);
  }
  assert.throws(() => createRandom(-1));
  assert.throws(() => engine([{ kind: 'chaser', x: 640, y: 360 }]));
  assert.throws(() => engine([{ kind: 'shooter', x: 420, y: 360, health: 1000 }]));
});
