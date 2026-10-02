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

  clear(): void {
    this.keys.clear();
    this.pointers.clear();
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
}
