import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { createGameConfig } from '../../game/config.ts';
import { GameEngine } from '../../game/GameEngine.ts';
import { GameRenderer } from '../../game/GameRenderer.ts';
import { InputController } from '../../game/InputController.ts';
import type { GameAction, GameOptions, GameStatus, HudSnapshot, MatchResult } from '../../game/types.ts';
import { PauseDialog } from '../components/PauseDialog.tsx';
import { beginProfile, profileRegistry, readHeap } from '../profiling.ts';
import type { ProfileSession } from '../../game/profiling.ts';

interface Props {
  options: GameOptions;
  matchId: string;
  onComplete: (result: MatchResult) => void;
  onMenu: () => void;
}

const TOUCH_GROUPS: readonly {
  label: string;
  controls: readonly { action: GameAction; label: string; accessibleLabel: string; symbol: string }[];
}[] = [
  {
    label: 'Controles de movimento por toque',
    controls: [
      { action: 'turnLeft', label: 'Esquerda', accessibleLabel: 'Virar à esquerda', symbol: '↶' },
      { action: 'moveForward', label: 'Avançar', accessibleLabel: 'Avançar', symbol: '↑' },
      { action: 'turnRight', label: 'Direita', accessibleLabel: 'Virar à direita', symbol: '↷' },
    ],
  },
  {
    label: 'Controles de ataque por toque',
    controls: [
      { action: 'fireLeft', label: 'Esquerda', accessibleLabel: 'Atirar à esquerda', symbol: '⇐' },
      { action: 'fireFront', label: 'Frente', accessibleLabel: 'Atirar à frente', symbol: '↑' },
      { action: 'fireRight', label: 'Direita', accessibleLabel: 'Atirar à direita', symbol: '⇒' },
    ],
  },
];

const STATUS_LABELS: Readonly<Record<GameStatus, string>> = {
  ready: 'Pronto', running: 'Navegando', paused: 'Pausado', finished: 'Concluído', abandoned: 'Abandonado',
};

