import assert from 'node:assert/strict';
import { test } from 'node:test';
import { soundCuesForEvent } from '../../src/audio/AudioController.ts';

test('audio cues keep one broadside sound for a three-projectile weapon action', () => {
  assert.deepEqual(soundCuesForEvent({ type: 'weaponFired', weapon: 'left', faction: 'player' }), [{ sound: 'broadside', gain: 0.68 }]);
});

test('audio cues distinguish terrain, ship impact, destruction, and special feedback', () => {
  assert.equal(soundCuesForEvent({ type: 'projectileImpact', target: 'terrain' }, 0)[0]?.sound, 'waterHit1');
  assert.equal(soundCuesForEvent({ type: 'projectileImpact', target: 'enemy' }, 1)[0]?.sound, 'woodHit2');
  assert.deepEqual(soundCuesForEvent({ type: 'enemyDestroyed', cause: 'cannon' }, 0).map((cue) => cue.sound), ['explosion1', 'score']);
  assert.deepEqual(soundCuesForEvent({ type: 'specialActivated', targets: 4 }), [{ sound: 'explosion2', gain: 0.85, playbackRate: 0.78 }]);
});
