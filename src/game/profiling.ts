import type { GameConfig, WorldSnapshot } from './types.ts';

export type ResourceKey = 'renderers' | 'canvases' | 'tickers' | 'resizeObservers' | 'inputControllers' | 'inputListeners' | 'subscriptions';
export type ResourceCounts = Readonly<Record<ResourceKey, number>>;

function emptyCounts(): Record<ResourceKey, number> {
  return { renderers: 0, canvases: 0, tickers: 0, resizeObservers: 0, inputControllers: 0, inputListeners: 0, subscriptions: 0 };
}

export interface HeapSnapshot {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

export interface ProfileEnvironment {
  readonly browser: string;
  readonly buildMode: string;
  readonly optimized: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
}

export interface CanvasMeasurements {
  readonly width: number;
  readonly height: number;
  readonly backingWidth: number;
  readonly backingHeight: number;
  readonly resolution: number;
  readonly rendererType: number;
  readonly loadedTextures: number;
}

export interface EntitySample {
  readonly activeDuration: number;
  readonly enemies: number;
  readonly projectiles: number;
  readonly effects: number;
  readonly totalEntities: number;
}

export interface FrameSummary {
  readonly frameCount: number;
  readonly observedMilliseconds: number;
  readonly averageFps: number | null;
  readonly p95FrameMilliseconds: number | null;
  readonly maxFrameMilliseconds: number | null;
  readonly framesOver33Milliseconds: number;
}

export class FrameStatistics {
  private intervals: number[] = [];
  private total = 0;
  private slowFrames = 0;

  record(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.intervals.push(milliseconds);
    this.total += milliseconds;
    if (milliseconds > 1000 / 30) this.slowFrames += 1;
  }

  summary(): FrameSummary {
    const sorted = [...this.intervals].sort((left, right) => left - right);
    return {
      frameCount: sorted.length, observedMilliseconds: this.total,
      averageFps: sorted.length > 0 ? sorted.length * 1000 / this.total : null,
      p95FrameMilliseconds: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
      maxFrameMilliseconds: sorted[sorted.length - 1] ?? null,
      framesOver33Milliseconds: this.slowFrames,
    };
  }

  clear(): void { this.intervals = []; this.total = 0; this.slowFrames = 0; }
}

export class ResourceLedger {
  private readonly counts = emptyCounts();

  acquire(resource: ResourceKey): () => void {
    this.counts[resource] += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.counts[resource] -= 1;
    };
  }

  snapshot(): ResourceCounts { return { ...this.counts }; }
}

export interface ProfileReport {
  readonly matchId: string;
  readonly configuration: GameConfig;
  readonly environment: ProfileEnvironment;
  readonly canvas: CanvasMeasurements | null;
  readonly frames: FrameSummary;
  readonly activeDuration: number;
  readonly outcome: 'timeout' | 'death' | 'abandoned';
  readonly threeMinuteRun: boolean;
  readonly peakEntities: number;
  readonly timeline: readonly EntitySample[];
  readonly resourcePeaks: ResourceCounts;
  readonly resourcesAtExit: ResourceCounts;
  readonly heapAtStart: HeapSnapshot | null;
  readonly heapAtExit: HeapSnapshot | null;
}

export interface ProfileCheckpoint {
  readonly label: string;
  readonly createdAt: string;
  readonly resources: ResourceCounts;
  readonly heap: HeapSnapshot | null;
}

export interface ProfileSnapshot {
  readonly completedRuns: readonly ProfileReport[];
  readonly activeFrames: FrameSummary | null;
  readonly resources: ResourceCounts;
  readonly checkpoints: readonly ProfileCheckpoint[];
}

export class ProfileSession {
  private readonly frames = new FrameStatistics();
  private readonly live = emptyCounts();
  private readonly peaks = emptyCounts();
  private readonly samples: EntitySample[] = [];
  private readonly configuration: GameConfig;
  private readonly environment: ProfileEnvironment;
  private readonly heapAtStart: HeapSnapshot | null;
  private readonly ledger: ResourceLedger;
  private readonly notify: () => void;
  private readonly matchId: string;
  private canvas: CanvasMeasurements | null = null;
  private peakEntities = 0;
  private ended = false;

