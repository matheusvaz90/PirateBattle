import type { EnemyConfig, EnemyKind, GameConfig, GameOptions, MatchConfiguration, WeaponConfig } from './types.ts';

export const FIXED_STEP = 1 / 60;
export const MAX_FRAME_STEPS = 15;
export const WEAPON_IDS = ['front', 'left', 'right'] as const;
export const OPTION_LIMITS = {
  sessionTime: { min: 60, max: 180 },
  enemySpawnTime: { min: 1, max: 10 },
} as const;

export const DEFAULT_OPTIONS: GameOptions = { sessionTime: 120, enemySpawnTime: 4, healthPickupsEnabled: true, specialAttackEnabled: true };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasValidBaseOptions(value: unknown): boolean {
  return isRecord(value)
    && isFiniteNumber(value.sessionTime)
    && Number.isInteger(value.sessionTime)
    && value.sessionTime >= OPTION_LIMITS.sessionTime.min
    && value.sessionTime <= OPTION_LIMITS.sessionTime.max
    && isFiniteNumber(value.enemySpawnTime)
    && value.enemySpawnTime >= OPTION_LIMITS.enemySpawnTime.min
    && value.enemySpawnTime <= OPTION_LIMITS.enemySpawnTime.max;
}

export function isGameOptions(value: unknown): value is GameOptions {
  return isRecord(value)
    && hasValidBaseOptions(value)
    && typeof value.healthPickupsEnabled === 'boolean'
    && typeof value.specialAttackEnabled === 'boolean';
}

export function createGameConfig(options: GameOptions): GameConfig {
  if (!isGameOptions(options)) throw new Error('Invalid game options.');

  return {
    ...options,
    balanceVersion: 'survival-v2',
    arena: { width: 1280, height: 720 },
    islands: [{ x: 640, y: 360, radius: 96 }],
    player: {
      speed: 200,
      rotationSpeed: 2.2,
      radius: 40,
      maxHealth: 100,
      start: { x: 220, y: 360 },
    },
    weapons: {
      front: {
        cooldown: 0.45, speed: 520, damage: 25, lifetime: 1.4, radius: 5,
        directionOffset: 0, origins: [{ x: 50, y: 0 }],
      },
      left: {
        cooldown: 0.95, speed: 450, damage: 18, lifetime: 1.2, radius: 5,
        directionOffset: -Math.PI / 2,
        origins: [{ x: -26, y: -34 }, { x: 0, y: -34 }, { x: 26, y: -34 }],
      },
      right: {
        cooldown: 0.95, speed: 450, damage: 18, lifetime: 1.2, radius: 5,
        directionOffset: Math.PI / 2,
        origins: [{ x: -26, y: 34 }, { x: 0, y: 34 }, { x: 26, y: 34 }],
      },
    },
    enemies: {
      chaser: { speed: 110, rotationSpeed: 2.5, radius: 34, maxHealth: 50, contactDamage: 25 },
      shooter: {
        speed: 85, rotationSpeed: 2, radius: 34, maxHealth: 75,
        attackRange: 400, stopDistance: 300, aimTolerance: 0.18,
        weapon: { cooldown: 1.6, speed: 320, damage: 12, lifetime: 2, radius: 5, directionOffset: 0, origins: [{ x: 44, y: 0 }] },
      },
    },
    spawn: { sequence: ['chaser', 'shooter'], minimumDistance: 320, edgeMargin: 24, separation: 16, attempts: 24, retryDelay: 0.5 },
    navigation: { avoidanceClearance: 40, avoidanceAngle: Math.PI / 6 },
    healthPickup: {
      interval: 15, healAmount: 20, lifetime: 10, radius: 24,
      minimumDistance: 180, edgeMargin: 28, enemyClearance: 40, attempts: 32,
    },
    specialAttack: { requiredKills: 5 },
    feedback: {
      shotDuration: 0.12, shotSize: 20, impactDuration: 0.24, impactSize: 36,
      damageFlashDuration: 0.15, destructionDuration: 0.5, destructionSize: 80,
      damagedThreshold: 0.65, criticalThreshold: 0.3,
    },
  };
}

function isWeaponConfig(value: unknown, projectileCount: number): value is WeaponConfig {
  return isRecord(value)
    && isFiniteNumber(value.cooldown) && value.cooldown > 0
    && isFiniteNumber(value.speed) && value.speed > 0
    && isFiniteNumber(value.damage) && value.damage > 0
    && isFiniteNumber(value.lifetime) && value.lifetime > 0
    && isFiniteNumber(value.radius) && value.radius > 0
    && isFiniteNumber(value.directionOffset)
    && Array.isArray(value.origins) && value.origins.length === projectileCount
    && value.origins.every((origin: unknown) => isRecord(origin)
      && isFiniteNumber(origin.x) && isFiniteNumber(origin.y));
}

export function isEnemyKind(value: unknown): value is EnemyKind {
  return value === 'chaser' || value === 'shooter';
}

function isEnemyConfig(value: unknown): value is EnemyConfig {
  return isRecord(value)
    && isFiniteNumber(value.speed) && value.speed > 0
    && isFiniteNumber(value.rotationSpeed) && value.rotationSpeed > 0
    && isFiniteNumber(value.radius) && value.radius > 0
    && isFiniteNumber(value.maxHealth) && value.maxHealth > 0;
}

