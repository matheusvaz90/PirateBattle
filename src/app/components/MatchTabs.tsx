import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../api/client.ts';
import { configurationKey, PAGE_SIZE } from '../../api/contracts.ts';
import { useData } from '../../api/dataContext.ts';
import { createGameConfig } from '../../game/config.ts';
import type { GameOptions } from '../../game/types.ts';

type Tab = 'ranking' | 'history';
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

function MatchList({ resource, filter }: { resource: Tab; filter: string }) {
  const { network, scenario, player } = useData();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const queryKey = [resource, filter, scenario, page];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => api.page(resource, filter, page, signal), enabled: network === 'ready' });
  const data = query.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="data-toolbar"><span>{resource === 'ranking' ? 'Maiores pontuações · mesma configuração' : `Partidas concluídas por ${player.playerName} · datas em UTC`}</span>
        <button className="button compact secondary" disabled={network !== 'ready'} onClick={() => { void queryClient.cancelQueries({ queryKey }).then(() => query.refetch()); }}>Atualizar</button>
      </div>
      {network === 'starting' && <p role="status">Preparando a API simulada…</p>}
      {network === 'error' && <p>A configuração da API está indisponível. Use Tentar configurar API abaixo; ainda é possível jogar.</p>}
      {network === 'ready' && query.isPending && <p role="status">Carregando {resource === 'ranking' ? 'ranking' : 'histórico de partidas'}…</p>}
      {query.isError && <div className="notice"><p role="alert">{errorMessage(query.error)}</p><button className="button compact secondary" onClick={() => { void query.refetch(); }}>Tentar consulta novamente</button></div>}
      {query.isFetching && data && <p className="field-help" role="status">Atualizando em segundo plano…</p>}
      {data && data.items.length === 0 && <p className="empty-state">{resource === 'ranking' ? 'Ainda não há pontuações para esta configuração. Zarpe e conquiste o primeiro lugar.' : 'Ainda não há partidas concluídas. Sua próxima viagem aparecerá aqui.'}</p>}
      {data && data.items.length > 0 && <div className="table-wrap"><table aria-label={resource === 'ranking' ? 'Ranking' : 'Histórico de partidas'}>
        <thead><tr>{resource === 'ranking' && <th scope="col">Posição</th>}<th scope="col">{resource === 'ranking' ? 'Jogador' : 'Data (UTC)'}</th><th scope="col">Pontuação</th><th scope="col">Tempo jogado</th><th scope="col">Motivo do fim</th>{resource === 'history' && <th scope="col">Configurações</th>}</tr></thead>
        <tbody>{data.items.map((record, index) => <tr key={record.matchId} data-match-id={record.matchId}>
          {resource === 'ranking' && <td>{(page - 1) * PAGE_SIZE + index + 1}</td>}
          <td>{resource === 'ranking' ? <>{record.playerName}{record.playerId === player.playerId && <span className="you-badge">Você</span>}</> : <time dateTime={record.completedAt}>{dateFormat.format(Date.parse(record.completedAt))}</time>}</td>
          <td className="table-score">{record.score}</td><td>{record.activeDuration.toFixed(1)}s</td><td>{record.endReason === 'death' ? 'Navio destruído' : 'Tempo esgotado'}</td>
          {resource === 'history' && <td>{record.configuration.sessionTime}s · inimigos a cada {record.configuration.enemySpawnTime}s</td>}
        </tr>)}</tbody>
      </table></div>}
      <nav className="pagination" aria-label={`Paginação do ${resource === 'ranking' ? 'ranking' : 'histórico'}`}>
        <button className="button compact secondary" disabled={page <= 1 || query.isFetching || !data} onClick={() => setPage((value) => value - 1)}>Anterior</button>
        <span>{data ? `Página ${page} de ${pages} · ${data.total} registros` : `Página ${page}`}</span>
        <button className="button compact secondary" disabled={page >= pages || query.isFetching || !data} onClick={() => setPage((value) => value + 1)}>Próxima</button>
      </nav>
    </>
  );
}

export function MatchTabs({ options }: { options: GameOptions }) {
  const [tab, setTab] = useState<Tab>('ranking');
  const { player, scenario } = useData();
  const filter = tab === 'ranking' ? configurationKey(createGameConfig(options)) : player.playerId;
  return <section className="match-data" aria-label="Ranking e histórico de partidas">
    <div className="tab-list" role="tablist" aria-label="Abas de dados das partidas">
      {(['ranking', 'history'] as const).map((value) => <button key={value} id={`${value}-tab`} role="tab" aria-selected={tab === value} aria-controls="match-data-panel" tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const next = value === 'ranking' ? 'history' : 'ranking';
        setTab(next);
        document.getElementById(`${next}-tab`)?.focus();
      }}>{value === 'ranking' ? 'Ranking' : 'Histórico de partidas'}</button>)}
    </div>
    <div id="match-data-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      <p className="field-help">{tab === 'ranking' ? `Comparando a configuração completa: partida de ${options.sessionTime}s · inimigos a cada ${options.enemySpawnTime}s · vida ${options.healthPickupsEnabled ? 'ativada' : 'desativada'} · especial ${options.specialAttackEnabled ? 'ativado' : 'desativado'} · survival-v2.` : `Jogador local: ${player.playerName}. As partidas confirmadas permanecem neste navegador.`}</p>
      <MatchList key={`${tab}:${filter}:${scenario}`} resource={tab} filter={filter} />
    </div>
  </section>;
}
