import type { GameEngine } from '../game/GameEngine.ts';
import type { GameEvent, GameStatus, HudSnapshot } from '../game/types.ts';

const SOUND_FILES = {
  ambience: 'ocean_ambience_loop.wav',
  broadside: 'cannon_broadside.wav',
  cannon1: 'cannon_fire_1.wav',
  cannon2: 'cannon_fire_2.wav',
  cannon3: 'cannon_fire_3.wav',
  complete: 'game_complete.wav',
  explosion1: 'ship_explosion_1.wav',
  explosion2: 'ship_explosion_2.wav',
  gameOver: 'game_over.wav',
  gameStart: 'game_start.wav',
  healthLow: 'health_low.wav',
  pause: 'game_pause.wav',
  resume: 'game_resume.wav',
  score: 'score_point.wav',
  shipCollision: 'ship_collision.wav',
  sinking: 'ship_sinking.wav',
  timeWarning: 'time_warning.wav',
  uiBack: 'ui_back.wav',
  uiClick: 'ui_click.wav',
  uiOpen: 'ui_open.wav',
  waterHit1: 'cannonball_water_hit_1.wav',
  waterHit2: 'cannonball_water_hit_2.wav',
  woodHit1: 'ship_wood_hit_1.wav',
  woodHit2: 'ship_wood_hit_2.wav',
} as const;

type SoundName = keyof typeof SOUND_FILES;
export type InterfaceSound = 'uiBack' | 'uiClick' | 'uiOpen';

export interface SoundCue {
  readonly sound: SoundName;
  readonly gain?: number;
  readonly playbackRate?: number;
}

export function soundCuesForEvent(event: GameEvent, variation = 0): readonly SoundCue[] {
  if (event.type === 'weaponFired') {
    if (event.weapon === 'left' || event.weapon === 'right') return [{ sound: 'broadside', gain: 0.68 }];
    const sound = (['cannon1', 'cannon2', 'cannon3'] as const)[variation % 3] ?? 'cannon1';
    return [{ sound, gain: event.faction === 'enemy' ? 0.42 : 0.58 }];
  }
  if (event.type === 'projectileImpact') {
    if (event.target === 'terrain') return [{ sound: variation % 2 === 0 ? 'waterHit1' : 'waterHit2', gain: 0.32 }];
    return [{ sound: variation % 2 === 0 ? 'woodHit1' : 'woodHit2', gain: 0.46 }];
  }
  if (event.type === 'enemyDestroyed') {
    return event.cause === 'cannon'
      ? [{ sound: variation % 2 === 0 ? 'explosion1' : 'explosion2', gain: 0.62 }, { sound: 'score', gain: 0.42 }]
      : [{ sound: 'explosion1', gain: 0.58 }];
  }
  if (event.type === 'playerDamaged' && event.cause === 'collision') return [{ sound: 'shipCollision', gain: 0.7 }];
  if (event.type === 'healthCollected') return [{ sound: 'score', gain: 0.4, playbackRate: 1.35 }];
  if (event.type === 'specialActivated') return [{ sound: 'explosion2', gain: 0.85, playbackRate: 0.78 }];
  return [];
}

export class AudioController {
  private readonly root: string;
  private enabled: boolean;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGeneration = 0;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly loading = new Map<SoundName, Promise<AudioBuffer | null>>();
  private readonly abortController = new AbortController();
  private readonly activeSources = new Map<AudioBufferSourceNode, { readonly gain: GainNode; readonly session: number | null; readonly terminal: number | null }>();
  private variation = 0;
  private sessionGeneration = 0;
  private terminalGeneration = 0;
  private playbackEpoch = 0;
  private attachedStatus: GameStatus = 'ready';
  private lowHealthPlayed = false;
  private timeWarningPlayed = false;
  private disposed = false;

  constructor(enabled: boolean, baseUrl = import.meta.env.BASE_URL) {
    this.enabled = enabled;
    this.root = `${baseUrl}assets/sounds/`;
  }

