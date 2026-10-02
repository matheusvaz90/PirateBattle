import axios from 'axios';
import { isRecord } from '../game/config.ts';
import { isMatchPage, isRegistrationResponse, PAGE_SIZE, REQUEST_TIMEOUT, sameRegistration } from './contracts.ts';
import type { MatchPage, MatchRecord, RegistrationResponse } from './contracts.ts';

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<unknown>(error)) {
    if (error.code === 'ECONNABORTED') return 'A requisição excedeu o tempo limite. A partida pode já estar salva; tentar novamente não criará uma duplicata.';
    const body = error.response?.data;
    if (isRecord(body) && typeof body.message === 'string') return body.message;
    return 'Não foi possível acessar a API simulada. Seus resultados pendentes foram mantidos para uma nova tentativa.';
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir a requisição.';
}

export function retryQuery(failures: number, error: unknown): boolean {
  return failures < 1 && axios.isAxiosError<unknown>(error) && (error.response === undefined || error.response.status >= 500);
}

export function createApiClient(baseURL: string, ready: () => Promise<void>) {
  const http = axios.create({ baseURL, timeout: REQUEST_TIMEOUT, proxy: false });
  let latestRevision = 0;

  async function page(resource: 'ranking' | 'history', filter: string, requestedPage: number, signal: AbortSignal): Promise<MatchPage> {
    await ready();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await http.get<unknown>(resource, { signal, params: { page: requestedPage, pageSize: PAGE_SIZE, [resource === 'ranking' ? 'configurationKey' : 'playerId']: filter } });
      const body = response.data;
      if (!isMatchPage(body) || body.page !== requestedPage || body.pageSize !== PAGE_SIZE
        || !body.items.every((record) => resource === 'ranking' ? record.configurationKey === filter : record.playerId === filter)) throw new Error('A API retornou uma página inválida.');
      if (body.revision < latestRevision) continue;
      latestRevision = Math.max(latestRevision, body.revision);
      return body;
    }
    throw new Error('Uma resposta desatualizada da API foi descartada. Atualize para tentar novamente.');
  }

  async function register(record: MatchRecord): Promise<RegistrationResponse> {
    await ready();
    const response = await http.post<unknown>('matches', record);
    if (!isRegistrationResponse(response.data) || !sameRegistration(response.data.record, record)) throw new Error('A API retornou uma confirmação de registro inválida.');
    latestRevision = Math.max(latestRevision, response.data.revision);
    return response.data;
  }

  return { ready, page, register, resetRevision: () => { latestRevision = 0; } };
}

export const api = createApiClient(`${import.meta.env?.BASE_URL ?? '/'}api/`, async () => {
  const { startApiMocks } = await import('../mocks/browser.ts');
  await startApiMocks();
});
