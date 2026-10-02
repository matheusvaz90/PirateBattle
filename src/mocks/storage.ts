import { isMatchRecord, sameRegistration } from '../api/contracts.ts';
import type { MatchPage, MatchRecord } from '../api/contracts.ts';
import { isRecord } from '../game/config.ts';
import type { StoragePort } from '../storage/preferences.ts';

export const CONFIRMED_KEY = 'pirate-battle.mock-matches.v1';

interface ConfirmedState { records: MatchRecord[]; revision: number }

export class MockMatchStore {
  private readonly storage: StoragePort;
  constructor(storage: StoragePort) { this.storage = storage; }

  read(): ConfirmedState {
    const raw = this.storage.getItem(CONFIRMED_KEY);
    if (raw === null) return { records: [], revision: 0 };
    const state: unknown = JSON.parse(raw);
    if (!isRecord(state) || state.version !== 1 || !Array.isArray(state.records) || !state.records.every(isMatchRecord)
      || typeof state.revision !== 'number' || !Number.isSafeInteger(state.revision) || state.revision < 0
      || new Set(state.records.map((record) => record.matchId)).size !== state.records.length) throw new Error('Confirmed mock records are invalid. Reset Demo Data to recover.');
    return { records: state.records, revision: state.revision };
  }

  register(record: MatchRecord): { record: MatchRecord; revision: number } {
    if (!isMatchRecord(record) || record.matchId.startsWith('fixture-')) throw new Error('Invalid match registration.');
    const state = this.read();
    const existing = state.records.find((item) => item.matchId === record.matchId);
    if (existing) {
      if (!sameRegistration(existing, record)) throw new Error('Match ID already belongs to a different result.');
      return { record: existing, revision: state.revision };
    }
    const revision = state.revision + 1;
    this.storage.setItem(CONFIRMED_KEY, JSON.stringify({ version: 1, revision, records: [...state.records, record] }));
    return { record, revision };
  }

  page(resource: 'ranking' | 'history', filter: string, page: number, pageSize: number, fixtures: readonly MatchRecord[]): MatchPage {
    const state = this.read();
    const records = [...fixtures, ...state.records].filter((record) => resource === 'ranking' ? record.configurationKey === filter : record.playerId === filter);
    records.sort(resource === 'ranking'
      ? (left, right) => right.score - left.score || left.completedAt.localeCompare(right.completedAt) || left.matchId.localeCompare(right.matchId)
      : (left, right) => right.completedAt.localeCompare(left.completedAt) || left.matchId.localeCompare(right.matchId));
    return { items: records.slice((page - 1) * pageSize, page * pageSize), total: records.length, page, pageSize, revision: state.revision };
  }

  reset(): void {
    let revision: number;
    try { revision = this.read().revision; } catch { revision = Date.now(); }
    this.storage.setItem(CONFIRMED_KEY, JSON.stringify({ version: 1, revision: revision + 1, records: [] }));
  }
}