  async unlock(): Promise<boolean> {
    if (!this.enabled || this.disposed || typeof window === 'undefined' || !window.AudioContext) return false;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.78;
        this.master.connect(this.context.destination);
        this.ambienceGain = this.context.createGain();
        this.ambienceGain.gain.value = 0.16;
        this.ambienceGain.connect(this.master);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      void this.preload();
      return true;
    } catch {
      return false;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.playbackEpoch += 1;
      this.stopSources(() => true);
      this.stopAmbience();
      if (this.master && this.context) this.master.gain.setValueAtTime(0, this.context.currentTime);
      return;
    }
    if (this.master && this.context) this.master.gain.setValueAtTime(0.78, this.context.currentTime);
    void this.unlock();
    if (this.attachedStatus === 'running') this.startAmbience();
  }

  playInterface(sound: InterfaceSound): void {
    this.play({ sound, gain: 0.34 });
  }

  attach(engine: GameEngine): () => void {
    this.terminalGeneration = 0;
    this.stopSources((active) => active.terminal !== null);
    const generation = ++this.sessionGeneration;
    this.attachedStatus = engine.getHud().status;
    this.lowHealthPlayed = false;
    this.timeWarningPlayed = false;
    const unsubscribeEvents = engine.subscribeEvents((event) => this.handleEvent(event, generation));
    const unsubscribeHud = engine.subscribe((hud) => this.handleHud(hud, generation));
    return () => {
      unsubscribeEvents();
      unsubscribeHud();
      this.stopSources((active) => active.session === generation);
      if (this.sessionGeneration === generation) this.sessionGeneration += 1;
      this.stopAmbience();
      this.attachedStatus = 'ready';
    };
  }

  dispose(): void {
    if (this.disposed) return;
    if (!this.context && this.loading.size === 0) return;
    this.disposed = true;
    this.abortController.abort();
    this.stopSources(() => true);
    this.stopAmbience();
    this.buffers.clear();
    this.loading.clear();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.ambienceGain = null;
    if (context && context.state !== 'closed') void context.close();
  }

  private handleEvent(event: GameEvent, generation: number): void {
    if (event.type === 'statusChanged') {
      const previous = this.attachedStatus;
      this.attachedStatus = event.status;
      if (event.status === 'running') {
        this.play({ sound: previous === 'paused' ? 'resume' : 'gameStart', gain: 0.48 }, generation);
        this.startAmbience();
      } else if (event.status === 'paused') {
        this.stopAmbience();
        this.play({ sound: 'pause', gain: 0.42 }, generation);
      } else if (event.status === 'finished') {
        this.stopAmbience();
        if (event.endReason === 'death') {
          this.terminalGeneration = generation;
          this.play({ sound: 'sinking', gain: 0.64 }, null, generation);
          this.play({ sound: 'gameOver', gain: 0.55 }, null, generation);
        } else {
          this.terminalGeneration = generation;
          this.play({ sound: 'complete', gain: 0.56 }, null, generation);
        }
      } else if (event.status === 'abandoned') {
        this.stopAmbience();
      }
      return;
    }
    const cues = soundCuesForEvent(event, this.variation);
    this.variation += 1;
    cues.forEach((cue) => this.play(cue, generation));
    if (event.type === 'playerDamaged' && !this.lowHealthPlayed && event.health > 0 && event.health / event.maxHealth <= 0.25) {
      this.lowHealthPlayed = true;
      this.play({ sound: 'healthLow', gain: 0.52 }, generation);
    }
  }

  private handleHud(hud: HudSnapshot, generation: number): void {
    if (hud.status === 'running' && !this.timeWarningPlayed && hud.remainingSeconds <= 10) {
      this.timeWarningPlayed = true;
      this.play({ sound: 'timeWarning', gain: 0.48 }, generation);
    }
  }

  private play(cue: SoundCue, session: number | null = null, terminal: number | null = null): void {
    if (!this.enabled || this.disposed) return;
    void this.playLoaded(cue, session, terminal, this.playbackEpoch);
  }

  private async playLoaded(cue: SoundCue, session: number | null, terminal: number | null, epoch: number): Promise<void> {
    if (!await this.unlock()) return;
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.enabled || this.disposed || epoch !== this.playbackEpoch || (session !== null && session !== this.sessionGeneration) || (terminal !== null && terminal !== this.terminalGeneration)) return;
    const buffer = await this.load(cue.sound);
    if (!buffer || !this.enabled || this.disposed || epoch !== this.playbackEpoch || (session !== null && session !== this.sessionGeneration) || (terminal !== null && terminal !== this.terminalGeneration)) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = cue.playbackRate ?? 1;
    gain.gain.value = cue.gain ?? 0.5;
    source.connect(gain);
    gain.connect(master);
    this.activeSources.set(source, { gain, session, terminal });
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.activeSources.delete(source);
    };
    source.start();
  }

  private stopSources(predicate: (active: { readonly session: number | null; readonly terminal: number | null }) => boolean): void {
    for (const [source, active] of this.activeSources) {
      if (!predicate(active)) continue;
      source.onended = null;
      source.stop();
      source.disconnect();
      active.gain.disconnect();
      this.activeSources.delete(source);
    }
  }

  private startAmbience(): void {
    if (!this.enabled || this.ambienceSource || this.disposed) return;
    const generation = ++this.ambienceGeneration;
    void this.startLoadedAmbience(generation);
  }

  private async startLoadedAmbience(generation: number): Promise<void> {
    if (!await this.unlock()) return;
    const buffer = await this.load('ambience');
    const context = this.context;
    if (!buffer || !context || !this.ambienceGain || !this.enabled || this.disposed || generation !== this.ambienceGeneration || this.ambienceSource) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.ambienceGain);
    source.start();
    source.onended = () => { if (this.ambienceSource === source) this.ambienceSource = null; };
    this.ambienceSource = source;
  }

  private stopAmbience(): void {
    this.ambienceGeneration += 1;
    if (!this.ambienceSource) return;
    this.ambienceSource.stop();
    this.ambienceSource.disconnect();
    this.ambienceSource = null;
  }

  private async preload(): Promise<void> {
    await Promise.all((Object.keys(SOUND_FILES) as SoundName[]).map((sound) => this.load(sound)));
  }

  private load(sound: SoundName): Promise<AudioBuffer | null> {
    const existing = this.buffers.get(sound);
    if (existing) return Promise.resolve(existing);
    const pending = this.loading.get(sound);
    if (pending) return pending;
    const loading = this.fetchBuffer(sound);
    this.loading.set(sound, loading);
    return loading;
  }

  private async fetchBuffer(sound: SoundName): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(`${this.root}${SOUND_FILES[sound]}`, { signal: this.abortController.signal });
      if (!response.ok || !this.context || this.disposed) return null;
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      if (this.disposed) return null;
      this.buffers.set(sound, buffer);
      return buffer;
    } catch {
      return null;
    } finally {
      this.loading.delete(sound);
    }
  }
}
