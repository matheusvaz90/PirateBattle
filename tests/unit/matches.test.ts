import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getResponse } from 'msw';
import { configurationKey, isMatchPage, isMatchRecord, isRegistrationResponse, toMatchRecord } from '../../src/api/contracts.ts';
import type { MatchRecord } from '../../src/api/contracts.ts';
import { createGameConfig, DEFAULT_OPTIONS } from '../../src/game/config.ts';
import { createFixtures } from '../../src/mocks/fixtures.ts';
import { createHandlers } from '../../src/mocks/handlers.ts';
import { ScenarioController } from '../../src/mocks/scenarios.ts';
import { CONFIRMED_KEY, MockMatchStore } from '../../src/mocks/storage.ts';
import { loadPlayer } from '../../src/storage/identity.ts';
import type { StoragePort } from '../../src/storage/preferences.ts';
import { acknowledgeMatch, clearReceipts, PENDING_KEY, persistPending, readPending, readReceipts, RECEIPTS_KEY } from '../../src/storage/submissions.ts';

const player = { playerId: 'test-captain', playerName: 'Captain' };
function storage(): StoragePort {
  const items = new Map<string, string>();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => { items.set(key, value); } };
}

function record(matchId = 'match-1', score = 4): MatchRecord {
  return toMatchRecord({ matchId, score, activeDuration: 12.5, endReason: 'death', completedAt: '2026-10-01T12:00:00.000Z', configuration: createGameConfig(DEFAULT_OPTIONS) }, player);
}

function setup(wait: (milliseconds: number) => Promise<void> = async () => {}) {
  const port = storage();
  const store = new MockMatchStore(port);
  const scenarios = new ScenarioController(port);
  return { port, store, scenarios, handlers: createHandlers({ store, scenarios, player: () => player, wait }) };
}

function post(item: MatchRecord) {
  return new Request('http://pirate.test/api/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
}

test('configuration identity includes complete balance and is insensitive to property order', () => {
  const config = createGameConfig(DEFAULT_OPTIONS);
  const reordered = { ...config, player: { start: config.player.start, maxHealth: 100, radius: 40, rotationSpeed: 2.2, speed: 200 } };
  assert.equal(configurationKey(config), configurationKey(reordered));
  assert.notEqual(configurationKey(config), configurationKey({ ...config, weapons: { ...config.weapons, front: { ...config.weapons.front, damage: 26 } } }));
});

test('a local player identity is created once and survives reloading', () => {
  const port = storage();
  const first = loadPlayer(port);
  assert.equal(first.error, null);
  assert.equal(first.value.playerName, 'Captain');
  assert.deepEqual(loadPlayer(port).value, first.value);
});

test('registration is idempotent and conflicting payloads cannot overwrite a match', () => {
  const { store, port } = setup();
  const item = record();
  assert.equal(store.register(item).revision, 1);
  assert.equal(store.register(item).revision, 1);
  assert.equal(new MockMatchStore(port).read().records.length, 1);
  assert.throws(() => store.register(record('match-1', 99)), /different result/);
  assert.equal(store.read().records[0]?.score, 4);
});

test('ranking and history derive from the same records, with deterministic ties and configuration filtering', () => {
  const { store } = setup();
  store.register(record('match-b', 5));
  store.register(record('match-a', 5));
  store.register(toMatchRecord({ ...record('other-config'), configuration: createGameConfig({ ...DEFAULT_OPTIONS, sessionTime: 90, enemySpawnTime: 4 }) }, player));
  const ranking = store.page('ranking', record().configurationKey, 1, 5, []);
  const history = store.page('history', player.playerId, 1, 5, []);
  assert.deepEqual(ranking.items.map((item) => item.matchId), ['match-a', 'match-b']);
  assert.equal(history.total, 3);
  assert.equal(ranking.revision, history.revision);
});

test('multiple-page fixtures are reproducible and empty fixtures preserve real confirmed records', () => {
  const { store } = setup();
  const fixtures = createFixtures('multiple-pages', player);
  assert.deepEqual(fixtures, createFixtures('multiple-pages', player));
  assert.equal(store.page('history', player.playerId, 2, 5, fixtures).items.length, 5);
  assert.equal(store.page('history', player.playerId, 1, 5, fixtures).total, 12);
  store.register(record());
  assert.equal(store.page('ranking', record().configurationKey, 1, 5, createFixtures('empty', player)).total, 1);
});

test('multiple pending matches survive reconstruction and acknowledgement removes only its own match', () => {
  const port = storage();
  persistPending(record('first'), port);
  persistPending(record('second'), port);
  persistPending(record('first'), port);
  assert.equal(readPending(port).length, 2);
  acknowledgeMatch('first', port);
  assert.deepEqual(readPending(port).map((item) => item.matchId), ['second']);
  assert.deepEqual(readReceipts(port), ['first']);
});

test('failed confirmation persistence leaves the durable pending record intact', () => {
  const port = storage();
  persistPending(record(), port);
  const failing: StoragePort = { getItem: port.getItem, setItem: (key, value) => { if (key === RECEIPTS_KEY) throw new Error('Storage full.'); port.setItem(key, value); } };
  assert.throws(() => acknowledgeMatch('match-1', failing));
  assert.equal(readPending(port).length, 1);
});

test('mock reset preserves pending matches and identity while clearing confirmed records and receipts', () => {
  const { store, port } = setup();
  const identity = loadPlayer(port).value;
  persistPending(record('pending'), port);
  store.register(record('confirmed'));
  acknowledgeMatch('confirmed', port);
  store.reset();
  clearReceipts(port);
  assert.equal(store.read().records.length, 0);
  assert.equal(readPending(port).length, 1);
  assert.deepEqual(readReceipts(port), []);
  assert.deepEqual(loadPlayer(port).value, identity);
});

test('invalid saved queues and confirmed records are reported without deleting the raw data', () => {
  const { port, store } = setup();
  port.setItem(PENDING_KEY, 'broken');
  port.setItem(CONFIRMED_KEY, 'broken');
  assert.throws(() => readPending(port));
  assert.throws(() => store.read());
  assert.equal(port.getItem(PENDING_KEY), 'broken');
  assert.equal(port.getItem(CONFIRMED_KEY), 'broken');
});

test('transport delays are scripted and restart from the same sequence on scenario reset', () => {
  const { scenarios } = setup();
  scenarios.set('out-of-order');
  assert.equal(scenarios.next('ranking').latency, 1500);
  assert.equal(scenarios.next('ranking').latency, 40);
  scenarios.set('out-of-order');
  assert.equal(scenarios.next('ranking').latency, 1500);
  scenarios.set('history-error');
  assert.equal(scenarios.next('ranking').failure, null);
  assert.equal(scenarios.next('history').failure, 503);
});

test('shared MSW handlers register once and serve validated ranking/history pages', async () => {
  const { handlers } = setup();
  const item = record();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await getResponse(handlers, post(item));
    assert.ok(response);
    const body: unknown = await response.json();
    assert.ok(isRegistrationResponse(body));
    assert.equal(body.revision, 1);
  }
  const url = new URL('http://pirate.test/api/history');
  url.searchParams.set('playerId', player.playerId);
  const response = await getResponse(handlers, new Request(url));
  assert.ok(response);
  const body: unknown = await response.json();
  assert.ok(isMatchPage(body));
  assert.equal(body.total, 1);
  assert.equal(body.items[0]?.matchId, item.matchId);
});

