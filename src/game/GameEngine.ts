import { FIXED_STEP, MAX_FRAME_STEPS, WEAPON_IDS } from './config.ts';
import { findProjectileObstacle, isPositionBlocked, resolveMovement, segmentCircleHit } from './collision.ts';
import type { ObstacleHit } from './collision.ts';
import { createRandom, seedFromId } from './random.ts';
import type { EffectSnapshot, EndReason, EnemyPlacement, EnemySnapshot, Faction, GameAction, GameConfig, GameEvent, GameSetup, GameStatus, HealthPickupSnapshot, HudSnapshot, MatchResult, NavigationTarget, Point, ProjectileSnapshot, WeaponConfig, WeaponId, WorldSnapshot } from './types.ts';

interface Avoidance {
  readonly islandIndex: number;
  readonly side: -1 | 1;
}

interface EnemyState extends EnemySnapshot {
  readonly avoidance: Avoidance | null;
}

interface ProjectileHit extends ObstacleHit {
  readonly target: number | 'player' | null;
}

const FIRE_ACTIONS: Readonly<Record<WeaponId, GameAction>> = { front: 'fireFront', left: 'fireLeft', right: 'fireRight' };

export class GameEngine {
  readonly config: GameConfig;
  private status: GameStatus = 'ready';
  private x: number;
  private y: number;
  private heading = 0;
  private health: number;
  private damageFlash = 0;
  private score = 0;
  private specialCharge = 0;
  private specialRequested = false;
  private enemies: EnemyState[] = [];
  private spawnRemaining: number;
  private spawnIndex = 0;
  private readonly spawning: boolean;
  private readonly random: () => number;
  private activeDuration = 0;
  private accumulator = 0;
  private projectiles: ProjectileSnapshot[] = [];
  private effects: EffectSnapshot[] = [];
  private healthPickup: HealthPickupSnapshot | null = null;
  private healthPickupSpawnRemaining: number;
  private readonly cooldowns: Record<WeaponId, number> = { front: 0, left: 0, right: 0 };
  private nextEntityId = 1;
  private readonly actions = new Set<GameAction>();
  private navigationTarget: NavigationTarget | null = null;
  private readonly listeners = new Set<(snapshot: HudSnapshot) => void>();
  private readonly eventListeners = new Set<(event: GameEvent) => void>();
  private lastHudKey = '';
  private result: MatchResult | null = null;
  private readonly matchId: string;
  private readonly onComplete: (result: MatchResult) => void;

  constructor(config: GameConfig, matchId: string, onComplete: (result: MatchResult) => void, setup: GameSetup = {}) {
    this.config = structuredClone(config);
    this.x = this.config.player.start.x;
    this.y = this.config.player.start.y;
    this.health = this.config.player.maxHealth;
    this.spawnRemaining = this.config.enemySpawnTime;
    this.healthPickupSpawnRemaining = this.config.healthPickup.interval;
    this.spawning = setup.spawning ?? true;
    this.random = createRandom(setup.seed ?? seedFromId(matchId));
    this.matchId = matchId;
    this.onComplete = onComplete;
    for (const placement of setup.initialEnemies ?? []) this.enemies.push(this.createEnemy(placement));
  }

  start(): void {
    if (this.status !== 'ready') return;
    this.status = 'running';
    this.publish();
    this.emit({ type: 'statusChanged', status: this.status });
  }

  setActions(actions: ReadonlySet<GameAction>): void {
    const requestSpecial = this.status === 'running' && actions.has('specialAttack') && !this.actions.has('specialAttack');
    this.actions.clear();
    if (this.status === 'running') actions.forEach((action) => this.actions.add(action));
    if (requestSpecial) this.specialRequested = true;
  }

