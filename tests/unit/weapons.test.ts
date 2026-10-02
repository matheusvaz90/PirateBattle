import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameConfig, DEFAULT_OPTIONS, FIXED_STEP, isGameConfig } from '../../src/game/config.ts';
import { findProjectileObstacle, segmentCircleHit } from '../../src/game/collision.ts';
import { GameEngine } from '../../src/game/GameEngine.ts';
import type { GameConfig } from '../../src/game/types.ts';

function engine(config: GameConfig = createGameConfig(DEFAULT_OPTIONS)) {
  const game = new GameEngine(config, 'weapons-test', () => {}, { spawning: false });
  game.start();
  return game;
}

function advance(game: GameEngine, seconds: number) {
  for (let remaining = seconds; remaining > 1e-8; remaining -= FIXED_STEP) {
    game.advance(Math.min(FIXED_STEP, remaining));
  }
}

test('front fire launches one projectile ahead of the ship', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  const world = game.getWorld();
  assert.equal(world.projectiles.length, 1);
  const projectile = world.projectiles[0];
  assert.ok(projectile);
  assert.equal(projectile.weapon, 'front');
  assert.equal(projectile.heading, world.player.heading);
  assert.ok(projectile.x > world.player.x + world.player.radius);
  assert.equal(projectile.y, world.player.y);
});

test('left and right broadsides launch three parallel shots from distinct origins', () => {
  const game = engine();
  game.setActions(new Set(['fireLeft', 'fireRight']));
  game.advance(FIXED_STEP);
  const world = game.getWorld();
  for (const weapon of ['left', 'right'] as const) {
    const salvo = world.projectiles.filter((projectile) => projectile.weapon === weapon);
    assert.equal(salvo.length, 3);
    assert.equal(new Set(salvo.map((projectile) => projectile.heading)).size, 1);
    assert.equal(new Set(salvo.map((projectile) => projectile.x)).size, 3);
    for (const projectile of salvo) {
      assert.equal(projectile.heading, weapon === 'left' ? -Math.PI / 2 : Math.PI / 2);
      assert.ok(weapon === 'left' ? projectile.y < world.player.y : projectile.y > world.player.y);
    }
  }
});

test('holding front fire repeats only after its cooldown', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  advance(game, 0.4);
  assert.equal(game.getWorld().projectiles.length, 1);
  advance(game, 0.05);
  assert.equal(game.getWorld().projectiles.length, 2);
});

test('firing one weapon does not consume another weapon cooldown', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set(['fireLeft']));
  game.advance(FIXED_STEP);
  assert.equal(game.getWorld().projectiles.length, 4);
  assert.equal(game.getWorld().cooldowns.right, 0);
  game.setActions(new Set(['fireRight']));
  game.advance(FIXED_STEP);
  assert.equal(game.getWorld().projectiles.length, 7);
  assert.ok(game.getWorld().cooldowns.front > 0);
  assert.ok(game.getWorld().cooldowns.left > 0);
  assert.ok(game.getWorld().cooldowns.right > 0);
});

test('movement, turning, and all three attacks can run in the same step', () => {
  const game = engine();
  game.setActions(new Set(['moveForward', 'turnRight', 'fireFront', 'fireLeft', 'fireRight']));
  game.advance(FIXED_STEP);
  const world = game.getWorld();
  assert.ok(world.player.x > 220);
  assert.ok(world.player.y > 360);
  assert.ok(world.player.heading > 0);
  assert.equal(world.projectiles.length, 7);
  const front = world.projectiles.find((projectile) => projectile.weapon === 'front');
  assert.ok(front);
  assert.equal(front.heading, world.player.heading);
});

test('existing projectiles retain their launch heading when the ship turns', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  const original = game.getWorld().projectiles[0];
  assert.ok(original);
  game.setActions(new Set(['turnRight']));
  advance(game, 0.1);
  const world = game.getWorld();
  assert.notEqual(world.player.heading, original.heading);
  assert.equal(world.projectiles[0]?.heading, original.heading);
});

test('weapon simulation is equivalent at 30, 60, and 144 FPS', () => {
  const worlds = [30, 60, 144].map((fps) => {
    const game = engine();
    game.setActions(new Set(['fireFront', 'fireLeft', 'fireRight']));
    for (let frame = 0; frame < fps / 2; frame += 1) game.advance(1 / fps);
    return game.getWorld();
  });
  assert.deepEqual(worlds[0], worlds[1]);
  assert.deepEqual(worlds[1], worlds[2]);
});

test('swept collision blocks a projectile crossing the whole island in one step', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const game = engine({ ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, speed: 60000 } } });
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  const world = game.getWorld();
  assert.equal(world.projectiles.length, 0);
  const impacts = world.effects.filter((effect) => effect.kind === 'impact');
  assert.equal(impacts.length, 1);
  assert.ok(Math.abs((impacts[0]?.x ?? 0) - 539) < 1e-8);
});

