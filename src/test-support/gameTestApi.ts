import type { GameEngine } from '../game/GameEngine.ts';
import type { GameRenderer } from '../game/GameRenderer.ts';
import type { EnemyPlacement, GameSetup, WorldSnapshot } from '../game/types.ts';

const TEST_ENEMIES: Readonly<Record<string, readonly EnemyPlacement[]>> = {
  'front-target': [{ kind: 'shooter', x: 420, y: 360 }],
  'shooter-fire': [{ kind: 'shooter', x: 480, y: 360 }],
  'chaser-contact': [{ kind: 'chaser', x: 310, y: 360 }],
  'enemy-navigation': [{ kind: 'chaser', x: 1060, y: 360 }, { kind: 'shooter', x: 1080, y: 450 }],
  'death-contact': [
    { kind: 'chaser', x: 306, y: 360 }, { kind: 'chaser', x: 220, y: 274 },
    { kind: 'chaser', x: 134, y: 360 }, { kind: 'chaser', x: 220, y: 446 },
  ],
};

export function getGameTestSetup(): GameSetup {
  const scenario = new URLSearchParams(window.location.search).get('scenario');
  if (scenario === 'navigation') return { seed: 1337, spawning: false };
  const enemies = scenario ? TEST_ENEMIES[scenario] : undefined;
  return enemies ? { seed: 1337, spawning: false, initialEnemies: enemies } : { seed: 1337 };
}

export interface GameTestApi {
  snapshot(): WorldSnapshot;
  controlClock(): void;
  advance(seconds: number): void;
}

declare global {
  interface Window {
    __PIRATE_TEST__?: GameTestApi;
  }
}

export function attachGameTestApi(engine: GameEngine, renderer: GameRenderer): () => void {
  renderer.setControlledClock(true);
  const api: GameTestApi = {
    snapshot: () => engine.getWorld(),
    controlClock: () => renderer.setControlledClock(true),
    advance: (seconds) => renderer.advanceControlled(seconds),
  };
  window.__PIRATE_TEST__ = api;
  return () => {
    if (window.__PIRATE_TEST__ === api) delete window.__PIRATE_TEST__;
  };
}
