import { isRecord } from '../game/config.ts';
import { ProfileRegistry } from '../game/profiling.ts';
import type { HeapSnapshot, ProfileSnapshot } from '../game/profiling.ts';
import type { GameConfig } from '../game/types.ts';

export const profilingEnabled = typeof window !== 'undefined'
  && import.meta.env?.MODE !== 'test'
  && new URLSearchParams(window.location.search).get('profile') === '1';

export const profileRegistry = new ProfileRegistry();

export function readHeap(): HeapSnapshot | null {
  try {
    if (!('memory' in performance) || !isRecord(performance.memory)) return null;
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
    if ([usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
      && typeof usedJSHeapSize === 'number' && typeof totalJSHeapSize === 'number' && typeof jsHeapSizeLimit === 'number') {
      return { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit };
    }
  } catch { return null; }
  return null;
}

export function beginProfile(matchId: string, configuration: GameConfig) {
  if (!profilingEnabled) return null;
  return profileRegistry.begin(matchId, configuration, {
    browser: navigator.userAgent, buildMode: import.meta.env.MODE,
    optimized: import.meta.env.PROD && import.meta.env.MODE === 'production',
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio,
  }, readHeap());
}

interface ProfileEvidence {
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly hardwareReference: string;
  readonly targetFps: number;
  readonly measurements: ProfileSnapshot;
  readonly heapAtExport: HeapSnapshot | null;
}

function snapshotEvidence(hardwareReference: string): ProfileEvidence {
  return {
    schemaVersion: 1, exportedAt: new Date().toISOString(), hardwareReference,
    targetFps: 60, measurements: profileRegistry.capture(), heapAtExport: readHeap(),
  };
}

export function downloadProfile(hardwareReference: string): void {
  const evidence = snapshotEvidence(hardwareReference.trim());
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pirate-battle-profile-${evidence.exportedAt.replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

declare global {
  interface Window {
    __PIRATE_PROFILE__?: { snapshot(): ProfileEvidence };
  }
}

if (profilingEnabled) window.__PIRATE_PROFILE__ = { snapshot: () => snapshotEvidence('Not provided through console snapshot') };