test('the earliest obstacle is used even when the island list is not distance-sorted', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const hit = findProjectileObstacle({ x: 200, y: 100 }, { x: 1200, y: 100 }, 5, {
    ...config,
    islands: [{ x: 800, y: 100, radius: 10 }, { x: 600, y: 100, radius: 10 }],
  });
  assert.ok(hit);
  assert.equal(hit.x, 585);
});

test('a muzzle beyond an island boundary cannot create a projectile behind the obstacle', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const game = engine({ ...config, player: { ...config.player, start: { x: 504, y: 360 } } });
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  const world = game.getWorld();
  assert.equal(world.projectiles.length, 0);
  assert.equal(world.effects.filter((effect) => effect.kind === 'impact').length, 1);
});

test('projectiles are removed at the arena boundary', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const game = engine({ ...config, player: { ...config.player, start: { x: 1200, y: 100 } } });
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 0.1);
  const world = game.getWorld();
  assert.equal(world.projectiles.length, 0);
  const impact = world.effects.find((effect) => effect.kind === 'impact');
  assert.ok(impact);
  assert.equal(impact.x, config.arena.width - config.weapons.front.radius);
});

test('expired projectiles cannot hit an obstacle beyond their remaining lifetime', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const game = engine({ ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, speed: 100000, lifetime: 0.001 } } });
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  assert.equal(game.getWorld().projectiles.length, 0);
  assert.equal(game.getWorld().effects.filter((effect) => effect.kind === 'impact').length, 0);
});

test('pause freezes projectiles, effects, and cooldowns and resume discards held fire', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.pause();
  const paused = game.getWorld();
  game.advance(100);
  game.setActions(new Set(['fireFront', 'fireLeft', 'fireRight']));
  assert.deepEqual(game.getWorld(), paused);
  game.resume();
  game.advance(FIXED_STEP);
  const resumed = game.getWorld();
  assert.equal(resumed.projectiles.length, 1);
  assert.equal(resumed.projectiles[0]?.id, paused.projectiles[0]?.id);
  assert.ok(resumed.cooldowns.front < paused.cooldowns.front);
  assert.equal(resumed.cooldowns.left, 0);
  assert.equal(resumed.cooldowns.right, 0);
});

test('completion freezes live shots and a new engine starts without previous entities', () => {
  const game = engine(createGameConfig({ ...DEFAULT_OPTIONS, sessionTime: 60 }));
  advance(game, 59.5);
  game.setActions(new Set(['fireLeft']));
  advance(game, 0.1);
  game.setActions(new Set());
  advance(game, 0.4);
  const finished = game.getWorld();
  assert.equal(finished.status, 'finished');
  assert.equal(finished.projectiles.length, 3);
  game.advance(1);
  assert.deepEqual(game.getWorld(), finished);
  const restarted = engine().getWorld();
  assert.equal(restarted.projectiles.length, 0);
  assert.equal(restarted.effects.length, 0);
  assert.deepEqual(restarted.cooldowns, { front: 0, left: 0, right: 0 });
});

test('effects expire and disposing releases simulation entities', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  game.setActions(new Set());
  advance(game, 1);
  assert.equal(game.getWorld().effects.length, 0);
  game.setActions(new Set(['fireLeft']));
  game.advance(FIXED_STEP);
  assert.ok(game.getWorld().projectiles.length > 0);
  game.dispose();
  assert.equal(game.getWorld().projectiles.length, 0);
  assert.equal(game.getWorld().effects.length, 0);
});

test('weapon snapshots remain unchanged when simulation advances', () => {
  const game = engine();
  game.setActions(new Set(['fireFront']));
  game.advance(FIXED_STEP);
  const original = game.getWorld();
  const recorded = structuredClone(original);
  game.advance(FIXED_STEP);
  assert.deepEqual(original, recorded);
  assert.notDeepEqual(game.getWorld().projectiles, original.projectiles);
});

test('circle segments handle tangency, initial overlap, misses, and zero movement', () => {
  assert.equal(segmentCircleHit({ x: 0, y: 2 }, { x: 20, y: 2 }, { x: 10, y: 0 }, 2), 0.5);
  assert.equal(segmentCircleHit({ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 0 }, 2), 0);
  assert.equal(segmentCircleHit({ x: 0, y: 3 }, { x: 20, y: 3 }, { x: 10, y: 0 }, 2), null);
  assert.equal(segmentCircleHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 2), null);
});

test('stored configuration rejects invalid weapon timings, salvo sizes, and feedback', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  assert.equal(isGameConfig(config), true);
  assert.equal(isGameConfig({ ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, cooldown: 0 } } }), false);
  assert.equal(isGameConfig({ ...config, weapons: { ...config.weapons, left: { ...config.weapons.left, origins: config.weapons.left.origins.slice(0, 2) } } }), false);
  assert.equal(isGameConfig({ ...config, feedback: { ...config.feedback, impactDuration: Infinity } }), false);
  assert.equal(isGameConfig({ ...config, healthPickup: { ...config.healthPickup, interval: 0 } }), false);
  assert.equal(isGameConfig({ ...config, specialAttack: { requiredKills: 0 } }), false);
});
