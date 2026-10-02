import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { GameEngine } from './GameEngine.ts';
import type { ShipSnapshot, WorldSnapshot } from './types.ts';
import { FrameClock } from './FrameClock.ts';
import type { ProfileSession } from './profiling.ts';

interface EnemyVisual {
  readonly ship: Sprite;
  readonly healthBar: Graphics;
  health: number;
}

export const GAME_ASSETS = {
  ship: 'png/default/ships/ship_5.png',
  damagedShip: 'png/default/ships/ship_11.png',
  criticalShip: 'png/default/ships/ship_17.png',
  chaser: 'png/default/ships/ship_3.png',
  damagedChaser: 'png/default/ships/ship_9.png',
  criticalChaser: 'png/default/ships/ship_15.png',
  shooter: 'png/default/ships/ship_2.png',
  damagedShooter: 'png/default/ships/ship_8.png',
  criticalShooter: 'png/default/ships/ship_14.png',
  water: 'png/retina/tiles/tile_73.png',
  sand: 'png/retina/tiles/tile_1.png',
  rock: 'png/retina/tiles/tile_50.png',
  heart: 'png/retina/ui/hud/icon_heart.png',
  projectile: 'png/default/ship_parts/cannon_ball.png',
  burst: 'png/default/effects/explosion_3.png',
  destruction: 'png/default/effects/explosion_1.png',
} as const;

const ENEMY_TEXTURES = {
  chaser: { healthy: 'chaser', damaged: 'damagedChaser', critical: 'criticalChaser' },
  shooter: { healthy: 'shooter', damaged: 'damagedShooter', critical: 'criticalShooter' },
} as const;

export class GameRenderer {
  private readonly engine: GameEngine;
  private readonly host: HTMLElement;
  private readonly world = new Container();
  private readonly ship = new Sprite();
  private readonly specialAura = new Graphics();
  private readonly healthBar = new Graphics();
  private readonly pickupSprite = new Sprite();
  private water: TilingSprite | null = null;
  private readonly enemyLayer = new Container();
  private readonly enemyVisuals = new Map<number, EnemyVisual>();
  private readonly textures = new Map<string, Texture>();
  private lastPlayerHealth = -1;
  private readonly projectileLayer = new Container();
  private readonly effectLayer = new Container();
  private readonly projectileSprites = new Map<number, Sprite>();
  private readonly effectSprites = new Map<number, Sprite>();
  private app: Application | null = null;
  private observer: ResizeObserver | null = null;
  private disposed = false;
  private initialized = false;
  private controlledClock = false;
  private readonly clock = new FrameClock();
  private readonly unsubscribeClock: () => void;
  private readonly controllerReleases: (() => void)[] = [];
  private readonly renderingReleases: (() => void)[] = [];
  private readonly profile: ProfileSession | null;

  constructor(engine: GameEngine, host: HTMLElement, profile: ProfileSession | null = null) {
    this.engine = engine;
    this.host = host;
    this.profile = profile;
    this.unsubscribeClock = engine.subscribe((snapshot) => this.clock.setStatus(snapshot.status));
    if (profile) this.controllerReleases.push(profile.track('renderers'), profile.track('subscriptions'));
  }

