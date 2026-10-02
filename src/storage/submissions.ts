import { isMatchRecord, sameRegistration } from '../api/contracts.ts';
import type { MatchRecord } from '../api/contracts.ts';
import { isRecord } from '../game/config.ts';
import type { StoragePort } from './preferences.ts';

export const PENDING_KEY = 'pirate-battle.pending.v1';
export const RECEIPTS_KEY = 'pirate-battle.receipts.v1';

export function readPending(storage?: StoragePort): MatchRecord[] {
  const raw = (storage ?? window.localStorage).getItem(PENDING_KEY);
  if (raw === null) return [];
  const saved: unknown = JSON.parse(raw);
  if (!isRecord(saved) || saved.version !== 1 || !Array.isArray(saved.records) || !saved.records.every(isMatchRecord)) throw new Error('Não foi possível restaurar os envios pendentes. O armazenamento existente foi preservado.');
  if (new Set(saved.records.map((record) => record.matchId)).size !== saved.records.length) throw new Error('Os envios pendentes contêm identificadores duplicados.');
  return saved.records;
}

export function readReceipts(storage?: StoragePort): string[] {
  const raw = (storage ?? window.localStorage).getItem(RECEIPTS_KEY);
  if (raw === null) return [];
  const saved: unknown = JSON.parse(raw);
  if (!isRecord(saved) || saved.version !== 1 || !Array.isArray(saved.ids)
    || !saved.ids.every((id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id))) throw new Error('Não foi possível restaurar os comprovantes de registro salvos.');
  return saved.ids;
}

export function persistPending(record: MatchRecord, storage?: StoragePort): void {
  if (!isMatchRecord(record)) throw new Error('Partida pendente inválida.');
  const port = storage ?? window.localStorage;
  const pending = readPending(port);
  const existing = pending.find((item) => item.matchId === record.matchId);
  if (existing && !sameRegistration(existing, record)) throw new Error('Outro resultado pendente já usa o identificador desta partida.');
  if (!existing) port.setItem(PENDING_KEY, JSON.stringify({ version: 1, records: [...pending, record] }));
}

export function acknowledgeMatch(matchId: string, storage?: StoragePort): void {
  const port = storage ?? window.localStorage;
  const receipts = readReceipts(port);
  port.setItem(RECEIPTS_KEY, JSON.stringify({ version: 1, ids: Array.from(new Set([...receipts, matchId])) }));
  const remaining = readPending(port).filter((record) => record.matchId !== matchId);
  port.setItem(PENDING_KEY, JSON.stringify({ version: 1, records: remaining }));
}

export function clearReceipts(storage?: StoragePort): void {
  (storage ?? window.localStorage).setItem(RECEIPTS_KEY, JSON.stringify({ version: 1, ids: [] }));
}
