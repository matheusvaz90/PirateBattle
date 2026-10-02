export interface Point {
  readonly x: number;
  readonly y: number;
}

export type NavigationTarget = Point;

export interface BaseGameOptions {
  readonly sessionTime: number;
  readonly enemySpawnTime: number;
}

export interface GameOptions extends BaseGameOptions {
  readonly healthPickupsEnabled: boolean;
  readonly specialAttackEnabled: boolean;
}

export interface Island extends Point {
  readonly radius: number;
}

export type WeaponId = 'front' | 'left' | 'right';
export type EnemyKind = 'chaser' | 'shooter';
export type Faction = 'player' | 'enemy';
export type EndReason = 'timeout' | 'death';

export interface WeaponConfig {
  readonly cooldown: number;
  readonly speed: number;
  readonly damage: number;
  readonly lifetime: number;
  readonly radius: number;
  readonly directionOffset: number;
  readonly origins: readonly Point[];
}

export interface EnemyConfig {
  readonly speed: number;
  readonly rotationSpeed: number;
  readonly radius: number;
  readonly maxHealth: number;
}

export interface EnemyPlacement extends Point {
  readonly kind: EnemyKind;
  readonly heading?: number;
  readonly health?: number;
}

export interface GameSetup {
  readonly seed?: number;
  readonly spawning?: boolean;
  readonly initialEnemies?: readonly EnemyPlacement[];
}

export interface GameConfigBase extends BaseGameOptions {
  readonly arena: { readonly width: number; readonly height: number };
  readonly islands: readonly Island[];
  readonly player: {
    readonly speed: number;
    readonly rotationSpeed: number;
    readonly radius: number;
    readonly maxHealth: number;
    readonly start: Point;
  };
  readonly weapons: Readonly<Record<WeaponId, WeaponConfig>>;
  readonly enemies: {
    readonly chaser: EnemyConfig & { readonly contactDamage: number };
    readonly shooter: EnemyConfig & {
      readonly attackRange: number;
      readonly stopDistance: number;
      readonly aimTolerance: number;
      readonly weapon: WeaponConfig;
    };
  };
  readonly spawn: {
    readonly sequence: readonly EnemyKind[];
    readonly minimumDistance: number;
    readonly edgeMargin: number;
    readonly separation: number;
    readonly attempts: number;
    readonly retryDelay: number;
  };
  readonly navigation: { readonly avoidanceClearance: number; readonly avoidanceAngle: number };
  readonly feedback: {
    readonly shotDuration: number;
    readonly shotSize: number;
    readonly impactDuration: number;
    readonly impactSize: number;
    readonly damageFlashDuration: number;
    readonly destructionDuration: number;
    readonly destructionSize: number;
    readonly damagedThreshold: number;
    readonly criticalThreshold: number;
  };
}

export interface LegacyGameConfig extends GameConfigBase {
  readonly balanceVersion: 'combat-v1';
}

export interface GameConfig extends GameConfigBase, GameOptions {
  readonly balanceVersion: 'survival-v2';
  readonly healthPickup: {
    readonly interval: number;
    readonly healAmount: number;
    readonly lifetime: number;
    readonly radius: number;
    readonly minimumDistance: number;
    readonly edgeMargin: number;
    readonly enemyClearance: number;
    readonly attempts: number;
  };
  readonly specialAttack: {
    readonly requiredKills: number;
  };
}

export type MatchConfiguration = LegacyGameConfig | GameConfig;

export type GameAction = 'moveForward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight' | 'specialAttack';
export type GameStatus = 'ready' | 'running' | 'paused' | 'finished' | 'abandoned';

export type GameEvent =
  | { readonly type: 'statusChanged'; readonly status: Exclude<GameStatus, 'finished'> }
  | { readonly type: 'statusChanged'; readonly status: 'finished'; readonly endReason: EndReason }
  | { readonly type: 'weaponFired'; readonly weapon: WeaponId | 'enemy'; readonly faction: Faction }
  | { readonly type: 'projectileImpact'; readonly target: 'terrain' | 'player' | 'enemy' }
  | { readonly type: 'enemyDestroyed'; readonly cause: 'cannon' | 'collision' }
  | { readonly type: 'playerDamaged'; readonly cause: 'projectile' | 'collision'; readonly health: number; readonly maxHealth: number }
  | { readonly type: 'healthCollected' }
  | { readonly type: 'specialActivated'; readonly targets: number };

export interface ShipSnapshot extends Point {
  readonly heading: number;
  readonly health: number;
  readonly radius: number;
  readonly maxHealth: number;
  readonly damageFlash: number;
}

export interface EnemySnapshot extends ShipSnapshot {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly attackCooldown: number;
}

export interface HudSnapshot {
  readonly status: GameStatus;
  readonly health: number;
  readonly maxHealth: number;
  readonly score: number;
  readonly remainingSeconds: number;
  readonly specialCharge: number;
  readonly specialRequired: number;
  readonly specialReady: boolean;
}

export interface HealthPickupSnapshot extends Point {
  readonly id: number;
  readonly radius: number;
  readonly remaining: number;
}

export interface ProjectileSnapshot extends Point {
  readonly id: number;
  readonly weapon: WeaponId | 'enemy';
  readonly faction: Faction;
  readonly heading: number;
  readonly speed: number;
  readonly damage: number;
  readonly radius: number;
  readonly age: number;
  readonly lifetime: number;
}

export interface EffectSnapshot extends Point {
  readonly id: number;
  readonly kind: 'shot' | 'impact' | 'destruction' | 'heal' | 'special';
  readonly age: number;
  readonly lifetime: number;
  readonly size: number;
}

export interface WorldSnapshot {
  readonly player: ShipSnapshot;
  readonly enemies: readonly EnemySnapshot[];
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly effects: readonly EffectSnapshot[];
  readonly healthPickup: HealthPickupSnapshot | null;
  readonly cooldowns: Readonly<Record<WeaponId, number>>;
  readonly spawnRemaining: number;
  readonly spawnCount: number;
  readonly score: number;
  readonly activeDuration: number;
  readonly status: GameStatus;
  readonly specialCharge: number;
}

export interface MatchResult {
  readonly matchId: string;
  readonly completedAt: string;
  readonly score: number;
  readonly activeDuration: number;
  readonly endReason: EndReason;
  readonly configuration: MatchConfiguration;
}