  async initialize(onProgress: (progress: number) => void): Promise<boolean> {
    const app = new Application();
    this.app = app;

    try {
      await app.init({
        width: Math.max(1, this.host.clientWidth),
        height: Math.max(1, this.host.clientHeight),
        backgroundColor: 0x071e2b,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        autoStart: false,
        sharedTicker: false,
        preference: 'webgl',
        antialias: true,
      });
      this.initialized = true;
      if (this.disposed) {
        this.destroyApplication();
        return false;
      }

      const assets = Object.entries(GAME_ASSETS);
      let loaded = 0;
      const textures = await Promise.all(assets.map(async ([name, path]) => {
        const texture = await Assets.load<Texture>(`${import.meta.env.BASE_URL}assets/${path}`);
        loaded += 1;
        if (!this.disposed) onProgress(Math.round(loaded / assets.length * 100));
        return { name, texture };
      }));
      if (this.disposed) return false;
      textures.forEach(({ name, texture }) => this.textures.set(name, texture));

      this.water = new TilingSprite({ texture: this.requireTexture('water'), width: this.engine.config.arena.width, height: this.engine.config.arena.height });
      this.water.tileScale.set(1.12);
      this.water.tint = 0xa8dce8;
      this.world.addChild(this.water);
      this.createIslands(this.requireTexture('sand'), this.requireTexture('rock'));
      this.pickupSprite.texture = this.requireTexture('heart');
      this.pickupSprite.anchor.set(0.5);
      this.pickupSprite.visible = false;
      this.world.addChild(this.pickupSprite);
      this.world.addChild(this.enemyLayer);
      this.specialAura.circle(0, 0, 55).stroke({ color: 0xf7c873, width: 4, alpha: 0.9 });
      this.specialAura.circle(0, 0, 66).stroke({ color: 0x8ff2b1, width: 2, alpha: 0.65 });
      this.specialAura.visible = false;
      this.world.addChild(this.specialAura);
      this.ship.texture = this.requireTexture('ship');
      this.ship.anchor.set(0.5);
      this.ship.scale.set(0.8);
      this.world.addChild(this.ship);
      this.world.addChild(this.projectileLayer, this.effectLayer);
      this.world.addChild(this.healthBar);
      app.stage.addChild(this.world);
      app.canvas.setAttribute('aria-hidden', 'true');
      this.host.appendChild(app.canvas);
      if (this.profile) this.renderingReleases.push(this.profile.track('canvases'));
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(this.host);
      if (this.profile) this.renderingReleases.push(this.profile.track('resizeObservers'));
      this.resize();
      this.render(this.engine.getWorld());
      app.ticker.add(this.tick);
      if (this.profile) this.renderingReleases.push(this.profile.track('tickers'));
      app.start();
      return true;
    } catch (error: unknown) {
      this.destroyApplication();
      if (this.disposed) return false;
      throw error;
    }
  }

  setControlledClock(enabled: boolean): void {
    this.controlledClock = enabled;
  }

  advanceControlled(seconds: number): void {
    if (!this.controlledClock || !Number.isFinite(seconds) || seconds < 0 || seconds > 180) {
      throw new Error('Controlled time requires test mode and a duration between 0 and 180 seconds.');
    }
    let remaining = seconds;
    while (remaining > 1e-8 && this.engine.getHud().status === 'running') {
      const slice = Math.min(remaining, 1 / 60);
      this.engine.advance(slice);
      remaining -= slice;
    }
    this.render(this.engine.getWorld());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeClock();
    this.controllerReleases.forEach((release) => release());
    this.controllerReleases.length = 0;
    this.observer?.disconnect();
    this.observer = null;
    this.destroyApplication();
  }

  private readonly tick = (): void => {
    if (this.disposed || !this.app) return;
    const elapsed = this.clock.consume(this.app.ticker.elapsedMS);
    if (!this.controlledClock && elapsed !== null) this.engine.advance(elapsed / 1000);
    if (!this.disposed) {
      const world = this.engine.getWorld();
      this.render(world);
      if (!this.controlledClock && elapsed !== null) this.profile?.record(elapsed, world);
    }
  };

  private render(snapshot: WorldSnapshot): void {
    if (this.disposed) return;
    this.ship.position.set(snapshot.player.x, snapshot.player.y);
    const specialReady = this.engine.config.specialAttackEnabled && snapshot.specialCharge >= this.engine.config.specialAttack.requiredKills;
    const auraPulse = 1 + Math.sin(snapshot.activeDuration * 6) * 0.08;
    this.specialAura.visible = specialReady;
    this.specialAura.position.set(snapshot.player.x, snapshot.player.y);
    this.specialAura.scale.set(auraPulse);
    this.specialAura.rotation = snapshot.activeDuration * 0.7;
    this.specialAura.alpha = 0.62 + Math.sin(snapshot.activeDuration * 6) * 0.18;
    if (this.water) this.water.tilePosition.set(snapshot.activeDuration * 3.5, snapshot.activeDuration * 1.75);
    this.ship.rotation = snapshot.player.heading - Math.PI / 2;
    this.ship.texture = this.getShipTexture(snapshot.player, 'ship', 'damagedShip', 'criticalShip');
    this.ship.tint = snapshot.player.damageFlash > 0 ? 0xffa899 : 0xffffff;
    this.healthBar.position.set(snapshot.player.x, snapshot.player.y - 64);
    if (snapshot.player.health !== this.lastPlayerHealth) {
      this.drawHealthBar(this.healthBar, snapshot.player);
      this.lastPlayerHealth = snapshot.player.health;
    }
    this.renderEnemies(snapshot);
    this.renderHealthPickup(snapshot);
    this.renderProjectiles(snapshot);
    this.renderEffects(snapshot);
  }