test('a registration whose response is lost remains committed and recovery cannot duplicate it', async () => {
  let loseResponse = true;
  const { handlers, scenarios, store } = setup(async (latency) => {
    if (latency === 3000 && loseResponse) throw new Error('Simulated lost response.');
  });
  scenarios.set('timeout-after-commit');
  const lost = await getResponse(handlers, post(record()));
  assert.equal(lost?.status, 500);
  assert.equal(store.read().records.length, 1);
  loseResponse = false;
  scenarios.set('success');
  const recovered = await getResponse(handlers, post(record()));
  assert.equal(recovered?.status, 200);
  assert.equal(store.read().records.length, 1);
});

test('unavailability prevents committing and success recovers the same pending ID', async () => {
  const { handlers, scenarios, store, port } = setup();
  persistPending(record(), port);
  scenarios.set('unavailable');
  const failed = await getResponse(handlers, post(record()));
  assert.equal(failed?.status, 503);
  assert.equal(store.read().records.length, 0);
  assert.equal(readPending(port).length, 1);
  scenarios.set('success');
  const recovered = await getResponse(handlers, post(readPending(port)[0] ?? record()));
  assert.equal(recovered?.status, 200);
  acknowledgeMatch('match-1', port);
  assert.equal(readPending(port).length, 0);
  assert.equal(store.read().records.length, 1);
});

test('malformed API input, wrong config identity, and invalid pagination are rejected', async () => {
  assert.equal(isMatchRecord({ ...record(), configurationKey: 'wrong' }), false);
  const { handlers } = setup();
  const invalid = await getResponse(handlers, new Request('http://pirate.test/api/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(invalid?.status, 400);
  const page = await getResponse(handlers, new Request('http://pirate.test/api/history?playerId=test-captain&page=-1'));
  assert.equal(page?.status, 400);
});
