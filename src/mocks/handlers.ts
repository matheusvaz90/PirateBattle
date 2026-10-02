import { delay, http, HttpResponse } from 'msw';
import { isMatchRecord } from '../api/contracts.ts';
import type { PlayerIdentity } from '../api/contracts.ts';
import { createFixtures } from './fixtures.ts';
import type { ScenarioController } from './scenarios.ts';
import type { MockMatchStore } from './storage.ts';

interface Dependencies {
  store: MockMatchStore;
  scenarios: ScenarioController;
  player: () => PlayerIdentity;
  wait?: (milliseconds: number) => Promise<void>;
}

function responseMessage(message: string): string {
  if (message === 'Invalid pagination.') return 'Paginação inválida.';
  if (message === 'Confirmed mock records are invalid. Reset Demo Data to recover.') return 'Os registros simulados confirmados são inválidos. Redefina os dados de demonstração para recuperar.';
  if (message === 'Invalid match registration.') return 'Registro de partida inválido.';
  if (message === 'Match ID already belongs to a different result.') return 'O identificador da partida já pertence a outro resultado.';
  return message;
}

export function createHandlers({ store, scenarios, player, wait = delay }: Dependencies) {
  function pagination(url: URL) {
    const page = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 5);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error('Invalid pagination.');
    return { page, pageSize };
  }

  async function read(request: Request, resource: 'ranking' | 'history') {
    try {
      const url = new URL(request.url);
      const { page, pageSize } = pagination(url);
      const filter = url.searchParams.get(resource === 'ranking' ? 'configurationKey' : 'playerId');
      if (!filter || filter.length > 16000) return HttpResponse.json({ message: 'É necessário informar um filtro de consulta válido.' }, { status: 400 });
      const behavior = scenarios.next(resource);
      const response = store.page(resource, filter, page, pageSize, createFixtures(behavior.scenario, player()));
      await wait(behavior.latency);
      if (behavior.failure === 'connection') return HttpResponse.error();
      if (behavior.failure) return HttpResponse.json({ message: resource === 'ranking' ? 'Falha simulada no ranking.' : 'Falha simulada no histórico.' }, { status: behavior.failure });
      return HttpResponse.json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Mock query failed.';
      return HttpResponse.json({ message: responseMessage(message) }, { status: message === 'Invalid pagination.' ? 400 : 500 });
    }
  }

  return [
    http.get(/\/api\/ranking$/, ({ request }) => read(request, 'ranking')),
    http.get(/\/api\/history$/, ({ request }) => read(request, 'history')),
    http.post(/\/api\/matches$/, async ({ request }) => {
      let body: unknown;
      try { body = await request.json(); } catch { return HttpResponse.json({ message: 'É necessário enviar um registro de partida em JSON.' }, { status: 400 }); }
      if (!isMatchRecord(body)) return HttpResponse.json({ message: 'Registro de partida inválido.' }, { status: 400 });
      try {
        const behavior = scenarios.next('registration');
        if (behavior.failure || behavior.scenario === 'timeout') {
          await wait(behavior.latency);
          return behavior.failure === 'connection' ? HttpResponse.error() : HttpResponse.json({ message: 'Falha simulada no registro.' }, { status: behavior.failure ?? 504 });
        }
        const response = store.register(body);
        await wait(behavior.latency);
        return HttpResponse.json(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Mock registration failed.';
        return HttpResponse.json({ message: responseMessage(message) }, { status: message.includes('different result') ? 409 : message === 'Invalid match registration.' ? 400 : 500 });
      }
    }),
  ];
}
