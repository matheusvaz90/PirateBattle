import { useData } from '../../api/dataContext.ts';
import { isNetworkScenario, NETWORK_SCENARIOS } from '../../mocks/scenarios.ts';

export function NetworkPanel() {
  const data = useData();
  const networkLabel = data.network === 'starting' ? 'iniciando' : data.network === 'ready' ? 'pronta' : 'com erro';
  return <details className="network-panel">
    <summary>Cenários de rede</summary>
    <p>O MSW intercepta localmente as consultas de ranking e histórico. Os outros jogadores são dados de demonstração. Nenhum backend externo é utilizado.</p>
    <label htmlFor="network-scenario">Cenário de rede</label>
    <select id="network-scenario" value={data.scenario} onChange={(event) => { if (isNetworkScenario(event.target.value)) void data.setScenario(event.target.value); }}>
      {NETWORK_SCENARIOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
    <p className="field-help">Vazio oculta os dados de demonstração, mas mantém as partidas confirmadas. Várias páginas inclui um histórico de demonstração para o Captain. Trocar de cenário preserva partidas confirmadas e pendentes.</p>
    <button className="button compact secondary" disabled={data.pending.some((entry) => entry.sending)} onClick={() => { void data.resetDemoData(); }}>Redefinir dados de demonstração</button>
    <p className="field-help">A redefinição remove registros simulados confirmados e comprovantes, além de restaurar o cenário Sucesso. Opções, identidade, último resultado e envios pendentes são preservados.</p>
    <p className="field-help" role="status">API simulada: {networkLabel}</p>
    {data.networkError && <p className="form-error" role="alert">{data.networkError}</p>}
    {data.network === 'error' && <button className="button compact secondary" onClick={data.retrySetup}>Tentar configurar API</button>}
    {data.warning && <p className="form-error" role="alert">{data.warning}</p>}
  </details>;
}
