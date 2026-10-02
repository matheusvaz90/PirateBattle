import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client.ts';
import { toMatchRecord } from '../api/contracts.ts';
import type { MatchRecord, RegistrationResponse } from '../api/contracts.ts';
import { DataContext } from '../api/dataContext.ts';
import type { DataState, PendingEntry } from '../api/dataContext.ts';
import type { MatchResult } from '../game/types.ts';
import { ScenarioController } from '../mocks/scenarios.ts';
import type { NetworkScenario } from '../mocks/scenarios.ts';
import { loadPlayer } from '../storage/identity.ts';
import { acknowledgeMatch, clearReceipts, persistPending, readPending, readReceipts } from '../storage/submissions.ts';

function initialData(): DataState {
  const player = loadPlayer();
  let pending: PendingEntry[] = [];
  let receipts: string[] = [];
  let scenario: NetworkScenario = 'success';
  let warning = player.error;
  try {
    pending = readPending().map((record) => ({ record, sending: false, durable: true, error: null }));
    receipts = readReceipts();
    scenario = new ScenarioController(window.localStorage).get();
  } catch (error: unknown) { warning = errorMessage(error); }
  return { player: player.value, pending, receipts, scenario, network: 'starting', networkError: null, warning };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState(initialData);
  const [setupAttempt, setSetupAttempt] = useState(0);
  const [player] = useState(state.player);
  const pending = useRef<PendingEntry[]>([...state.pending]);
  const receipts = useRef<string[]>([...state.receipts]);
  const inFlight = useRef(new Set<string>());

  const refreshData = useCallback(async () => {
    await Promise.all(['ranking', 'history'].map((resource) => queryClient.cancelQueries({ queryKey: [resource] })));
    await Promise.all(['ranking', 'history'].map((resource) => queryClient.invalidateQueries({ queryKey: [resource] })));
  }, [queryClient]);

  const { mutateAsync } = useMutation<RegistrationResponse, Error, MatchRecord>({
    mutationKey: ['register-match'], mutationFn: api.register, retry: false,
    onSuccess: refreshData,
  });

  const publish = useCallback(() => {
    const nextPending = [...pending.current];
    const nextReceipts = [...receipts.current];
    setState((previous) => ({ ...previous, pending: nextPending, receipts: nextReceipts }));
  }, []);

  const updateEntry = useCallback((matchId: string, patch: Partial<Omit<PendingEntry, 'record'>>) => {
    pending.current = pending.current.map((entry) => entry.record.matchId === matchId ? { ...entry, ...patch } : entry);
    publish();
  }, [publish]);

  const send = useCallback(async (record: MatchRecord) => {
    if (inFlight.current.has(record.matchId)) return;
    inFlight.current.add(record.matchId);
    updateEntry(record.matchId, { sending: true, error: null });
    let durable = false;
    let confirmed = false;
    try {
      persistPending(record);
      durable = true;
      updateEntry(record.matchId, { durable: true });
      await mutateAsync(record);
      confirmed = true;
      acknowledgeMatch(record.matchId);
      receipts.current = Array.from(new Set([...receipts.current, record.matchId]));
      pending.current = pending.current.filter((entry) => entry.record.matchId !== record.matchId);
      publish();
    } catch (error: unknown) {
      const message = !durable ? 'Não foi possível colocar esta partida na fila do armazenamento do navegador. Mantenha esta aba aberta e tente novamente.'
        : confirmed ? 'A API confirmou esta partida, mas a confirmação local não pôde ser salva. Tente novamente para concluir o registro.' : errorMessage(error);
      updateEntry(record.matchId, { sending: false, durable, error: message });
    } finally { inFlight.current.delete(record.matchId); }
  }, [mutateAsync, publish, updateEntry]);

  const enqueue = useCallback((result: MatchResult) => {
    try {
      const record = toMatchRecord(result, player);
      if (receipts.current.includes(record.matchId) && !pending.current.some((entry) => entry.record.matchId === record.matchId)) return;
      if (!pending.current.some((entry) => entry.record.matchId === record.matchId)) {
        pending.current = [...pending.current, { record, durable: false, sending: false, error: null }];
        publish();
      }
      void send(record);
    } catch (error: unknown) { setState((previous) => ({ ...previous, warning: errorMessage(error) })); }
  }, [player, publish, send]);

  const retry = useCallback((matchId: string) => {
    const entry = pending.current.find((item) => item.record.matchId === matchId);
    if (entry) void send(entry.record);
  }, [send]);

  const retryAll = useCallback(() => { pending.current.forEach((entry) => { void send(entry.record); }); }, [send]);

  useEffect(() => {
    let active = true;
    void api.ready().then(() => {
      if (!active) return;
      setState((previous) => ({ ...previous, network: 'ready', networkError: null }));
      pending.current.forEach((entry) => { void send(entry.record); });
    }).catch((error: unknown) => {
      if (active) setState((previous) => ({ ...previous, network: 'error', networkError: errorMessage(error) }));
    });
    return () => { active = false; };
  }, [send, setupAttempt]);

  const setScenario = useCallback(async (scenario: NetworkScenario) => {
    try {
      await Promise.all(['ranking', 'history'].map((resource) => queryClient.cancelQueries({ queryKey: [resource] })));
      const { setMockScenario } = await import('../mocks/browser.ts');
      setMockScenario(scenario);
      setState((previous) => ({ ...previous, scenario, warning: null }));
      await refreshData();
    } catch (error: unknown) { setState((previous) => ({ ...previous, warning: errorMessage(error) })); }
  }, [queryClient, refreshData]);

  const resetDemoData = useCallback(async () => {
    if (inFlight.current.size > 0) return;
    try {
      await Promise.all(['ranking', 'history'].map((resource) => queryClient.cancelQueries({ queryKey: [resource] })));
      const { resetMockData } = await import('../mocks/browser.ts');
      if (inFlight.current.size > 0) return;
      resetMockData();
      clearReceipts();
      receipts.current = [];
      api.resetRevision();
      setState((previous) => ({ ...previous, scenario: 'success', receipts: [], warning: null }));
      await refreshData();
    } catch (error: unknown) { setState((previous) => ({ ...previous, warning: errorMessage(error) })); }
  }, [queryClient, refreshData]);

  const retrySetup = useCallback(() => {
    setState((previous) => ({ ...previous, network: 'starting', networkError: null }));
    setSetupAttempt((attempt) => attempt + 1);
  }, []);

  return <DataContext.Provider value={{ ...state, enqueue, retry, retryAll, setScenario, resetDemoData, retrySetup }}>{children}</DataContext.Provider>;
}