export function isGameConfig(value: unknown): value is MatchConfiguration {
  if (!isRecord(value) || !hasValidBaseOptions(value)) return false;
  const { arena, player, islands, weapons, feedback, enemies, spawn, navigation } = value;
  if (!isRecord(arena) || !isRecord(player) || !isRecord(player.start)) return false;
  if (!isRecord(weapons) || !isRecord(feedback)) return false;
  if (!isRecord(enemies) || !isRecord(spawn) || !isRecord(navigation)) return false;
  const { chaser, shooter } = enemies;
  if (!isRecord(chaser) || !isRecord(shooter) || !isEnemyConfig(chaser) || !isEnemyConfig(shooter)) return false;

  const sharedValid = isFiniteNumber(arena.width) && arena.width > 0
    && isFiniteNumber(arena.height) && arena.height > 0
    && isFiniteNumber(player.speed) && player.speed > 0
    && isFiniteNumber(player.rotationSpeed) && player.rotationSpeed > 0
    && isFiniteNumber(player.radius) && player.radius > 0
    && isFiniteNumber(player.maxHealth) && player.maxHealth > 0
    && isFiniteNumber(player.start.x) && isFiniteNumber(player.start.y)
    && Array.isArray(islands)
    && islands.length > 0
    && islands.every((island: unknown) => isRecord(island)
      && isFiniteNumber(island.x) && isFiniteNumber(island.y)
      && isFiniteNumber(island.radius) && island.radius > 0)
    && isWeaponConfig(weapons.front, 1)
    && isWeaponConfig(weapons.left, 3)
    && isWeaponConfig(weapons.right, 3)
    && isFiniteNumber(feedback.shotDuration) && feedback.shotDuration > 0
    && isFiniteNumber(feedback.shotSize) && feedback.shotSize > 0
    && isFiniteNumber(feedback.impactDuration) && feedback.impactDuration > 0
    && isFiniteNumber(feedback.impactSize) && feedback.impactSize > 0
    && isFiniteNumber(feedback.damageFlashDuration) && feedback.damageFlashDuration > 0
    && isFiniteNumber(feedback.destructionDuration) && feedback.destructionDuration > 0
    && isFiniteNumber(feedback.destructionSize) && feedback.destructionSize > 0
    && isFiniteNumber(feedback.criticalThreshold) && feedback.criticalThreshold > 0
    && isFiniteNumber(feedback.damagedThreshold) && feedback.damagedThreshold < 1
    && feedback.criticalThreshold < feedback.damagedThreshold
    && isFiniteNumber(chaser.contactDamage) && chaser.contactDamage > 0
    && isFiniteNumber(shooter.attackRange) && shooter.attackRange > 0
    && isFiniteNumber(shooter.stopDistance) && shooter.stopDistance > 0 && shooter.stopDistance < shooter.attackRange
    && isFiniteNumber(shooter.aimTolerance) && shooter.aimTolerance > 0 && shooter.aimTolerance < Math.PI
    && isWeaponConfig(shooter.weapon, 1)
    && Array.isArray(spawn.sequence) && spawn.sequence.length > 0 && spawn.sequence.every(isEnemyKind)
    && isFiniteNumber(spawn.minimumDistance) && spawn.minimumDistance > 0
    && isFiniteNumber(spawn.edgeMargin) && spawn.edgeMargin >= 0
    && isFiniteNumber(spawn.separation) && spawn.separation >= 0
    && isFiniteNumber(spawn.attempts) && Number.isInteger(spawn.attempts) && spawn.attempts > 0
    && isFiniteNumber(spawn.retryDelay) && spawn.retryDelay > 0
    && isFiniteNumber(navigation.avoidanceClearance) && navigation.avoidanceClearance > 0
    && isFiniteNumber(navigation.avoidanceAngle) && navigation.avoidanceAngle > 0 && navigation.avoidanceAngle < Math.PI / 2;
  if (!sharedValid) return false;
  if (value.balanceVersion === 'combat-v1') return true;
  if (value.balanceVersion !== 'survival-v2') return false;
  const { healthPickup, specialAttack } = value;
  return isGameOptions(value) && isRecord(healthPickup) && isRecord(specialAttack)
    && isFiniteNumber(healthPickup.interval) && healthPickup.interval > 0
    && isFiniteNumber(healthPickup.healAmount) && healthPickup.healAmount > 0
    && isFiniteNumber(healthPickup.lifetime) && healthPickup.lifetime > 0
    && isFiniteNumber(healthPickup.radius) && healthPickup.radius > 0
    && isFiniteNumber(healthPickup.minimumDistance) && healthPickup.minimumDistance >= 0
    && isFiniteNumber(healthPickup.edgeMargin) && healthPickup.edgeMargin >= 0
    && isFiniteNumber(healthPickup.enemyClearance) && healthPickup.enemyClearance >= 0
    && isFiniteNumber(healthPickup.attempts) && Number.isInteger(healthPickup.attempts) && healthPickup.attempts > 0
    && isFiniteNumber(specialAttack.requiredKills) && Number.isInteger(specialAttack.requiredKills) && specialAttack.requiredKills > 0;
}