  private renderHealthPickup(snapshot: WorldSnapshot): void {
    const pickup = snapshot.healthPickup;
    this.pickupSprite.visible = pickup !== null;
    if (!pickup) return;
    const pulse = 1 + Math.sin(snapshot.activeDuration * 5) * 0.07;
    this.pickupSprite.position.set(pickup.x, pickup.y + Math.sin(snapshot.activeDuration * 3) * 5);
    this.pickupSprite.width = 48 * pulse;
    this.pickupSprite.height = 48 * pulse;
    this.pickupSprite.alpha = Math.min(1, pickup.remaining / 1.5);
  }

  private requireTexture(name: keyof typeof GAME_ASSETS): Texture {
    const texture = this.textures.get(name);
    if (!texture) throw new Error(`Missing game texture: ${name}.`);
    return texture;
  }

  private getShipTexture(ship: ShipSnapshot, healthy: keyof typeof GAME_ASSETS, damaged: keyof typeof GAME_ASSETS, critical: keyof typeof GAME_ASSETS): Texture {
    const ratio = ship.health / ship.maxHealth;
    return this.requireTexture(ratio <= this.engine.config.feedback.criticalThreshold ? critical : ratio <= this.engine.config.feedback.damagedThreshold ? damaged : healthy);
  }

  private drawHealthBar(bar: Graphics, ship: ShipSnapshot): void {
    const ratio = Math.max(0, Math.min(1, ship.health / ship.maxHealth));
    const width = ratio * 54;
    const color = ratio <= this.engine.config.feedback.criticalThreshold ? 0xff9581 : ratio <= this.engine.config.feedback.damagedThreshold ? 0xf7c873 : 0x8ff2b1;
    bar.clear().roundRect(-30, -4, 60, 8, 4).fill(0x08242c);
    if (width > 0) bar.roundRect(-27, -2, width, 4, Math.min(2, width / 2)).fill(color);
  }

  private renderEnemies(snapshot: WorldSnapshot): void {
    const activeIds = new Set(snapshot.enemies.map((enemy) => enemy.id));
    for (const [id, visual] of this.enemyVisuals) {
      if (activeIds.has(id)) continue;
      visual.ship.destroy({ texture: false, textureSource: false });
      visual.healthBar.destroy();
      this.enemyVisuals.delete(id);
    }
    for (const enemy of snapshot.enemies) {
      let visual = this.enemyVisuals.get(enemy.id);
      if (!visual) {
        const ship = new Sprite(this.requireTexture(enemy.kind));
        ship.anchor.set(0.5);
        ship.scale.set(0.7);
        const healthBar = new Graphics();
        visual = { ship, healthBar, health: -1 };
        this.enemyLayer.addChild(ship, healthBar);
        this.enemyVisuals.set(enemy.id, visual);
      }
      const textures = ENEMY_TEXTURES[enemy.kind];
      visual.ship.position.set(enemy.x, enemy.y);
      visual.ship.rotation = enemy.heading - Math.PI / 2;
      visual.ship.texture = this.getShipTexture(enemy, textures.healthy, textures.damaged, textures.critical);
      visual.ship.tint = enemy.damageFlash > 0 ? 0xffa899 : 0xffffff;
      visual.healthBar.position.set(enemy.x, enemy.y - 54);
      if (visual.health !== enemy.health) {
        this.drawHealthBar(visual.healthBar, enemy);
        visual.health = enemy.health;
      }
    }
  }

