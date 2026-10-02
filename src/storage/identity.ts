import { isPlayerIdentity } from '../api/contracts.ts';
import type { PlayerIdentity } from '../api/contracts.ts';
import { isRecord } from '../game/config.ts';
import type { StoragePort } from './preferences.ts';

export const PLAYER_KEY = 'pirate-battle.player.v1';

export function createId(): string {
  if (typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function loadPlayer(storage?: StoragePort): { value: PlayerIdentity; error: string | null } {
  const fallback = { playerId: `player-${createId()}`, playerName: 'Captain' };
  try {
    const port = storage ?? window.localStorage;
    const raw = port.getItem(PLAYER_KEY);
    if (raw !== null) {
      const saved: unknown = JSON.parse(raw);
      if (!isRecord(saved) || saved.version !== 1 || !isPlayerIdentity(saved.value)) throw new Error('Invalid saved player.');
      return { value: saved.value, error: null };
    }
    port.setItem(PLAYER_KEY, JSON.stringify({ version: 1, value: fallback }));
    return { value: fallback, error: null };
  } catch {
    return { value: fallback, error: 'Não foi possível salvar ou restaurar a identidade do jogador. É possível jogar, mas esta identidade pode não persistir após atualizar a página.' };
  }
}
