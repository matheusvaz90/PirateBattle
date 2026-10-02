import { setupWorker } from 'msw/browser';
import { loadPlayer } from '../storage/identity.ts';
import type { StoragePort } from '../storage/preferences.ts';
import { createHandlers } from './handlers.ts';
import { ScenarioController } from './scenarios.ts';
import type { NetworkScenario } from './scenarios.ts';
import { MockMatchStore } from './storage.ts';

const storage: StoragePort = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const scenarios = new ScenarioController(storage);
const store = new MockMatchStore(storage);
const worker = setupWorker(...createHandlers({ store, scenarios, player: () => loadPlayer(storage).value }));
let startup: Promise<void> | null = null;

export function startApiMocks(): Promise<void> {
  startup ??= worker.start({ quiet: true, serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` }, onUnhandledFrame: 'bypass' }).then(() => {}).catch(() => {
    startup = null;
    throw new Error('Não foi possível iniciar a API simulada. Tente configurar a API novamente ou use HTTPS / localhost. Ainda é possível jogar.');
  });
  return startup;
}

export function setMockScenario(scenario: NetworkScenario): void { scenarios.set(scenario); }
export function getMockScenario(): NetworkScenario { return scenarios.get(); }
export function resetMockData(): void { store.reset(); scenarios.set('success'); }
