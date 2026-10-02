import { createContext, useContext } from 'react';
import type { MatchRecord, PlayerIdentity } from './contracts.ts';
import type { MatchResult } from '../game/types.ts';
import type { NetworkScenario } from '../mocks/scenarios.ts';

export interface PendingEntry {
  readonly record: MatchRecord;
  readonly sending: boolean;
  readonly durable: boolean;
  readonly error: string | null;
}

export interface DataState {
  readonly player: PlayerIdentity;
  readonly pending: readonly PendingEntry[];
  readonly receipts: readonly string[];
  readonly scenario: NetworkScenario;
  readonly network: 'starting' | 'ready' | 'error';
  readonly networkError: string | null;
  readonly warning: string | null;
}

interface DataContextValue extends DataState {
  enqueue(result: MatchResult): void;
  retry(matchId: string): void;
  retryAll(): void;
  setScenario(scenario: NetworkScenario): Promise<void>;
  resetDemoData(): Promise<void>;
  retrySetup(): void;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('The data provider is missing.');
  return context;
}