  constructor(matchId: string, configuration: GameConfig, environment: ProfileEnvironment, heap: HeapSnapshot | null, ledger: ResourceLedger, notify: () => void) {
    this.matchId = matchId;
    this.configuration = structuredClone(configuration);
    this.environment = { ...environment };
    this.heapAtStart = heap ? { ...heap } : null;
    this.ledger = ledger;
    this.notify = notify;
  }

  track(resource: ResourceKey): () => void {
    if (this.ended) throw new Error('Cannot acquire resources for a finished profiling session.');
    const release = this.ledger.acquire(resource);
    this.live[resource] += 1;
    this.peaks[resource] = Math.max(this.peaks[resource], this.live[resource]);
    this.notify();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
      this.live[resource] -= 1;
      this.notify();
    };
  }

  setCanvas(measurements: CanvasMeasurements): void { this.canvas = { ...measurements }; }

  record(milliseconds: number, world: WorldSnapshot): void {
    if (this.ended || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
    this.frames.record(milliseconds);
    const sample = {
      activeDuration: world.activeDuration, enemies: world.enemies.length,
      projectiles: world.projectiles.length, effects: world.effects.length,
      totalEntities: 1 + world.enemies.length + world.projectiles.length + world.effects.length + Number(world.healthPickup !== null),
    };
    this.peakEntities = Math.max(this.peakEntities, sample.totalEntities);
    const previous = this.samples[this.samples.length - 1];
    if (!previous || Math.floor(previous.activeDuration) !== Math.floor(sample.activeDuration)) this.samples.push(sample);
    else this.samples[this.samples.length - 1] = sample;
  }

  frameSummary(): FrameSummary { return this.frames.summary(); }

  finish(world: WorldSnapshot, heap: HeapSnapshot | null): ProfileReport {
    if (this.ended) throw new Error('The profiling session has already finished.');
    this.ended = true;
    const frames = this.frames.summary();
    const report: ProfileReport = {
      matchId: this.matchId, configuration: this.configuration, environment: this.environment,
      canvas: this.canvas, frames, activeDuration: world.activeDuration,
      outcome: world.status === 'finished' ? world.player.health <= 0 ? 'death' : 'timeout' : 'abandoned',
      threeMinuteRun: this.environment.optimized && this.canvas !== null && this.configuration.sessionTime === 180
        && world.status === 'finished' && world.activeDuration >= 180 - 1e-8
        && frames.frameCount > 0 && frames.observedMilliseconds >= 180000 - 1,
      peakEntities: this.peakEntities, timeline: [...this.samples], resourcePeaks: { ...this.peaks }, resourcesAtExit: { ...this.live },
      heapAtStart: this.heapAtStart, heapAtExit: heap ? { ...heap } : null,
    };
    this.frames.clear();
    return report;
  }
}

export class ProfileRegistry {
  private readonly ledger = new ResourceLedger();
  private readonly reports: ProfileReport[] = [];
  private readonly checkpoints: ProfileCheckpoint[] = [];
  private readonly active = new Set<ProfileSession>();
  private readonly listeners = new Set<() => void>();
  private cached: ProfileSnapshot = { completedRuns: [], activeFrames: null, resources: emptyCounts(), checkpoints: [] };

  begin(matchId: string, config: GameConfig, environment: ProfileEnvironment, heap: HeapSnapshot | null): ProfileSession {
    const session = new ProfileSession(matchId, config, environment, heap, this.ledger, this.publish);
    this.active.add(session);
    this.publish();
    return session;
  }

  finish(session: ProfileSession, world: WorldSnapshot, heap: HeapSnapshot | null): void {
    if (!this.active.has(session)) return;
    this.reports.push(session.finish(world, heap));
    this.active.delete(session);
    this.publish();
  }

  checkpoint(label: string, heap: HeapSnapshot | null, createdAt: string): void {
    this.checkpoints.push({ label, heap: heap ? { ...heap } : null, createdAt, resources: this.ledger.snapshot() });
    this.publish();
  }

  capture(): ProfileSnapshot { this.publish(); return structuredClone(this.cached); }
  readonly getSnapshot = (): ProfileSnapshot => this.cached;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private readonly publish = (): void => {
    const session = Array.from(this.active).at(-1);
    this.cached = { completedRuns: [...this.reports], activeFrames: session?.frameSummary() ?? null, resources: this.ledger.snapshot(), checkpoints: [...this.checkpoints] };
    this.listeners.forEach((listener) => listener());
  };
}
