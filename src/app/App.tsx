import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../api/dataContext.ts';
import { createId } from '../storage/identity.ts';
import type { GameOptions, MatchResult } from '../game/types.ts';
import { AudioController } from '../audio/AudioController.ts';
import { loadAudioEnabled, loadLastResult, loadOptions, saveAudioEnabled, saveLastResult, saveOptions } from '../storage/preferences.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { OptionsScreen } from './screens/OptionsScreen.tsx';
import { MatchTabs } from './components/MatchTabs.tsx';
import { NetworkPanel } from './components/NetworkPanel.tsx';
import { PendingSubmissions, SubmissionStatus } from './components/SubmissionStatus.tsx';
import { PerformancePanel } from './components/PerformancePanel.tsx';

type Screen = { type: 'menu' } | { type: 'options' } | { type: 'game'; matchId: string } | { type: 'result'; result: MatchResult };

export function App() {
  const { enqueue, player } = useData();
  const [initialStorage] = useState(() => ({ options: loadOptions(), result: loadLastResult(), audio: loadAudioEnabled() }));
  const [audio] = useState(() => new AudioController(initialStorage.audio.value));
  const [options, setOptions] = useState(initialStorage.options.value);
  const [soundEnabled, setSoundEnabled] = useState(initialStorage.audio.value);
  const [lastResult, setLastResult] = useState(initialStorage.result.value);
  const [screen, setScreen] = useState<Screen>({ type: 'menu' });
  const [notice, setNotice] = useState<string | null>(initialStorage.options.error ?? initialStorage.result.error ?? initialStorage.audio.error);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (screen.type !== 'game') mainRef.current?.focus();
  }, [screen.type]);

  useEffect(() => () => audio.dispose(), [audio]);

  const completeMatch = useCallback((result: MatchResult) => {
    enqueue(result);
    const error = saveLastResult(result);
    setNotice(error);
    setLastResult(result);
    setScreen({ type: 'result', result });
  }, [enqueue]);

  function play() {
    void audio.unlock();
    audio.playInterface('uiClick');
    setScreen({ type: 'game', matchId: createId() });
  }

  function toggleSound() {
    const next = !soundEnabled;
    audio.setEnabled(next);
    if (next) audio.playInterface('uiOpen');
    setSoundEnabled(next);
    const error = saveAudioEnabled(next);
    if (error) setNotice(error);
  }

  function persistOptions(next: GameOptions): string | null {
    const error = saveOptions(next);
    if (error) return error;
    setOptions(next);
    setNotice(null);
    setScreen({ type: 'menu' });
    return null;
  }

  if (screen.type === 'game') {
    return <GameScreen key={screen.matchId} options={options} matchId={screen.matchId} audio={audio} soundEnabled={soundEnabled} onToggleSound={toggleSound} onComplete={completeMatch} onMenu={() => { audio.playInterface('uiBack'); setScreen({ type: 'menu' }); }} />;
  }

  return (
    <main className="app-shell" ref={mainRef} tabIndex={-1}>
      <header className="site-header">
        <button className="brand" onClick={() => setScreen({ type: 'menu' })} aria-label="Menu principal do Pirate Battle">
          <span className="brand-mark" aria-hidden="true">PB</span><span><strong>PIRATE</strong> BATTLE</span>
        </button>
        {screen.type === 'menu' && <span className="menu-status">ÁGUAS HOSTIS · SOBREVIVA À FROTA</span>}
        <div className="header-meta"><button className="sound-toggle" type="button" aria-pressed={soundEnabled} aria-label="Som" onClick={toggleSound}><span aria-hidden="true">{soundEnabled ? '◖))' : '◖×'}</span>{soundEnabled ? 'SOM ATIVO' : 'SEM SOM'}</button><span className="build-label"><span>CAPITÃO</span>{player.playerName.toUpperCase()}</span></div>
      </header>
      {notice && <p className="notice" role="alert">{notice}</p>}
      {screen.type === 'options' && <OptionsScreen options={options} onSave={persistOptions} onCancel={() => { audio.playInterface('uiBack'); setScreen({ type: 'menu' }); }} />}
      {screen.type === 'menu' && (
        <>
          <section className="menu-hero" id="batalha">
            <div className="game-menu-panel">
              <h1 className="game-menu-title"><img src={`${import.meta.env.BASE_URL}assets/png/retina/ui/menu/title_pirate_battle.png`} alt="Pirate Battle" /></h1>
              <p className="game-menu-mission">ASSUMA O LEME · ROMPA O BLOQUEIO</p>
              <div className="game-menu-actions">
                <button className="game-menu-button primary" aria-label="Jogar" onClick={play}>Jogar</button>
                <button className="game-menu-button secondary" onClick={() => { audio.playInterface('uiOpen'); setScreen({ type: 'options' }); }}>Opções</button>
              </div>
              <div className="mission-summary" aria-label="Configuração da partida">
                <span><strong>{options.sessionTime}s</strong> de batalha</span>
                <span><strong>{options.enemySpawnTime}s</strong> entre inimigos</span>
                <span><strong>5 abates</strong> carregam o especial</span>
              </div>
              <nav className="game-menu-links" aria-label="Atalhos do menu">
                <a href="#comando">Como jogar</a>
                <a href="#ranking">Ranking</a>
                {lastResult && <button onClick={() => setScreen({ type: 'result', result: lastResult })}>Último resultado</button>}
              </nav>
            </div>
          </section>
          <section className="control-guide" id="comando" aria-labelledby="controls-heading">
             <div><p className="eyebrow"><span />DOMINE O CONVÉS</p><h2 id="controls-heading">Você está no comando.</h2><p>No computador, mova o mouse para guiar e segure W para avançar. No celular, arraste sobre a arena e use o deck de canhões abaixo dela.</p></div>
            <dl className="key-guide">
               <div><dt><kbd>W</kbd> / <kbd>↑</kbd></dt><dd>Avançar</dd></div>
               <div><dt><kbd>A</kbd> <kbd>D</kbd></dt><dd>Virar à esquerda / direita</dd></div>
               <div><dt><kbd>Espaço</kbd> <kbd>Q</kbd> <kbd>E</kbd></dt><dd>Atirar à frente / esquerda / direita</dd></div>
               <div><dt><kbd>R</kbd></dt><dd>Usar o especial após afundar 5 inimigos</dd></div>
               <div><dt><kbd>Esc</kbd></dt><dd>Pausar</dd></div>
            </dl>
          </section>
          <PendingSubmissions />
          <div id="ranking"><MatchTabs options={options} /></div>
          <NetworkPanel />
          <PerformancePanel />
           <footer className="menu-footer"><span>Velas vermelhas perseguem. Velas com caveira atiram. Cada navio afundado vale 1 ponto.</span><span>PIRATE BATTLE · 2026</span></footer>
        </>
      )}
      {screen.type === 'result' && (
        <section className="panel result-panel" aria-labelledby="result-heading">
          <p className="eyebrow">VIAGEM CONCLUÍDA</p>
          <h1 id="result-heading">{screen.result.endReason === 'death' ? 'Seu navio afundou.' : 'De volta ao porto.'}</h1>
          <p>{screen.result.endReason === 'death' ? 'Seu navio ficou sem vida. Uma nova viagem espera por você.' : 'Sua partida terminou porque o tempo acabou.'}</p>
          <dl className="result-stats">
            <div><dt>Pontuação</dt><dd>{screen.result.score}</dd></div>
            <div><dt>Tempo jogado</dt><dd>{screen.result.activeDuration.toFixed(1)}s</dd></div>
            <div><dt>Motivo do fim</dt><dd>{screen.result.endReason === 'death' ? 'Navio destruído' : 'Tempo esgotado'}</dd></div>
          </dl>
          <SubmissionStatus result={screen.result} />
          <PendingSubmissions />
          <NetworkPanel />
          <PerformancePanel />
          <div className="menu-actions"><button className="button primary" onClick={play}>Jogar novamente</button><button className="button secondary" onClick={() => setScreen({ type: 'menu' })}>Menu principal</button></div>
        </section>
      )}
    </main>
  );
}
