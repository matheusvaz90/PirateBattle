import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { setupServer } from 'msw/node';
import axios from 'axios';
import { createApiClient, retryQuery } from '../../src/api/client.ts';
import { toMatchRecord } from '../../src/api/contracts.ts';
import { createGameConfig, DEFAULT_OPTIONS } from '../../src/game/config.ts';
import { createHandlers } from '../../src/mocks/handlers.ts';
import { ScenarioController } from '../../src/mocks/scenarios.ts';
import { MockMatchStore } from '../../src/mocks/storage.ts';
import type { StoragePort } from '../../src/storage/preferences.ts';

test('Axios and TanStack mutations/queries use shared MSW handlers without network sockets', async () => {
  const values = new Map<string, string>();
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  const store = new MockMatchStore(storage);
  const scenarios = new ScenarioController(storage);
  const player = { playerId: 'client-player', playerName: 'Captain' };
  const server = setupServer(...createHandlers({ store, scenarios, player: () => player, wait: async () => {} }));
  server.listen({ onUnhandledFrame: 'error' });
  const client = createApiClient('http://pirate.test/api/', async () => {});
  const queries = new QueryClient({ defaultOptions: { queries: { retry: retryQuery, retryDelay: 0, gcTime: 0 } } });
  try {
    const match = toMatchRecord({ matchId: 'client-match', score: 7, activeDuration: 8, endReason: 'death', completedAt: '2026-10-01T12:00:00.000Z', configuration: createGameConfig(DEFAULT_OPTIONS) }, player);
    const mutation = queries.getMutationCache().build(queries, { mutationFn: client.register });
    const response = await mutation.execute(match);
    assert.equal(response.record.matchId, match.matchId);
    const page = await queries.fetchQuery({ queryKey: ['history', player.playerId, 1], queryFn: ({ signal }) => client.page('history', player.playerId, 1, signal) });
    assert.equal(page.total, 1);
    assert.equal(page.items[0]?.score, 7);
    const ranking = await queries.fetchQuery({ queryKey: ['ranking', match.configurationKey, 1], queryFn: ({ signal }) => client.page('ranking', match.configurationKey, 1, signal) });
    assert.equal(ranking.total, 15);
    assert.ok(ranking.items.every((item) => item.configurationKey === match.configurationKey));
    await assert.rejects(() => client.register({ ...match, score: 99 }), (error: unknown) => axios.isAxiosError<unknown>(error) && error.response?.status === 409);
    scenarios.set('http-400');
    await assert.rejects(() => client.page('ranking', match.configurationKey, 1, new AbortController().signal));
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(() => client.page('history', player.playerId, 1, cancelled.signal));
  } finally { queries.clear(); server.close(); }
});

test('a delayed old page is refetched after a newer registration revision', async () => {
  const values = new Map<string, string>();
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  const store = new MockMatchStore(storage);
  const scenarios = new ScenarioController(storage);
  const player = { playerId: 'revision-player', playerName: 'Captain' };
  let release: () => void = () => {};
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let waiting: () => void = () => {};
  const firstRequested = new Promise<void>((resolve) => { waiting = resolve; });
  let calls = 0;
  const server = setupServer(...createHandlers({ store, scenarios, player: () => player, wait: async () => {
    calls += 1;
    if (calls === 1) { waiting(); await blocked; }
  } }));
  server.listen({ onUnhandledFrame: 'error' });
  const client = createApiClient('http://pirate.test/api/', async () => {});
  try {
    const oldRead = client.page('history', player.playerId, 1, new AbortController().signal);
    await firstRequested;
    const match = toMatchRecord({ matchId: 'new-revision', score: 1, activeDuration: 5, endReason: 'death', completedAt: '2026-10-01T12:00:00.000Z', configuration: createGameConfig(DEFAULT_OPTIONS) }, player);
    await client.register(match);
    release();
    const result = await oldRead;
    assert.equal(result.revision, 1);
    assert.equal(result.total, 1);
  } finally { release(); server.close(); }
});

test('an actual Axios timeout after committing recovers without a second record', async () => {
  const values = new Map<string, string>();
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  const store = new MockMatchStore(storage);
  const scenarios = new ScenarioController(storage);
  const player = { playerId: 'timeout-player', playerName: 'Captain' };
  const server = setupServer(...createHandlers({ store, scenarios, player: () => player }));
  server.listen({ onUnhandledFrame: 'error' });
  const client = createApiClient('http://pirate.test/api/', async () => {});
  const match = toMatchRecord({ matchId: 'timed-out-match', score: 0, activeDuration: 5, endReason: 'death', completedAt: '2026-10-01T12:00:00.000Z', configuration: createGameConfig(DEFAULT_OPTIONS) }, player);
  try {
    scenarios.set('timeout-after-commit');
    await assert.rejects(() => client.register(match), (error: unknown) => axios.isAxiosError<unknown>(error) && error.code === 'ECONNABORTED');
    assert.equal(store.read().records.length, 1);
    scenarios.set('success');
    const response = await client.register(match);
    assert.equal(response.revision, 1);
    assert.equal(store.read().records.length, 1);
  } finally { server.close(); }
});
