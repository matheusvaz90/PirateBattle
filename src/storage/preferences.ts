import { DEFAULT_OPTIONS, isGameConfig, isGameOptions, isRecord } from '../game/config.ts';
import type { GameOptions, MatchResult } from '../game/types.ts';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ReadResult<T> {
  readonly value: T;
  readonly error: string | null;
}

export const OPTIONS_KEY = 'pirate-battle.options.v1';
export const RESULT_KEY = 'pirate-battle.last-result.v1';

export function loadOptions(storage?: StoragePort): ReadResult<GameOptions> {
  try {
    const raw = (storage ?? window.localStorage).getItem(OPTIONS_KEY);
    if (raw === null) return { value: { ...DEFAULT_OPTIONS }, error: null };
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || !isRecord(saved.value)) {
      return { value: { ...DEFAULT_OPTIONS }, error: 'As opções salvas eram inválidas. As opções padrão estão sendo usadas.' };
    }
    if (saved.version === 1) {
      const migrated = { ...saved.value, healthPickupsEnabled: true, specialAttackEnabled: true };
      if (!isGameOptions(migrated)) return { value: { ...DEFAULT_OPTIONS }, error: 'As opções salvas eram inválidas. As opções padrão estão sendo usadas.' };
      return { value: migrated, error: null };
    }
    if (saved.version !== 2 || !isGameOptions(saved.value)) {
      return { value: { ...DEFAULT_OPTIONS }, error: 'As opções salvas eram inválidas. As opções padrão estão sendo usadas.' };
    }
    return { value: { ...saved.value }, error: null };
  } catch {
    return { value: { ...DEFAULT_OPTIONS }, error: 'Não foi possível carregar as opções salvas. As opções padrão estão sendo usadas.' };
  }
}

export function saveOptions(options: GameOptions, storage?: StoragePort): string | null {
  if (!isGameOptions(options)) return 'As opções estão fora dos limites permitidos.';
  try {
    (storage ?? window.localStorage).setItem(OPTIONS_KEY, JSON.stringify({ version: 2, value: options }));
    return null;
  } catch {
    return 'Não foi possível salvar as opções. Verifique se o armazenamento do navegador está disponível.';
  }
}

export function loadLastResult(storage?: StoragePort): ReadResult<MatchResult | null> {
  try {
    const raw = (storage ?? window.localStorage).getItem(RESULT_KEY);
    if (raw === null) return { value: null, error: null };
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || saved.version !== 1 || !isMatchResult(saved.value)) {
      return { value: null, error: 'O resultado salvo é inválido ou pertence a uma versão anterior e não pôde ser restaurado.' };
    }
    return { value: saved.value, error: null };
  } catch {
    return { value: null, error: 'Não foi possível carregar o último resultado do armazenamento do navegador.' };
  }
}

export function saveLastResult(result: MatchResult, storage?: StoragePort): string | null {
  if (!isMatchResult(result)) return 'O resultado é inválido e não pôde ser salvo.';
  try {
    (storage ?? window.localStorage).setItem(RESULT_KEY, JSON.stringify({ version: 1, value: result }));
    return null;
  } catch {
    return 'Não foi possível salvar o resultado localmente. Ele ainda está disponível nesta sessão.';
  }
}

export function isMatchResult(value: unknown): value is MatchResult {
  return isRecord(value)
    && typeof value.matchId === 'string' && value.matchId.length > 0
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))
    && typeof value.score === 'number' && Number.isInteger(value.score) && value.score >= 0
    && typeof value.activeDuration === 'number' && Number.isFinite(value.activeDuration) && value.activeDuration > 0
    && (value.endReason === 'timeout' || value.endReason === 'death')
    && isGameConfig(value.configuration)
    && value.activeDuration <= value.configuration.sessionTime;
}