  setNavigationTarget(target: NavigationTarget | null): void {
    if (this.status !== 'running' || target === null) {
      this.navigationTarget = null;
      return;
    }
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.steeringScale) || target.steeringScale <= 0) return;
    this.navigationTarget = {
      x: Math.max(this.config.player.radius, Math.min(this.config.arena.width - this.config.player.radius, target.x)),
      y: Math.max(this.config.player.radius, Math.min(this.config.arena.height - this.config.player.radius, target.y)),
      autoAdvance: target.autoAdvance,
      steeringScale: Math.min(1, target.steeringScale),
    };
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.resetInputAndTime();
    this.publish();
    this.emit({ type: 'statusChanged', status: this.status });
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.resetInputAndTime();
    this.status = 'running';
    this.publish();
    this.emit({ type: 'statusChanged', status: this.status });
  }

  abandon(): void {
    if (this.status === 'finished' || this.status === 'abandoned') return;
    this.status = 'abandoned';
    this.resetInputAndTime();
    this.publish();
    this.emit({ type: 'statusChanged', status: this.status });
  }

  advance(elapsedSeconds: number): void {
    if (this.status !== 'running' || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
    this.accumulator = Math.min(this.accumulator + elapsedSeconds, FIXED_STEP * MAX_FRAME_STEPS);

    while (this.accumulator + 1e-10 >= FIXED_STEP && this.status === 'running') {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      this.step();
    }
    this.publish();
  }

  getWorld(): WorldSnapshot {
    return {
      player: { x: this.x, y: this.y, heading: this.heading, health: this.health, maxHealth: this.config.player.maxHealth, radius: this.config.player.radius, damageFlash: this.damageFlash },
      enemies: this.enemies.map(({ id, kind, x, y, heading, health, maxHealth, radius, damageFlash, attackCooldown }) => ({ id, kind, x, y, heading, health, maxHealth, radius, damageFlash, attackCooldown })),
      projectiles: this.projectiles.map((projectile) => ({ ...projectile })),
      effects: this.effects.map((effect) => ({ ...effect })),
      healthPickup: this.healthPickup ? { ...this.healthPickup } : null,
      cooldowns: { ...this.cooldowns },
      spawnRemaining: Math.max(0, this.spawnRemaining),
      spawnCount: this.spawnIndex,
      score: this.score,
      activeDuration: this.activeDuration,
      status: this.status,
      specialCharge: this.specialCharge,
    };
  }

  getHud(): HudSnapshot {
    return {
      status: this.status,
      health: this.health,
      maxHealth: this.config.player.maxHealth,
      score: this.score,
      remainingSeconds: Math.ceil(Math.max(0, this.config.sessionTime - this.activeDuration - 1e-8)),
      specialCharge: this.specialCharge,
      specialRequired: this.config.specialAttack.requiredKills,
      specialReady: this.config.specialAttackEnabled && this.specialCharge >= this.config.specialAttack.requiredKills,
    };
  }

  subscribe(listener: (snapshot: HudSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getHud());
    return () => { this.listeners.delete(listener); };
  }

  subscribeEvents(listener: (event: GameEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  }

  dispose(): void {
    this.abandon();
    this.listeners.clear();
    this.eventListeners.clear();
    this.projectiles = [];
    this.effects = [];
    this.healthPickup = null;
    this.enemies = [];
  }

  private step(): void {
    const dt = Math.min(FIXED_STEP, this.config.sessionTime - this.activeDuration);
    const previousPlayer = { x: this.x, y: this.y };
    const previousEnemies = new Map(this.enemies.map((enemy) => [enemy.id, { x: enemy.x, y: enemy.y }]));
    const turn = Number(this.actions.has('turnRight')) - Number(this.actions.has('turnLeft'));
    let moveForward = this.actions.has('moveForward') || this.navigationTarget?.autoAdvance === true;
    if (this.navigationTarget && turn === 0) {
      const dx = this.navigationTarget.x - this.x;
      const dy = this.navigationTarget.y - this.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= this.config.player.radius) {
        if (this.navigationTarget.autoAdvance) {
          this.navigationTarget = null;
          moveForward = this.actions.has('moveForward');
        }
      } else {
        const desired = Math.atan2(dy, dx);
        const delta = Math.atan2(Math.sin(desired - this.heading), Math.cos(desired - this.heading));
        const rotationSpeed = this.config.player.rotationSpeed * this.navigationTarget.steeringScale;
        const rotation = Math.max(-rotationSpeed * dt, Math.min(rotationSpeed * dt, delta));
        this.heading += rotation;
      }
    } else {
      this.heading += turn * this.config.player.rotationSpeed * dt;
    }
    this.heading %= Math.PI * 2;

    if (moveForward) {
      const position = resolveMovement(
        { x: this.x, y: this.y },
        {
          x: this.x + Math.cos(this.heading) * this.config.player.speed * dt,
          y: this.y + Math.sin(this.heading) * this.config.player.speed * dt,
        },
        this.config.player.radius,
        this.config,
      );
      this.x = position.x;
      this.y = position.y;
    }

    this.effects = this.effects.map((effect) => ({ ...effect, age: effect.age + dt })).filter((effect) => effect.age < effect.lifetime);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    this.updateHealthPickup(dt, previousPlayer);
    this.activateSpecialAttack();
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.resolveChaserContacts(previousPlayer, previousEnemies);
    this.enemies = this.enemies.filter((enemy) => enemy.health > 0);
    this.updateEnemyWeapons();
    this.activeDuration = Math.min(this.config.sessionTime, this.activeDuration + dt);
    if (this.health <= 0) this.finish('death');
    else if (this.activeDuration >= this.config.sessionTime - 1e-8) this.finish('timeout');
    else this.updateSpawns(dt);
  }

  private updateWeapons(dt: number): void {
    for (const weaponId of WEAPON_IDS) {
      this.cooldowns[weaponId] = Math.max(0, this.cooldowns[weaponId] - dt);
      if (!this.actions.has(FIRE_ACTIONS[weaponId]) || this.cooldowns[weaponId] > 1e-8) continue;
      this.cooldowns[weaponId] = this.config.weapons[weaponId].cooldown;
      this.fireWeapon(this.config.weapons[weaponId], weaponId, 'player', { x: this.x, y: this.y }, this.heading);
    }
  }

  private fireWeapon(weapon: WeaponConfig, weaponId: ProjectileSnapshot['weapon'], faction: Faction, source: Point, shipHeading: number): void {
    this.emit({ type: 'weaponFired', weapon: weaponId, faction });
    const heading = shipHeading + weapon.directionOffset;
    const cos = Math.cos(shipHeading);
    const sin = Math.sin(shipHeading);
    for (const offset of weapon.origins) {
      const origin = { x: source.x + offset.x * cos - offset.y * sin, y: source.y + offset.x * sin + offset.y * cos };
      const hit = this.getProjectileHit(source, origin, weapon.radius, faction);
      this.addEffect('shot', hit ?? origin);
      if (hit) {
        this.applyProjectileHit(hit, weapon.damage);
        continue;
      }
      this.projectiles.push({
        id: this.nextEntityId++, weapon: weaponId, faction, ...origin, heading,
        speed: weapon.speed, damage: weapon.damage, radius: weapon.radius, age: 0, lifetime: weapon.lifetime,
      });
    }
  }

  private updateProjectiles(dt: number): void {
    const survivors: ProjectileSnapshot[] = [];
    for (const projectile of this.projectiles) {
      if (this.health <= 0) {
        survivors.push(projectile);
        continue;
      }
      const travelTime = Math.min(dt, projectile.lifetime - projectile.age);
      if (travelTime <= 0) continue;
      const destination = {
        x: projectile.x + Math.cos(projectile.heading) * projectile.speed * travelTime,
        y: projectile.y + Math.sin(projectile.heading) * projectile.speed * travelTime,
      };
      const hit = this.getProjectileHit(projectile, destination, projectile.radius, projectile.faction);
      if (hit) {
        this.applyProjectileHit(hit, projectile.damage);
        continue;
      }
      const age = Math.min(projectile.lifetime, projectile.age + travelTime);
      if (age < projectile.lifetime - 1e-8) survivors.push({ ...projectile, ...destination, age });
    }
    this.projectiles = survivors;
  }

  private getProjectileHit(from: Point, to: Point, radius: number, faction: Faction): ProjectileHit | null {
    const obstacle = findProjectileObstacle(from, to, radius, this.config);
    let first: ProjectileHit | null = obstacle ? { ...obstacle, target: null } : null;
    const targets = faction === 'player'
      ? this.enemies.filter((enemy) => enemy.health > 0).map((enemy) => ({ id: enemy.id, x: enemy.x, y: enemy.y, radius: enemy.radius }))
      : this.health > 0 ? [{ id: 'player' as const, x: this.x, y: this.y, radius: this.config.player.radius }] : [];
    for (const target of targets) {
      const time = segmentCircleHit(from, to, target, target.radius + radius);
      if (time === null || (first && time >= first.time)) continue;
      first = { x: from.x + (to.x - from.x) * time, y: from.y + (to.y - from.y) * time, time, target: target.id };
    }
    return first;
  }

  private applyProjectileHit(hit: ProjectileHit, damage: number): void {
    this.addEffect('impact', hit);
    this.emit({ type: 'projectileImpact', target: hit.target === null ? 'terrain' : hit.target === 'player' ? 'player' : 'enemy' });
    if (hit.target === 'player') this.damagePlayer(damage, 'projectile');
    else if (hit.target !== null) {
      const index = this.enemies.findIndex((enemy) => enemy.id === hit.target);
      const enemy = this.enemies[index];
      if (!enemy || enemy.health <= 0) return;
      const health = Math.max(0, enemy.health - damage);
      this.enemies[index] = { ...enemy, health, damageFlash: this.config.feedback.damageFlashDuration };
      if (health === 0) {
        this.score += 1;
        if (this.config.specialAttackEnabled) this.specialCharge = Math.min(this.config.specialAttack.requiredKills, this.specialCharge + 1);
        this.addEffect('destruction', enemy);
        this.emit({ type: 'enemyDestroyed', cause: 'cannon' });
      }
    }
  }

  private damagePlayer(damage: number, cause: 'projectile' | 'collision'): void {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - damage);
    this.damageFlash = this.config.feedback.damageFlashDuration;
    this.emit({ type: 'playerDamaged', cause, health: this.health, maxHealth: this.config.player.maxHealth });
    if (this.health === 0) this.addEffect('destruction', { x: this.x, y: this.y });
  }

  private updateEnemies(dt: number): void {
    this.enemies = this.enemies.map((enemy) => {
      const config = this.config.enemies[enemy.kind];
      const steering = this.getEnemySteering(enemy);
      const desired = Math.atan2(steering.target.y - enemy.y, steering.target.x - enemy.x);
      const difference = Math.atan2(Math.sin(desired - enemy.heading), Math.cos(desired - enemy.heading));
      const turn = Math.max(-config.rotationSpeed * dt, Math.min(config.rotationSpeed * dt, difference));
      const heading = enemy.heading + turn;
      const distance = Math.hypot(this.x - enemy.x, this.y - enemy.y);
      const moving = enemy.kind === 'chaser' || steering.avoidance !== null || distance > this.config.enemies.shooter.stopDistance;
      const alignment = Math.max(0, Math.cos(desired - heading));
      const travel = moving ? config.speed * alignment * dt : 0;
      const position = resolveMovement(enemy, { x: enemy.x + Math.cos(heading) * travel, y: enemy.y + Math.sin(heading) * travel }, enemy.radius, this.config);
      return { ...enemy, ...position, heading, avoidance: steering.avoidance, damageFlash: Math.max(0, enemy.damageFlash - dt), attackCooldown: Math.max(0, enemy.attackCooldown - dt) };
    });
  }

  private getEnemySteering(enemy: EnemyState): { target: Point; avoidance: Avoidance | null } {
    const player = { x: this.x, y: this.y };
    let firstTime = Infinity;
    let islandIndex = -1;
    const clearance = this.config.navigation.avoidanceClearance;
    this.config.islands.forEach((island, index) => {
      const planningRadius = island.radius + enemy.radius + clearance / 2;
      const distance = Math.hypot(enemy.x - island.x, enemy.y - island.y);
      const escaping = (enemy.x - island.x) * (player.x - enemy.x) + (enemy.y - island.y) * (player.y - enemy.y) >= 0;
      if (distance < planningRadius && escaping) return;
      const time = segmentCircleHit(enemy, player, island, planningRadius);
      if (time !== null && time < firstTime) { firstTime = time; islandIndex = index; }
    });
    const island = this.config.islands[islandIndex];
    if (!island) return { target: player, avoidance: null };
    const angle = Math.atan2(enemy.y - island.y, enemy.x - island.x);
    const targetAngle = Math.atan2(player.y - island.y, player.x - island.x);
    const difference = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
    const side = enemy.avoidance?.islandIndex === islandIndex ? enemy.avoidance.side : difference >= 0 ? 1 : -1;
    const waypointAngle = angle + side * this.config.navigation.avoidanceAngle;
    const radius = island.radius + enemy.radius + clearance;
    return { target: { x: island.x + Math.cos(waypointAngle) * radius, y: island.y + Math.sin(waypointAngle) * radius }, avoidance: { islandIndex, side } };
  }

  private resolveChaserContacts(previousPlayer: Point, previousEnemies: ReadonlyMap<number, Point>): void {
    for (let index = 0; index < this.enemies.length && this.health > 0; index += 1) {
      const enemy = this.enemies[index];
      if (!enemy || enemy.kind !== 'chaser' || enemy.health <= 0) continue;
      const previous = previousEnemies.get(enemy.id) ?? enemy;
      const from = { x: previous.x - previousPlayer.x, y: previous.y - previousPlayer.y };
      const to = { x: enemy.x - this.x, y: enemy.y - this.y };
      if (segmentCircleHit(from, to, { x: 0, y: 0 }, enemy.radius + this.config.player.radius) === null) continue;
      this.enemies[index] = { ...enemy, health: 0 };
      this.addEffect('destruction', enemy);
      this.addEffect('impact', { x: this.x, y: this.y });
      this.emit({ type: 'enemyDestroyed', cause: 'collision' });
      this.damagePlayer(this.config.enemies.chaser.contactDamage, 'collision');
    }
  }

  private updateEnemyWeapons(): void {
    const config = this.config.enemies.shooter;
    for (let index = 0; index < this.enemies.length && this.health > 0; index += 1) {
      const enemy = this.enemies[index];
      if (!enemy || enemy.kind !== 'shooter' || enemy.health <= 0 || enemy.attackCooldown > 1e-8) continue;
      if (Math.hypot(this.x - enemy.x, this.y - enemy.y) > config.attackRange) continue;
      const desired = Math.atan2(this.y - enemy.y, this.x - enemy.x);
      const difference = Math.atan2(Math.sin(desired - enemy.heading), Math.cos(desired - enemy.heading));
      if (Math.abs(difference) > config.aimTolerance) continue;
      if (findProjectileObstacle(enemy, { x: this.x, y: this.y }, config.weapon.radius, this.config)) continue;
      this.enemies[index] = { ...enemy, attackCooldown: config.weapon.cooldown };
      this.fireWeapon(config.weapon, 'enemy', 'enemy', enemy, enemy.heading);
    }
  }

  private createEnemy(placement: EnemyPlacement): EnemyState {
    const config = this.config.enemies[placement.kind];
    if (!config || !Number.isFinite(placement.x) || !Number.isFinite(placement.y)
      || isPositionBlocked(placement, config.radius, this.config)
      || (placement.heading !== undefined && !Number.isFinite(placement.heading))
      || (placement.health !== undefined && (!Number.isFinite(placement.health) || placement.health <= 0 || placement.health > config.maxHealth))) {
      throw new Error('The initial enemy placement is invalid.');
    }
    return {
      id: this.nextEntityId++, kind: placement.kind, x: placement.x, y: placement.y,
      heading: placement.heading ?? Math.atan2(this.y - placement.y, this.x - placement.x),
      health: placement.health ?? config.maxHealth, maxHealth: config.maxHealth, radius: config.radius,
      damageFlash: 0, avoidance: null,
      attackCooldown: placement.kind === 'shooter' ? this.config.enemies.shooter.weapon.cooldown : 0,
    };
  }

  private updateSpawns(dt: number): void {
    if (!this.spawning) return;
    this.spawnRemaining -= dt;
    if (this.spawnRemaining > 1e-8) return;
    const kind = this.config.spawn.sequence[this.spawnIndex % this.config.spawn.sequence.length];
    if (kind) {
      const radius = this.config.enemies[kind].radius;
      const margin = radius + this.config.spawn.edgeMargin;
      for (let attempt = 0; attempt < this.config.spawn.attempts; attempt += 1) {
        const edge = Math.floor(this.random() * 4);
        const candidate = {
          x: edge === 0 ? margin : edge === 1 ? this.config.arena.width - margin : margin + this.random() * (this.config.arena.width - margin * 2),
          y: edge === 2 ? margin : edge === 3 ? this.config.arena.height - margin : margin + this.random() * (this.config.arena.height - margin * 2),
        };
        if (isPositionBlocked(candidate, radius, this.config)) continue;
        if (Math.hypot(candidate.x - this.x, candidate.y - this.y) < this.config.spawn.minimumDistance) continue;
        if (this.enemies.some((enemy) => Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) < radius + enemy.radius + this.config.spawn.separation)) continue;
        this.enemies.push(this.createEnemy({ ...candidate, kind }));
        this.spawnIndex += 1;
        this.spawnRemaining += this.config.enemySpawnTime;
        return;
      }
    }
    this.spawnRemaining = this.config.spawn.retryDelay;
  }

  private updateHealthPickup(dt: number, previousPlayer: Point): void {
    if (!this.config.healthPickupsEnabled) return;
    if (this.healthPickup) {
      const remaining = this.healthPickup.remaining - dt;
      this.healthPickup = remaining > 1e-8 ? { ...this.healthPickup, remaining } : null;
      if (this.healthPickup && this.health < this.config.player.maxHealth
        && segmentCircleHit(previousPlayer, { x: this.x, y: this.y }, this.healthPickup, this.config.player.radius + this.healthPickup.radius) !== null) {
        this.health = Math.min(this.config.player.maxHealth, this.health + this.config.healthPickup.healAmount);
        this.addEffect('heal', this.healthPickup);
        this.emit({ type: 'healthCollected' });
        this.healthPickup = null;
      }
    }
    this.healthPickupSpawnRemaining -= dt;
    if (this.healthPickupSpawnRemaining > 1e-8) return;
    while (this.healthPickupSpawnRemaining <= 1e-8) this.healthPickupSpawnRemaining += this.config.healthPickup.interval;
    if (this.healthPickup) return;
    const config = this.config.healthPickup;
    const margin = config.radius + config.edgeMargin;
    for (let attempt = 0; attempt < config.attempts; attempt += 1) {
      const candidate = {
        x: margin + this.random() * (this.config.arena.width - margin * 2),
        y: margin + this.random() * (this.config.arena.height - margin * 2),
      };
      if (isPositionBlocked(candidate, config.radius, this.config)) continue;
      if (Math.hypot(candidate.x - this.x, candidate.y - this.y) < config.minimumDistance) continue;
      if (this.enemies.some((enemy) => enemy.health > 0 && Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) < config.radius + enemy.radius + config.enemyClearance)) continue;
      this.healthPickup = { id: this.nextEntityId++, ...candidate, radius: config.radius, remaining: config.lifetime };
      return;
    }
  }

  private activateSpecialAttack(): void {
    if (!this.specialRequested) return;
    this.specialRequested = false;
    if (!this.config.specialAttackEnabled || this.specialCharge < this.config.specialAttack.requiredKills) return;
    const targets = this.enemies.filter((enemy) => enemy.health > 0);
    if (targets.length === 0) return;
    targets.forEach((enemy) => this.addEffect('destruction', enemy));
    this.enemies = this.enemies.map((enemy) => enemy.health > 0 ? { ...enemy, health: 0 } : enemy);
    this.projectiles = this.projectiles.filter((projectile) => projectile.faction === 'player');
    this.score += targets.length;
    this.specialCharge = 0;
    this.addEffect('special', { x: this.x, y: this.y });
    this.emit({ type: 'specialActivated', targets: targets.length });
  }

  private addEffect(kind: EffectSnapshot['kind'], position: Point): void {
    const feedback = this.config.feedback;
    this.effects.push({
      id: this.nextEntityId++, kind, x: position.x, y: position.y, age: 0,
      lifetime: kind === 'shot' ? feedback.shotDuration : kind === 'impact' ? feedback.impactDuration : kind === 'heal' ? feedback.impactDuration * 2 : feedback.destructionDuration,
      size: kind === 'shot' ? feedback.shotSize : kind === 'impact' ? feedback.impactSize : kind === 'heal' ? feedback.impactSize * 1.5 : kind === 'special' ? feedback.destructionSize * 4 : feedback.destructionSize,
    });
  }

  private finish(endReason: EndReason): void {
    if (this.result) return;
    if (endReason === 'timeout') this.activeDuration = this.config.sessionTime;
    this.status = 'finished';
    this.resetInputAndTime();
    this.result = {
      matchId: this.matchId,
      completedAt: new Date().toISOString(),
      score: this.score,
      activeDuration: this.activeDuration,
      endReason,
      configuration: structuredClone(this.config),
    };
    this.publish();
    this.emit({ type: 'statusChanged', status: this.status, endReason });
    this.onComplete(this.result);
  }

  private resetInputAndTime(): void {
    this.actions.clear();
    this.navigationTarget = null;
    this.specialRequested = false;
    this.accumulator = 0;
  }

  private publish(): void {
    const hud = this.getHud();
    const key = `${hud.status}:${hud.remainingSeconds}:${hud.health}:${hud.score}:${hud.specialCharge}`;
    if (key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.listeners.forEach((listener) => listener(hud));
  }

  private emit(event: GameEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }
}
