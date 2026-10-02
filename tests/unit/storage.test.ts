import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameConfig, DEFAULT_OPTIONS, isGameOptions } from '../../src/game/config.ts';
import { loadLastResult, loadOptions, OPTIONS_KEY, RESULT_KEY, saveLastResult, saveOptions } from '../../src/storage/preferences.ts';
import type { StoragePort } from '../../src/storage/preferences.ts';
import type { MatchResult } from '../../src/game/types.ts';

function memoryStorage(): StoragePort {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

test('options enforce documented limits and finite values', () => {
  assert.equal(isGameOptions({ ...DEFAULT_OPTIONS, sessionTime: 60, enemySpawnTime: 1 }), true);
  assert.equal(isGameOptions({ ...DEFAULT_OPTIONS, sessionTime: 180, enemySpawnTime: 10 }), true);
  assert.equal(isGameOptions({ sessionTime: 59, enemySpawnTime: 4 }), false);
  assert.equal(isGameOptions({ sessionTime: 60.5, enemySpawnTime: 4 }), false);
  assert.equal(isGameOptions({ sessionTime: 120, enemySpawnTime: 0 }), false);
  assert.equal(isGameOptions({ sessionTime: 120, enemySpawnTime: Infinity }), false);
  assert.equal(isGameOptions({ sessionTime: '120', enemySpawnTime: 4 }), false);
});

test('saved options round-trip through versioned storage', () => {
  const storage = memoryStorage();
  const options = { ...DEFAULT_OPTIONS, sessionTime: 90, enemySpawnTime: 2.5 };
  assert.equal(saveOptions(options, storage), null);
  assert.deepEqual(loadOptions(storage), { value: options, error: null });
});

test('legacy options enable the approved survival features during migration', () => {
  const storage = memoryStorage();
  storage.setItem(OPTIONS_KEY, JSON.stringify({ version: 1, value: { sessionTime: 90, enemySpawnTime: 2.5 } }));
  assert.deepEqual(loadOptions(storage), {
    value: { sessionTime: 90, enemySpawnTime: 2.5, healthPickupsEnabled: true, specialAttackEnabled: true },
    error: null,
  });
});

test('invalid and malformed storage falls back with an explicit error', () => {
  const storage = memoryStorage();
  storage.setItem(OPTIONS_KEY, '{broken');
  assert.deepEqual(loadOptions(storage).value, DEFAULT_OPTIONS);
  assert.ok(loadOptions(storage).error);
  storage.setItem(OPTIONS_KEY, JSON.stringify({ version: 1, value: { sessionTime: 1, enemySpawnTime: -10 } }));
  assert.deepEqual(loadOptions(storage).value, DEFAULT_OPTIONS);
  assert.ok(loadOptions(storage).error);
});

test('storage failures do not silently report a successful save', () => {
  const storage: StoragePort = {
    getItem: () => { throw new Error('Storage unavailable.'); },
    setItem: () => { throw new Error('Storage unavailable.'); },
  };
  assert.ok(saveOptions(DEFAULT_OPTIONS, storage));
  assert.ok(loadOptions(storage).error);
  assert.ok(loadLastResult(storage).error);
});

test('completed result persists its configuration and stable identity', () => {
  const storage = memoryStorage();
  const result: MatchResult = {
    matchId: 'completed-test', completedAt: '2026-10-01T12:00:00.000Z',
    score: 0, activeDuration: 120, endReason: 'timeout',
    configuration: createGameConfig(DEFAULT_OPTIONS),
  };
  assert.equal(saveLastResult(result, storage), null);
  assert.deepEqual(loadLastResult(storage), { value: result, error: null });
});

test('combat-v1 results remain readable after the survival balance update', () => {
  const storage = memoryStorage();
  const current = createGameConfig(DEFAULT_OPTIONS);
  const result: MatchResult = {
    matchId: 'combat-v1-result', completedAt: '2026-10-01T12:00:00.000Z',
    score: 3, activeDuration: 120, endReason: 'timeout',
    configuration: {
      balanceVersion: 'combat-v1', sessionTime: current.sessionTime, enemySpawnTime: current.enemySpawnTime,
      arena: current.arena, islands: current.islands, player: current.player, weapons: current.weapons,
      enemies: current.enemies, spawn: current.spawn, navigation: current.navigation, feedback: current.feedback,
    },
  };
  assert.equal(saveLastResult(result, storage), null);
  assert.deepEqual(loadLastResult(storage), { value: result, error: null });
});

test('unsupported result versions and invalid records are rejected', () => {
  const storage = memoryStorage();
  storage.setItem(RESULT_KEY, JSON.stringify({ version: 99, value: {} }));
  assert.equal(loadLastResult(storage).value, null);
  assert.ok(loadLastResult(storage).error);
  storage.setItem(RESULT_KEY, JSON.stringify({ version: 1, value: { matchId: 'bad', score: -1 } }));
  assert.equal(loadLastResult(storage).value, null);
  assert.ok(loadLastResult(storage).error);
});

test('navigation-only results are rejected explicitly without changing stored options or deleting data', () => {
  const storage = memoryStorage();
  const options = { ...DEFAULT_OPTIONS, sessionTime: 90, enemySpawnTime: 2 };
  saveOptions(options, storage);
  const legacy = JSON.stringify({
    version: 1,
    value: {
      matchId: 'navigation-result', completedAt: '2026-10-01T12:00:00.000Z',
      score: 0, activeDuration: 90, endReason: 'timeout',
      configuration: { ...createGameConfig(options), balanceVersion: 'navigation-v1', weapons: undefined, feedback: undefined },
    },
  });
  storage.setItem(RESULT_KEY, legacy);
  const restored = loadLastResult(storage);
  assert.equal(restored.value, null);
  assert.match(restored.error ?? '', /versão anterior/);
  assert.deepEqual(loadOptions(storage).value, options);
  assert.equal(storage.getItem(RESULT_KEY), legacy);
});

test('death results persist the actual active duration and earned score', () => {
  const storage = memoryStorage();
  const result: MatchResult = {
    matchId: 'death-result', completedAt: '2026-10-01T12:00:00.000Z',
    score: 3, activeDuration: 12.5, endReason: 'death',
    configuration: createGameConfig(DEFAULT_OPTIONS),
  };
  assert.equal(saveLastResult(result, storage), null);
  assert.deepEqual(loadLastResult(storage), { value: result, error: null });
});
