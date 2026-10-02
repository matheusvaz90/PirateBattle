import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameConfig, DEFAULT_OPTIONS, FIXED_STEP } from '../../src/game/config.ts';
import { GameEngine } from '../../src/game/GameEngine.ts';
import type { GameAction, GameEvent, MatchResult } from '../../src/game/types.ts';

function engine(actions: readonly GameAction[] = []) {
  const game = new GameEngine(createGameConfig(DEFAULT_OPTIONS), 'test-match', () => {}, { spawning: false });
  game.start();
  game.setActions(new Set(actions));
  return game;
}

test('typed game events describe status and one weapon action without visual coupling', () => {
  const game = new GameEngine(createGameConfig(DEFAULT_OPTIONS), 'event-test', () => {}, { spawning: false });
  const events: GameEvent[] = [];
  game.subscribeEvents((event) => events.push(event));
  game.start();
  game.setActions(new Set(['fireLeft']));
  game.advance(FIXED_STEP);
  game.pause();
  game.resume();
  assert.deepEqual(events.filter((event) => event.type === 'statusChanged').map((event) => event.status), ['running', 'paused', 'running']);
  assert.deepEqual(events.filter((event) => event.type === 'weaponFired'), [{ type: 'weaponFired', weapon: 'left', faction: 'player' }]);
});

test('equal active time produces equivalent movement at 30, 60, and 144 FPS', () => {
  const worlds = [30, 60, 144].map((fps) => {
    const game = engine(['moveForward', 'turnRight']);
    for (let frame = 0; frame < fps * 2; frame += 1) game.advance(1 / fps);
    return game.getWorld();
  });
  const first = worlds[0];
  assert.ok(first);
  for (const world of worlds) {
    assert.ok(Math.abs(world.player.x - first.player.x) < 1e-7);
    assert.ok(Math.abs(world.player.y - first.player.y) < 1e-7);
    assert.ok(Math.abs(world.player.heading - first.player.heading) < 1e-7);
    assert.ok(Math.abs(world.activeDuration - 2) < 1e-7);
  }
});

test('forward movement stops before entering the island collider', () => {
  const game = engine(['moveForward']);
  for (let frame = 0; frame < 240; frame += 1) game.advance(FIXED_STEP);
  const { player } = game.getWorld();
  const island = game.config.islands[0];
  assert.ok(island);
  assert.ok(player.x > 490);
  assert.ok(Math.hypot(player.x - island.x, player.y - island.y) >= island.radius + player.radius);
});

test('movement cannot leave the visible arena', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const game = new GameEngine({ ...config, islands: [], player: { ...config.player, start: { x: 1200, y: 100 } } }, 'edge-test', () => {});
  game.start();
  game.setActions(new Set(['moveForward']));
  for (let frame = 0; frame < 120; frame += 1) game.advance(FIXED_STEP);
  assert.equal(game.getWorld().player.x, config.arena.width - config.player.radius);
});

test('navigation target turns and moves the ship until input is released', () => {
  const game = engine();
  const before = game.getWorld().player;
  game.setNavigationTarget({ x: before.x + 300, y: before.y + 180 });
  game.advance(0.5);
  const moving = game.getWorld().player;
  assert.ok(moving.x > before.x);
  assert.ok(moving.y > before.y);
  assert.ok(moving.heading > before.heading);
  game.setNavigationTarget(null);
  game.advance(0.5);
  assert.deepEqual(game.getWorld().player, moving);
});

test('pause clears navigation target and resume cannot replay it', () => {
  const game = engine();
  game.setNavigationTarget({ x: 500, y: 500 });
  game.advance(0.1);
  game.pause();
  const paused = game.getWorld().player;
  game.resume();
  game.advance(0.5);
  assert.deepEqual(game.getWorld().player, paused);
});

test('pause freezes movement and time and resume clears held actions', () => {
  const game = engine(['moveForward', 'turnRight']);
  game.advance(0.1);
  game.pause();
  const paused = game.getWorld();
  game.advance(100);
  game.setActions(new Set(['moveForward']));
  assert.deepEqual(game.getWorld(), paused);
  game.resume();
  game.advance(0.1);
  assert.deepEqual(game.getWorld().player, paused.player);
  assert.ok(game.getWorld().activeDuration > paused.activeDuration);
});

test('partial accumulated time before pause is not carried into resume', () => {
  const game = engine(['moveForward']);
  game.advance(FIXED_STEP / 2);
  game.pause();
  game.resume();
  game.advance(FIXED_STEP / 2);
  assert.equal(game.getWorld().activeDuration, 0);
});

test('timeout completes once and freezes subsequent simulation', () => {
  const results: MatchResult[] = [];
  const game = new GameEngine(createGameConfig({ ...DEFAULT_OPTIONS, sessionTime: 60 }), 'final-test', (result) => results.push(result), { spawning: false });
  game.start();
  for (let frame = 0; frame < 60 * 60 + 10; frame += 1) game.advance(FIXED_STEP);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.activeDuration, 60);
  assert.equal(results[0]?.endReason, 'timeout');
  assert.equal(game.getHud().remainingSeconds, 0);
  const finished = game.getWorld();
  game.setActions(new Set(['moveForward']));
  game.resume();
  game.advance(1);
  assert.deepEqual(game.getWorld(), finished);
});

test('abandonment never produces a completed result', () => {
  let completions = 0;
  const game = new GameEngine(createGameConfig(DEFAULT_OPTIONS), 'abandoned-test', () => { completions += 1; });
  game.start();
  game.abandon();
  game.advance(180);
  assert.equal(game.getWorld().status, 'abandoned');
  assert.equal(completions, 0);
});

test('configuration and observer snapshots do not share mutable state with callers', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const game = new GameEngine(config, 'snapshot-test', () => {});
  assert.notEqual(game.config, config);
  assert.notEqual(game.config.player, config.player);
  assert.notEqual(game.config.islands, config.islands);
  const first = game.getWorld();
  game.start();
  game.setActions(new Set(['moveForward']));
  game.advance(0.1);
  assert.equal(first.player.x, 220);
  assert.ok(game.getWorld().player.x > first.player.x);
});

test('HUD subscribers are not notified for every movement frame', () => {
  const game = engine(['moveForward']);
  let calls = 0;
  const unsubscribe = game.subscribe(() => { calls += 1; });
  for (let frame = 0; frame < 30; frame += 1) game.advance(FIXED_STEP);
  assert.equal(calls, 1);
  for (let frame = 0; frame < 30; frame += 1) game.advance(FIXED_STEP);
  assert.equal(calls, 2);
  unsubscribe();
  game.pause();
  assert.equal(calls, 2);
});

test('invalid elapsed time is ignored and catch-up is bounded', () => {
  const game = engine();
  game.advance(Number.NaN);
  game.advance(Infinity);
  game.advance(-1);
  assert.equal(game.getWorld().activeDuration, 0);
  game.advance(10);
  assert.ok(Math.abs(game.getWorld().activeDuration - 0.25) < 1e-8);
});
