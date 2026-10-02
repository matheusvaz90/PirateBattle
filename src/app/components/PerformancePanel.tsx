import { useState, useSyncExternalStore } from 'react';
import { downloadProfile, profileRegistry, profilingEnabled, readHeap } from '../profiling.ts';

function formatNumber(value: number | null): string { return value === null ? 'Não medido' : value.toFixed(2); }
function heapLabel(bytes: number | undefined): string { return bytes === undefined ? 'Indisponível' : `${(bytes / 1024 / 1024).toFixed(1)} MiB`; }

export function PerformancePanel() {
  const snapshot = useSyncExternalStore(profileRegistry.subscribe, profileRegistry.getSnapshot, profileRegistry.getSnapshot);
  const [hardware, setHardware] = useState('');
  const [label, setLabel] = useState('Referência aquecida');
  if (!profilingEnabled) return null;
  const liveResources = Object.values(snapshot.resources).reduce((total, count) => total + count, 0);

  return <details className="network-panel performance-panel" open>
    <summary>Evidências de desempenho</summary>
    <p>Meta: 60 FPS. As medições observam os intervalos do atualizador de quadros, não os tempos da GPU. Apenas o jogo ativo normal é medido; carregamento, pausa e transições são excluídos.</p>
    <label htmlFor="profile-hardware">Hardware de referência (CPU, RAM, GPU e taxa de atualização da tela)</label>
    <input id="profile-hardware" type="text" maxLength={240} value={hardware} onChange={(event) => setHardware(event.target.value)} placeholder="Descreva a máquina de referência antes de exportar" />
    <label htmlFor="checkpoint-label">Nome do ponto de verificação</label>
    <input id="checkpoint-label" type="text" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} />
    <div className="menu-actions">
      <button className="button compact secondary" disabled={!label.trim()} onClick={() => {
        profileRegistry.checkpoint(label.trim(), readHeap(), new Date().toISOString());
        setLabel(`Ciclo ${snapshot.checkpoints.length + 1}`);
      }}>Capturar ponto</button>
      <button className="button compact secondary" onClick={() => { profileRegistry.capture(); }}>Atualizar métricas</button>
      <button className="button compact primary" disabled={!hardware.trim()} onClick={() => downloadProfile(hardware)}>Exportar JSON</button>
    </div>
    <p className="field-help">Execuções concluídas: {snapshot.completedRuns.length} · Recursos do jogo ativos: {liveResources}. Pontos capturados no menu devem mostrar zero recurso após a limpeza.</p>
    <div className="table-wrap"><table aria-label="Execuções de perfil"><thead><tr><th>Execução</th><th>Tempo ativo</th><th>FPS</th><th>Quadro p95</th><th>Pico de entidades</th><th>Cobertura</th></tr></thead>
      <tbody>{snapshot.completedRuns.map((report, index) => <tr key={`${report.matchId}:${index}`}><td>{index + 1}</td><td>{report.activeDuration.toFixed(1)}s</td><td>{formatNumber(report.frames.averageFps)}</td><td>{formatNumber(report.frames.p95FrameMilliseconds)} ms</td><td>{report.peakEntities}</td><td>{report.threeMinuteRun ? 'Execução otimizada de 3 minutos' : 'Execução parcial ou fora da referência'}</td></tr>)}</tbody>
    </table></div>
    {snapshot.checkpoints.length > 0 && <div className="table-wrap"><table aria-label="Pontos de memória"><thead><tr><th>Ponto</th><th>Estimativa do heap JS</th><th>Recursos do jogo</th></tr></thead>
      <tbody>{snapshot.checkpoints.map((checkpoint, index) => <tr key={`${checkpoint.createdAt}:${index}`}><td>{checkpoint.label}</td><td>{heapLabel(checkpoint.heap?.usedJSHeapSize)}</td><td>{Object.values(checkpoint.resources).reduce((total, count) => total + count, 0)}</td></tr>)}</tbody>
    </table></div>}
    <p className="field-help">As estimativas do heap JS são opcionais, dependem do navegador e não incluem a memória da GPU. Os contadores cobrem controladores, escutas de eventos, área de desenho, atualizador de quadros e observadores do jogo, não todos os recursos do navegador ou da API. Use capturas de memória e rastros do DevTools para investigar vazamentos. Os próprios registros de perfil mantêm uma pequena quantidade de memória até a página ser atualizada.</p>
  </details>;
}