export function GameScreen({ options, matchId, onComplete, onMenu }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputController | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<HudSnapshot>({
    status: 'ready', remainingSeconds: options.sessionTime, health: 100, maxHealth: 100, score: 0,
    specialCharge: 0, specialRequired: 5, specialReady: false,
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let active = true;
    let detachTestApi: (() => void) | undefined;
    let engine: GameEngine | null = null;
    let renderer: GameRenderer | null = null;
    let input: InputController | null = null;
    let unsubscribe: (() => void) | undefined;
    let profile: ProfileSession | null = null;
    let releaseHud: (() => void) | undefined;

    async function initialize(hostElement: HTMLDivElement) {
      try {
        const testModule = import.meta.env.MODE === 'test' ? await import('../../test-support/gameTestApi.ts') : null;
        if (!active) return;
        const nextEngine = new GameEngine(createGameConfig(options), matchId, onComplete, testModule?.getGameTestSetup());
        engine = nextEngine;
        profile = beginProfile(matchId, nextEngine.config);
        const nextRenderer = new GameRenderer(nextEngine, hostElement, profile);
        renderer = nextRenderer;
        const nextInput = new InputController(nextEngine, hostElement, profile);
        input = nextInput;
        engineRef.current = nextEngine;
        inputRef.current = nextInput;
        unsubscribe = nextEngine.subscribe((snapshot) => { if (active) setHud(snapshot); });
        releaseHud = profile?.track('subscriptions');
        const ready = await nextRenderer.initialize((value) => { if (active) setProgress(value); });
        if (!active || !ready) return;
        detachTestApi = testModule?.attachGameTestApi(nextEngine, nextRenderer);
        setLoading(false);
        nextEngine.start();
        hostElement.focus({ preventScroll: true });
        if (document.hidden || !document.hasFocus()) nextEngine.pause();
      } catch {
        if (active) {
          setLoading(false);
          setError('Não foi possível carregar a arena. Verifique sua conexão e o suporte do navegador a WebGL, depois tente novamente.');
        }
      }
    }

    void initialize(host);
    return () => {
      active = false;
      detachTestApi?.();
      unsubscribe?.();
      releaseHud?.();
      const lastWorld = engine?.getWorld();
      input?.dispose();
      engine?.dispose();
      renderer?.dispose();
      if (profile && lastWorld) profileRegistry.finish(profile, lastWorld, readHeap());
      if (engineRef.current === engine) engineRef.current = null;
      if (inputRef.current === input) inputRef.current = null;
    };
  }, [options, matchId, onComplete, attempt]);

  function retry() {
    setError(null);
    setLoading(true);
    setProgress(0);
    setAttempt((value) => value + 1);
  }

  function press(event: PointerEvent<HTMLButtonElement>, action: GameAction) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    inputRef.current?.pressPointer(event.pointerId, action);
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    inputRef.current?.releasePointer(event.pointerId);
  }

  const remaining = `${Math.floor(hud.remainingSeconds / 60)}:${String(hud.remainingSeconds % 60).padStart(2, '0')}`;

  return (
    <main className="game-screen">
      <header className="game-header">
        <div><p className="eyebrow">SOBREVIVA À FROTA</p><h1>Pirate Battle</h1></div>
        <div className="header-actions"><button className="button compact secondary" disabled={hud.status !== 'running'} onClick={() => engineRef.current?.pause()}>Pausar</button><button className="button compact secondary" onClick={onMenu}>Menu principal</button></div>
      </header>
      <section className="hud" aria-label="Informações da partida">
        <span className="hud-label">VIDA DO NAVIO <strong data-testid="ship-health">{hud.health} / {hud.maxHealth}</strong></span>
        <span className="hud-label" aria-live="polite" aria-atomic="true">PONTUAÇÃO <strong data-testid="score">{hud.score}</strong></span>
        {options.specialAttackEnabled && <span className={`hud-label special-status${hud.specialReady ? ' ready' : ''}`} aria-live="polite" aria-atomic="true">ESPECIAL <strong data-testid="special-charge">{hud.specialReady ? 'PRONTO' : `${hud.specialCharge} / ${hud.specialRequired}`}</strong></span>}
        <span className="hud-label">TEMPO RESTANTE <strong data-testid="remaining-time">{remaining}</strong></span>
        <span className="status-chip" role="status">{loading ? 'Carregando' : error ? 'Falha ao carregar' : STATUS_LABELS[hud.status]}</span>
      </section>
      <section className="arena-shell" aria-label="Arena do jogo">
        <div className="arena-host" ref={hostRef} tabIndex={0} role="group" aria-label="Controles do navio: W para avançar, A e D para virar, Espaço para atirar à frente, Q e E para atirar à esquerda e à direita, R para usar o especial e Escape para pausar" data-testid="arena" />
        {loading && <div className="arena-overlay" role="status"><p className="eyebrow">PREPARANDO SUA VIAGEM</p><h2>Carregando o mar…</h2><progress value={progress} max={100} aria-label="Progresso do carregamento dos recursos" /><span>{progress}%</span></div>}
        {error && <div className="arena-overlay"><h2>Não foi possível zarpar</h2><p role="alert">{error}</p><button className="button primary" onClick={retry}>Tentar novamente</button></div>}
      </section>
      <footer className="game-footer">
        <div className="control-deck">
          {TOUCH_GROUPS.map((group) => <div key={group.label} className="touch-controls" role="group" aria-label={group.label}>
            {group.controls.map(({ action, label, accessibleLabel, symbol }) => <button key={action} className={`touch-button${action.startsWith('fire') ? ' attack-button' : ''}`} disabled={hud.status !== 'running'} aria-label={accessibleLabel} onPointerDown={(event) => press(event, action)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={(event) => event.preventDefault()}><span aria-hidden="true">{symbol}</span>{label}</button>)}
          </div>)}
          {options.specialAttackEnabled && <div className="touch-controls special-controls" role="group" aria-label="Controle de ataque especial por toque"><button className="touch-button special-button" disabled={hud.status !== 'running' || !hud.specialReady} aria-label="Usar ataque especial" onPointerDown={(event) => press(event, 'specialAttack')} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onContextMenu={(event) => event.preventDefault()}><span aria-hidden="true">✦</span>{hud.specialReady ? 'Especial' : `${hud.specialCharge}/${hud.specialRequired}`}</button></div>}
        </div>
        <p className="game-help"><kbd>W</kbd> Avançar · <kbd>A</kbd> <kbd>D</kbd> Virar · <kbd>Espaço</kbd> Frente · <kbd>Q</kbd> Esquerda · <kbd>E</kbd> Direita · {options.specialAttackEnabled && <><kbd>R</kbd> Usar especial · </>}<kbd>Esc</kbd> Pausar <span>Destrua cinco inimigos com os canhões para carregar o especial. Segure um ataque de canhão para repetir.</span></p>
        <p className="orientation-hint">Vire o celular para o modo paisagem para aproveitar melhor os controles.</p>
      </footer>
      {hud.status === 'paused' && <PauseDialog onResume={() => { inputRef.current?.clear(); engineRef.current?.resume(); hostRef.current?.focus({ preventScroll: true }); }} onMenu={onMenu} />}
    </main>
  );
}
