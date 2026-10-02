import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameConfig, DEFAULT_OPTIONS, FIXED_STEP } from '../../src/game/config.ts';
import { FrameClock } from '../../src/game/FrameClock.ts';
import { GameEngine } from '../../src/game/GameEngine.ts';
import { FrameStatistics, ProfileRegistry, ResourceLedger } from '../../src/game/profiling.ts';
import type { CanvasMeasurements, ProfileEnvironment } from '../../src/game/profiling.ts';

const environment: ProfileEnvironment = {
  browser: 'Synthetic Node test, not browser evidence', buildMode: 'production', optimized: true,
  viewportWidth: 1280, viewportHeight: 720, devicePixelRatio: 1,
};
const canvas: CanvasMeasurements = { width: 1280, height: 720, backingWidth: 1280, backingHeight: 720, resolution: 1, rendererType: 1, loadedTextures: 12 };

function engine(sessionTime = 120) {
  const game = new GameEngine(createGameConfig({ ...DEFAULT_OPTIONS, sessionTime }), 'profile-test', () => {}, { spawning: false });
  game.start();
  return game;
}

test('frame statistics use real elapsed intervals, nearest-rank p95, and include genuine stalls', () => {
  const statistics = new FrameStatistics();
  for (let frame = 0; frame < 90; frame += 1) statistics.record(1000 / 60);
  for (let frame = 0; frame < 10; frame += 1) statistics.record(40);
  const summary = statistics.summary();
  assert.equal(summary.frameCount, 100);
  assert.equal(summary.p95FrameMilliseconds, 40);
  assert.equal(summary.maxFrameMilliseconds, 40);
  assert.equal(summary.framesOver33Milliseconds, 10);
  assert.ok(Math.abs((summary.averageFps ?? 0) - 100000 / 1900) < 1e-7);
});

test('empty or invalid frame samples never fabricate FPS or percentiles', () => {
  const statistics = new FrameStatistics();
  statistics.record(0);
  statistics.record(-1);
  statistics.record(Infinity);
  statistics.record(Number.NaN);
  assert.equal(statistics.summary().averageFps, null);
  assert.equal(statistics.summary().p95FrameMilliseconds, null);
  statistics.record(20);
  statistics.clear();
  assert.equal(statistics.summary().frameCount, 0);
});

test('frame clock excludes initialization and the first resumed delta, including rapid pause/resume', () => {
  const clock = new FrameClock();
  assert.equal(clock.consume(5000), null);
  clock.setStatus('running');
  assert.equal(clock.consume(5000), null);
  assert.equal(clock.consume(16), 16);
  clock.setStatus('paused');
  clock.setStatus('running');
  assert.equal(clock.consume(30000), null);
  assert.equal(clock.consume(250), 250);
  clock.setStatus('finished');
  assert.equal(clock.consume(16), null);
});

test('HUD publications with unchanged status do not discard normal frame time', () => {
  const clock = new FrameClock();
  clock.setStatus('running');
  clock.consume(16);
  clock.setStatus('running');
  assert.equal(clock.consume(16), 16);
  assert.equal(clock.consume(Number.NaN), null);
  assert.equal(clock.consume(16), 16);
});

test('resumed hidden-tab time cannot advance the real engine timer or held actions', () => {
  const game = engine();
  const clock = new FrameClock();
  const unsubscribe = game.subscribe((snapshot) => clock.setStatus(snapshot.status));
  clock.consume(16);
  game.setActions(new Set(['moveForward']));
  const elapsed = clock.consume(100);
  if (elapsed !== null) game.advance(elapsed / 1000);
  game.pause();
  const paused = game.getWorld();
  game.resume();
  const stale = clock.consume(30000);
  if (stale !== null) game.advance(stale / 1000);
  assert.equal(game.getWorld().activeDuration, paused.activeDuration);
  assert.deepEqual(game.getWorld().player, paused.player);
  unsubscribe();
});

test('game-owned resource leases release exactly once and snapshots do not share counters', () => {
  const ledger = new ResourceLedger();
  const release = ledger.acquire('canvases');
  const before = ledger.snapshot();
  release();
  release();
  assert.equal(before.canvases, 1);
  assert.equal(ledger.snapshot().canvases, 0);
});

