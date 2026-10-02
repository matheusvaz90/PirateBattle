import { useData } from '../../api/dataContext.ts';
import type { MatchResult } from '../../game/types.ts';

export function SubmissionStatus({ result }: { result: MatchResult }) {
  const { pending, receipts, enqueue, retry } = useData();
  const entry = pending.find((item) => item.record.matchId === result.matchId);
  const saved = receipts.includes(result.matchId) && !entry;
  return <section className="registration-status" aria-label="Registro da partida">
    <p role="status">{saved ? 'Partida registrada com sucesso.' : entry?.sending ? 'Registrando partida…' : entry ? 'Registro pendente.' : 'Este resultado local ainda não foi registrado.'}</p>
    {entry?.error && <p className="form-error" role="alert">{entry.error}</p>}
    {entry && !entry.durable && <p className="field-help">Mantenha esta aba aberta até que o armazenamento do navegador esteja disponível.</p>}
    {!saved && <button className="button compact secondary" disabled={entry?.sending} onClick={() => entry ? retry(result.matchId) : enqueue(result)}>{entry ? 'Tentar registro novamente' : 'Registrar partida'}</button>}
  </section>;
}

export function PendingSubmissions() {
  const { pending, retry, retryAll } = useData();
  if (pending.length === 0) return null;
  return <section className="pending-panel" aria-label="Envios pendentes">
    <div className="data-toolbar"><h2>Partidas pendentes ({pending.length})</h2><button className="button compact secondary" disabled={pending.every((entry) => entry.sending)} onClick={retryAll}>Tentar todas novamente</button></div>
    <p className="field-help">Você pode iniciar outra partida enquanto estes resultados aguardam confirmação. Registros persistentes sobrevivem à atualização da página.</p>
    <ul>{pending.map((entry) => <li key={entry.record.matchId}>
      <div><strong>{entry.record.score} pontos</strong> · {entry.record.activeDuration.toFixed(1)}s · <span>{entry.record.matchId.slice(0, 8)}</span>
        <p className="field-help" role="status">{entry.sending ? 'Enviando…' : entry.error ?? 'Na fila para registro'}</p>
      </div><button className="button compact secondary" disabled={entry.sending} onClick={() => retry(entry.record.matchId)}>Tentar novamente</button>
    </li>)}</ul>
  </section>;
}
