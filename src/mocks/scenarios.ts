import { isRecord } from '../game/config.ts';
import type { StoragePort } from '../storage/preferences.ts';

export const NETWORK_SCENARIOS = [
  ['success', 'Sucesso'], ['empty', 'Dados vazios'], ['multiple-pages', 'Várias páginas'],
  ['slow', 'Respostas lentas'], ['variable-latency', 'Latência variável'], ['out-of-order', 'Respostas fora de ordem'],
  ['timeout', 'Tempo limite da requisição'], ['connection-error', 'Falha de conexão'],
  ['http-400', 'HTTP 400'], ['http-500', 'HTTP 500'],
  ['ranking-error', 'Falha no ranking'], ['history-error', 'Falha no histórico'],
  ['timeout-after-commit', 'Tempo limite após registro'], ['unavailable', 'Indisponível até recuperação'],
] as const;

export type NetworkScenario = typeof NETWORK_SCENARIOS[number][0];
export type ApiResource = 'ranking' | 'history' | 'registration';
export const SCENARIO_KEY = 'pirate-battle.network.v1';

export function isNetworkScenario(value: unknown): value is NetworkScenario {
  return NETWORK_SCENARIOS.some(([id]) => id === value);
}

export class ScenarioController {
  private readonly counts = new Map<ApiResource, number>();
  private readonly storage: StoragePort;

  constructor(storage: StoragePort) { this.storage = storage; }

  get(): NetworkScenario {
    const raw = this.storage.getItem(SCENARIO_KEY);
    if (raw === null) return 'success';
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !isNetworkScenario(value.scenario)) throw new Error('O cenário de rede salvo é inválido. Redefina o cenário para recuperar.');
    return value.scenario;
  }

  set(scenario: NetworkScenario): void {
    this.storage.setItem(SCENARIO_KEY, JSON.stringify({ version: 1, scenario }));
    this.counts.clear();
  }

  next(resource: ApiResource): { scenario: NetworkScenario; latency: number; failure: number | 'connection' | null } {
    const scenario = this.get();
    const index = this.counts.get(resource) ?? 0;
    this.counts.set(resource, index + 1);
    let latency = 80;
    if (scenario === 'slow') latency = 1500;
    if (scenario === 'variable-latency') latency = [1200, 40, 650, 100][index % 4] ?? 100;
    if (scenario === 'out-of-order') latency = index % 2 === 0 ? 1500 : 40;
    if (scenario === 'timeout' || (scenario === 'timeout-after-commit' && resource === 'registration')) latency = 3000;
    const failure = scenario === 'connection-error' ? 'connection'
      : scenario === 'http-400' ? 400
      : scenario === 'http-500' ? 500
      : scenario === 'unavailable' || (scenario === 'ranking-error' && resource === 'ranking') || (scenario === 'history-error' && resource === 'history') ? 503 : null;
    return { scenario, latency, failure };
  }
}