test('profiling record calls do not publish per-frame React snapshots', () => {
  const registry = new ProfileRegistry();
  const game = engine();
  const session = registry.begin('silent-recording', game.config, environment, null);
  let notifications = 0;
  const unsubscribe = registry.subscribe(() => { notifications += 1; });
  const cached = registry.getSnapshot();
  for (let frame = 0; frame < 60; frame += 1) {
    game.advance(FIXED_STEP);
    session.record(1000 / 60, game.getWorld());
  }
  assert.equal(notifications, 0);
  assert.equal(registry.getSnapshot(), cached);
  const captured = registry.capture();
  assert.equal(captured.activeFrames?.frameCount, 60);
  assert.equal(notifications, 1);
  unsubscribe();
});

test('five synthetic cleanup cycles return counters to baseline and preserve report evidence', () => {
  const registry = new ProfileRegistry();
  registry.checkpoint('Baseline', null, '2026-10-01T12:00:00.000Z');
  for (let cycle = 0; cycle < 5; cycle += 1) {
    const game = engine();
    const session = registry.begin(`cycle-${cycle}`, game.config, environment, null);
    const releases = [session.track('renderers'), session.track('canvases'), session.track('tickers'), session.track('resizeObservers'), session.track('inputControllers')];
    for (let listener = 0; listener < 4; listener += 1) releases.push(session.track('inputListeners'));
    for (let subscription = 0; subscription < 3; subscription += 1) releases.push(session.track('subscriptions'));
    session.setCanvas(canvas);
    game.advance(FIXED_STEP);
    session.record(1000 / 60, game.getWorld());
    releases.forEach((release) => { release(); release(); });
    registry.finish(session, game.getWorld(), null);
    registry.finish(session, game.getWorld(), null);
    registry.checkpoint(`After cycle ${cycle + 1}`, null, `2026-10-01T12:00:0${cycle + 1}.000Z`);
  }
  const snapshot = registry.capture();
  assert.equal(snapshot.completedRuns.length, 5);
  assert.equal(snapshot.checkpoints.length, 6);
  assert.ok(Object.values(snapshot.resources).every((count) => count === 0));
  assert.ok(snapshot.completedRuns.every((report) => report.resourcePeaks.inputListeners === 4 && report.resourcePeaks.subscriptions === 3));
  assert.ok(snapshot.completedRuns.every((report) => Object.values(report.resourcesAtExit).every((count) => count === 0)));
});

test('entity timeline records counts per active second and the peak is not lost between samples', () => {
  const registry = new ProfileRegistry();
  const game = engine();
  const session = registry.begin('entity-samples', game.config, environment, null);
  game.setActions(new Set(['fireLeft', 'fireRight']));
  for (let frame = 0; frame < 120; frame += 1) {
    game.advance(FIXED_STEP);
    session.record(1000 / 60, game.getWorld());
  }
  registry.finish(session, game.getWorld(), null);
  const report = registry.capture().completedRuns[0];
  assert.ok(report);
  assert.ok(report.timeline.length >= 2 && report.timeline.length <= 3);
  assert.ok(report.peakEntities >= 7);
  assert.ok(report.timeline.every((point) => point.totalEntities === 1 + point.enemies + point.projectiles + point.effects));
});

test('a complete three-minute marker requires finished active gameplay, raw samples, canvas, and optimized build', () => {
  const registry = new ProfileRegistry();
  const game = engine(180);
  const session = registry.begin('synthetic-full-run', game.config, environment, null);
  session.setCanvas(canvas);
  for (let frame = 0; frame < 10800; frame += 1) {
    game.advance(FIXED_STEP);
    session.record(1000 / 60, game.getWorld());
  }
  registry.finish(session, game.getWorld(), null);
  assert.equal(registry.capture().completedRuns[0]?.threeMinuteRun, true);

  const missing = registry.begin('missing-measurements', game.config, environment, null);
  registry.finish(missing, game.getWorld(), null);
  assert.equal(registry.capture().completedRuns[1]?.threeMinuteRun, false);
  const development = registry.begin('development-run', game.config, { ...environment, buildMode: 'development', optimized: false }, null);
  development.setCanvas(canvas);
  development.record(180000, game.getWorld());
  registry.finish(development, game.getWorld(), null);
  assert.equal(registry.capture().completedRuns[2]?.threeMinuteRun, false);
});
