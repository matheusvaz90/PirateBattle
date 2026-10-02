import type { GameEngine } from './GameEngine.ts';
import type { GameAction } from './types.ts';
import type { ProfileSession } from './profiling.ts';

const KEY_ACTIONS: Readonly<Record<string, GameAction>> = {
  KeyW: 'moveForward', ArrowUp: 'moveForward',
  KeyA: 'turnLeft', ArrowLeft: 'turnLeft',
  KeyD: 'turnRight', ArrowRight: 'turnRight',
  Space: 'fireFront', KeyQ: 'fireLeft', KeyE: 'fireRight',
  KeyR: 'specialAttack',
};

export class InputController {
  private readonly engine: GameEngine;
  private readonly host: HTMLElement;
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, GameAction>();
  private navigationPointer: number | null = null;
  private readonly unsubscribe: () => void;
  private readonly releases: (() => void)[] = [];
  private disposed = false;

  constructor(engine: GameEngine, host: HTMLElement, profile: ProfileSession | null = null) {
    this.engine = engine;
    this.host = host;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.unsubscribe = engine.subscribe((snapshot) => {
      if (snapshot.status !== 'running') this.clear();
    });
    if (profile) {
      this.releases.push(profile.track('inputControllers'), profile.track('subscriptions'));
      for (let listener = 0; listener < 4; listener += 1) this.releases.push(profile.track('inputListeners'));
    }
  }

  pressPointer(pointerId: number, action: GameAction): void {
    if (this.engine.getHud().status !== 'running') return;
    this.pointers.set(pointerId, action);
    this.sync();
  }

  releasePointer(pointerId: number): void {
    this.pointers.delete(pointerId);
    this.sync();
  }

  beginNavigation(pointerId: number, clientX: number, clientY: number): boolean {
    if (this.engine.getHud().status !== 'running' || this.navigationPointer !== null) return false;
    const target = this.toWorldPoint(clientX, clientY);
    if (!target) return false;
    this.navigationPointer = pointerId;
    this.engine.setNavigationTarget(target);
    return true;
  }

  updateNavigation(pointerId: number, clientX: number, clientY: number): void {
    if (this.navigationPointer !== pointerId) return;
    this.engine.setNavigationTarget(this.toWorldPoint(clientX, clientY, true));
  }

  endNavigation(pointerId: number): void {
    if (this.navigationPointer !== pointerId) return;
    this.navigationPointer = null;
    this.engine.setNavigationTarget(null);
  }

  clear(): void {
    this.keys.clear();
    this.pointers.clear();
    this.navigationPointer = null;
    this.engine.setNavigationTarget(null);
    this.sync();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.unsubscribe();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.releases.forEach((release) => release());
    this.releases.length = 0;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.engine.getHud().status !== 'running') return;
    if (event.target instanceof HTMLElement
      && (event.target.isContentEditable || event.target.closest('input, textarea, select, button, dialog'))) return;
    if (!this.host.contains(document.activeElement)) return;

    if (event.code === 'Escape') {
      event.preventDefault();
      if (event.repeat) return;
      this.engine.pause();
      return;
    }

    if (!KEY_ACTIONS[event.code]) return;
    event.preventDefault();
    if (event.repeat) return;
    this.keys.add(event.code);
    if (KEY_ACTIONS[event.code] === 'moveForward' || KEY_ACTIONS[event.code] === 'turnLeft' || KEY_ACTIONS[event.code] === 'turnRight') {
      this.engine.setNavigationTarget(null);
    }
    this.sync();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (this.keys.has(event.code)) event.preventDefault();
    this.keys.delete(event.code);
    this.sync();
  };

  private readonly handleBlur = (): void => {
    this.clear();
    this.engine.pause();
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.handleBlur();
  };

  private sync(): void {
    const actions = new Set<GameAction>();
    this.keys.forEach((key) => {
      const action = KEY_ACTIONS[key];
      if (action) actions.add(action);
    });
    this.pointers.forEach((action) => actions.add(action));
    this.engine.setActions(actions);
  }

  private toWorldPoint(clientX: number, clientY: number, clamp = false): { x: number; y: number } | null {
    const rect = this.host.getBoundingClientRect();
    const scale = Math.min(rect.width / this.engine.config.arena.width, rect.height / this.engine.config.arena.height);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    const worldWidth = this.engine.config.arena.width * scale;
    const worldHeight = this.engine.config.arena.height * scale;
    const left = rect.left + (rect.width - worldWidth) / 2;
    const top = rect.top + (rect.height - worldHeight) / 2;
    const x = (clientX - left) / scale;
    const y = (clientY - top) / scale;
    if (!clamp && (x < 0 || y < 0 || x > this.engine.config.arena.width || y > this.engine.config.arena.height)) return null;
    return {
      x: Math.max(0, Math.min(this.engine.config.arena.width, x)),
      y: Math.max(0, Math.min(this.engine.config.arena.height, y)),
    };
  }
}
