import { toMatchRecord } from '../api/contracts.ts';
import type { MatchRecord, PlayerIdentity } from '../api/contracts.ts';
import { createGameConfig, DEFAULT_OPTIONS } from '../game/config.ts';
import type { NetworkScenario } from './scenarios.ts';

export function createFixtures(scenario: NetworkScenario, player: PlayerIdentity): MatchRecord[] {
  if (scenario === 'empty') return [];
  const names = ['Mara', 'Blackfin', 'Isla', 'Storm', 'Reef', 'Ash', 'Pearl', 'Tide'];
  const count = scenario === 'multiple-pages' ? 25 : 17;
  const records: MatchRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    const options = index % 5 === 4 ? { ...DEFAULT_OPTIONS, sessionTime: 90, enemySpawnTime: 2.5 } : DEFAULT_OPTIONS;
    const configuration = createGameConfig(options);
    records.push(toMatchRecord({
      matchId: `fixture-fleet-${index}`, completedAt: new Date(Date.UTC(2026, 8, 1, 12, index)).toISOString(),
      score: 28 - index, activeDuration: configuration.sessionTime, endReason: 'timeout', configuration,
    }, { playerId: `fixture-player-${index}`, playerName: names[index % names.length] ?? 'Pirate' }));
  }
  if (scenario === 'multiple-pages') {
    for (let index = 0; index < 12; index += 1) records.push(toMatchRecord({
      matchId: `fixture-captain-${index}`, completedAt: new Date(Date.UTC(2026, 8, 2, 12, index)).toISOString(),
      score: index, activeDuration: 45 + index, endReason: 'death', configuration: createGameConfig(DEFAULT_OPTIONS),
    }, player));
  }
  return records;
}
