import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../api/dataContext.ts';
import { createId } from '../storage/identity.ts';
import type { GameOptions, MatchResult } from '../game/types.ts';
import { loadLastResult, loadOptions, saveLastResult, saveOptions } from '../storage/preferences.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { OptionsScreen } from './screens/OptionsScreen.tsx';
import { MatchTabs } from './components/MatchTabs.tsx';
import { NetworkPanel } from './components/NetworkPanel.tsx';
import { PendingSubmissions, SubmissionStatus } from './components/SubmissionStatus.tsx';
import { PerformancePanel } from './components/PerformancePanel.tsx';

type Screen = { type: 'menu' } | { type: 'options' } | { type: 'game'; matchId: string } | { type: 'result'; result: MatchResult };

export function App() {
  const { enqueue, player } = useData();
  const [initialStorage] = useState(() => ({ options: loadOptions(), result: loadLastResult() }));
  const [options, setOptions] = useState(initialStorage.options.value);
  const [lastResult, setLastResult] = useState(initialStorage.result.value);
  const [screen, setScreen] = useState<Screen>(() => initialStorage.result.value
    ? { type: 'result', result: initialStorage.result.value }
    : { type: 'menu' });
  const [notice, setNotice] = useState<string | null>(initialStorage.options.error ?? initialStorage.result.error);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (screen.type !== 'game') mainRef.current?.focus();
  }, [screen.type]);

  const completeMatch = useCallback((result: MatchResult) => {
    enqueue(result);
    const error = saveLastResult(result);
    setNotice(error);
    setLastResult(result);
    setScreen({ type: 'result', result });
  }, [enqueue]);

  function play() {
    setScreen({ type: 'game', matchId: createId() });
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
    return <GameScreen key={screen.matchId} options={options} matchId={screen.matchId} onComplete={completeMatch} onMenu={() => setScreen({ type: 'menu' })} />;
  }

  return (
    <main className="app-shell" ref={mainRef} tabIndex={-1}>
      <header className="site-header">
        <button className="brand" onClick={() => setScreen({ type: 'menu' })} aria-label="Menu principal do Pirate Battle">
          <span className="brand-mark" aria-hidden="true">PB</span><span>PIRATE BATTLE</span>
        </button>
        <span className="build-label">CAPITÃO: {player.playerName.toUpperCase()}</span>
      </header>
      {notice && <p className="notice" role="alert">{notice}</p>}
      {screen.type === 'options' && <OptionsScreen options={options} onSave={persistOptions} onCancel={() => setScreen({ type: 'menu' })} />}
      {screen.type === 'menu' && (
        <>
          <section className="menu-hero">
            <div className="hero-copy">
              <p className="eyebrow">O MAR ABERTO ESTÁ CHAMANDO</p>
              <h1>Um capitão.<br />Um mar aberto.<br /><em>Sua próxima aventura.</em></h1>
              <p className="hero-description">Assuma o leme, navegue ao redor da ilha e sobreviva à frota inimiga. Afunde navios com o canhão frontal e os ataques laterais.</p>
              <div className="menu-actions">
                <button className="button primary" onClick={play}>Jogar <span aria-hidden="true">↗</span></button>
                <button className="button secondary" onClick={() => setScreen({ type: 'options' })}>Opções</button>
              </div>
              <div className="session-summary"><span>PARTIDA <strong>{options.sessionTime}s</strong></span><span>INTERVALO DE INIMIGOS <strong>{options.enemySpawnTime}s</strong></span></div>
              {lastResult && <button className="text-button" onClick={() => setScreen({ type: 'result', result: lastResult })}>Ver último resultado →</button>}
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="compass-ring ring-outer" /><div className="compass-ring ring-inner" />
              <span className="compass-north">N</span><span className="compass-south">S</span>
              <img className="hero-ship" src={`${import.meta.env.BASE_URL}assets/png/default/ships/ship_5.png`} alt="" />
              <span className="chart-label">ÁGUAS INEXPLORADAS</span>
            </div>
          </section>
          <section className="control-guide" aria-labelledby="controls-heading">
             <div><p className="eyebrow">APRENDA OS CONTROLES</p><h2 id="controls-heading">Você está no comando.</h2><p>Combine movimento e rotação. No celular, vire o aparelho de lado e use os botões de toque.</p></div>
            <dl className="key-guide">
               <div><dt><kbd>W</kbd> / <kbd>↑</kbd></dt><dd>Avançar</dd></div>
               <div><dt><kbd>A</kbd> <kbd>D</kbd></dt><dd>Virar à esquerda / direita</dd></div>
               <div><dt><kbd>Espaço</kbd> <kbd>Q</kbd> <kbd>E</kbd></dt><dd>Atirar à frente / esquerda / direita</dd></div>
               <div><dt><kbd>R</kbd></dt><dd>Usar o especial após afundar 5 inimigos</dd></div>
               <div><dt><kbd>Esc</kbd></dt><dd>Pausar</dd></div>
            </dl>
          </section>
          <PendingSubmissions />
          <MatchTabs options={options} />
          <NetworkPanel />
          <PerformancePanel />
           <footer className="menu-footer"><span>Velas vermelhas perseguem. Velas com caveira atiram. Cada navio afundado vale 1 ponto.</span><span>REACT + PIXIJS</span></footer>
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
