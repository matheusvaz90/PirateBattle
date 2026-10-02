import { isGameConfig, isRecord } from '../game/config.ts';
import type { MatchConfiguration, MatchResult } from '../game/types.ts';
import { isMatchResult } from '../storage/preferences.ts';

export interface PlayerIdentity {
  readonly playerId: string;
  readonly playerName: string;
}

export interface MatchRecord extends MatchResult, PlayerIdentity {
  readonly configurationKey: string;
}

export interface MatchPage {
  readonly items: readonly MatchRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly revision: number;
}

export interface RegistrationResponse {
  readonly record: MatchRecord;
  readonly revision: number;
}

export const PAGE_SIZE = 5;
export const REQUEST_TIMEOUT = 2000;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item: unknown) => canonicalJson(item)).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  throw new Error('Unsupported configuration value.');
}

export function configurationKey(config: MatchConfiguration): string {
  if (!isGameConfig(config)) throw new Error('Invalid gameplay configuration.');
  return canonicalJson(config);
}

export function isPlayerIdentity(value: unknown): value is PlayerIdentity {
  return isRecord(value)
    && typeof value.playerId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value.playerId)
    && typeof value.playerName === 'string' && value.playerName.trim().length > 0 && value.playerName.length <= 40;
}

export function isMatchRecord(value: unknown): value is MatchRecord {
  if (!isMatchResult(value) || !isPlayerIdentity(value) || !isRecord(value)) return false;
  try {
    return /^[A-Za-z0-9_-]{1,100}$/.test(value.matchId)
      && Number.isSafeInteger(value.score)
      && new Date(value.completedAt).toISOString() === value.completedAt
      && (value.endReason !== 'timeout' || value.activeDuration === value.configuration.sessionTime)
      && value.configurationKey === configurationKey(value.configuration);
  } catch { return false; }
}

export function toMatchRecord(result: MatchResult, player: PlayerIdentity): MatchRecord {
  const record = { ...structuredClone(result), ...player, configurationKey: configurationKey(result.configuration) };
  if (!isMatchRecord(record)) throw new Error('Invalid match registration.');
  return record;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isMatchPage(value: unknown): value is MatchPage {
  return isRecord(value) && Array.isArray(value.items) && value.items.every(isMatchRecord)
    && isCount(value.page) && value.page > 0 && isCount(value.pageSize) && value.pageSize > 0
    && value.items.length <= value.pageSize && isCount(value.total) && value.total >= value.items.length && isCount(value.revision);
}

export function isRegistrationResponse(value: unknown): value is RegistrationResponse {
  return isRecord(value) && isMatchRecord(value.record) && isCount(value.revision);
}

export function sameRegistration(left: MatchRecord, right: MatchRecord): boolean {
  return canonicalJson(left) === canonicalJson(right);
}