  private renderProjectiles(snapshot: WorldSnapshot): void {
    const texture = this.textures.get('projectile');
    if (!texture) return;
    const activeIds = new Set(snapshot.projectiles.map((projectile) => projectile.id));
    for (const [id, sprite] of this.projectileSprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy({ texture: false, textureSource: false });
      this.projectileSprites.delete(id);
    }
    for (const projectile of snapshot.projectiles) {
      let sprite = this.projectileSprites.get(projectile.id);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.width = projectile.radius * 2;
        sprite.height = projectile.radius * 2;
        sprite.tint = projectile.faction === 'enemy' ? 0xff9977 : 0xffffff;
        this.projectileLayer.addChild(sprite);
        this.projectileSprites.set(projectile.id, sprite);
      }
      sprite.position.set(projectile.x, projectile.y);
    }
  }

  private renderEffects(snapshot: WorldSnapshot): void {
    if (!this.textures.has('burst')) return;
    const activeIds = new Set(snapshot.effects.map((effect) => effect.id));
    for (const [id, sprite] of this.effectSprites) {
      if (activeIds.has(id)) continue;
      sprite.destroy({ texture: false, textureSource: false });
      this.effectSprites.delete(id);
    }
    for (const effect of snapshot.effects) {
      let sprite = this.effectSprites.get(effect.id);
      if (!sprite) {
        sprite = new Sprite(this.requireTexture(effect.kind === 'destruction' ? 'destruction' : 'burst'));
        sprite.anchor.set(0.5);
        this.effectLayer.addChild(sprite);
        this.effectSprites.set(effect.id, sprite);
      }
      const progress = effect.age / effect.lifetime;
      const size = effect.size * (effect.kind !== 'shot' ? 0.65 + progress * 0.65 : 1 - progress * 0.3);
      sprite.position.set(effect.x, effect.y);
      sprite.width = size;
      sprite.height = size;
      sprite.alpha = 1 - progress;
      sprite.tint = effect.kind === 'heal' ? 0x8ff2b1 : effect.kind === 'special' ? 0xf7c873 : 0xffffff;
    }
  }

  private resize(): void {
    if (this.disposed || !this.app || !this.initialized) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(width, height);
    const scale = Math.min(width / this.engine.config.arena.width, height / this.engine.config.arena.height);
    this.world.scale.set(scale);
    this.world.position.set((width - this.engine.config.arena.width * scale) / 2, (height - this.engine.config.arena.height * scale) / 2);
    this.profile?.setCanvas({
      width, height, backingWidth: this.app.canvas.width, backingHeight: this.app.canvas.height,
      resolution: this.app.renderer.resolution, rendererType: this.app.renderer.type, loadedTextures: this.textures.size,
    });
  }

  private createIslands(sandTexture: Texture, rockTexture: Texture): void {
    for (const island of this.engine.config.islands) {
      const shadow = new Graphics().ellipse(island.x + 8, island.y + 12, island.radius + 18, island.radius + 12).fill({ color: 0x06242c, alpha: 0.28 });
      const shore = new Graphics().circle(island.x, island.y, island.radius + 15).fill({ color: 0xb9f4eb, alpha: 0.4 });
      const sandBase = new Graphics().circle(island.x, island.y, island.radius - 4).fill(0xf4cc7a);
      this.world.addChild(shadow, shore, sandBase);
      for (let quadrant = 0; quadrant < 4; quadrant += 1) {
        const angle = quadrant * Math.PI / 2;
        const sand = new Sprite(sandTexture);
        sand.anchor.set(0.5);
        sand.width = island.radius + 4;
        sand.height = island.radius + 4;
        sand.rotation = angle;
        sand.position.set(
          island.x + (-Math.cos(angle) + Math.sin(angle)) * (island.radius - 2) / 2,
          island.y + (-Math.sin(angle) - Math.cos(angle)) * (island.radius - 2) / 2,
        );
        this.world.addChild(sand);
      }
      const greenery = new Graphics().ellipse(island.x - 7, island.y + 5, island.radius * 0.52, island.radius * 0.45).fill(0x739e3e);
      this.world.addChild(greenery);
      const rock = new Sprite(rockTexture);
      rock.anchor.set(0.5);
      rock.position.set(island.x + 20, island.y - 10);
      this.world.addChild(rock);
    }
  }

  private destroyApplication(): void {
    if (!this.app || !this.initialized) return;
    this.observer?.disconnect();
    this.app.ticker.remove(this.tick);
    this.app.stop();
    this.app.destroy(true, { children: true, texture: false, textureSource: false });
    this.renderingReleases.forEach((release) => release());
    this.renderingReleases.length = 0;
    this.projectileSprites.clear();
    this.effectSprites.clear();
    this.enemyVisuals.clear();
    this.textures.clear();
    this.app = null;
    this.initialized = false;
  }
}
