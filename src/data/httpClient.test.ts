import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HttpClient } from '@/data/httpClient';
import { DataFormatError, ApiError } from '@/data/errors';
import { generateSnapshot } from '@/data/mock/generate';

const snapshot = generateSnapshot('normal');
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('HttpClient', () => {
  const client = new HttpClient('http://pmo.test/api');

  it('parses a snapshot and honors a 304', async () => {
    server.use(
      http.get('http://pmo.test/api/snapshot', ({ request }) => {
        if (request.headers.get('If-None-Match') === '"v1"')
          return new HttpResponse(null, { status: 304 });
        return HttpResponse.json(snapshot, { headers: { ETag: '"v1"' } });
      }),
    );
    const first = await client.getSnapshot();
    expect(first.kind).toBe('ok');
    const second = await client.getSnapshot();
    expect(second.kind).toBe('not-modified');
  });

  it('keeps a format error readable and does not throw a white-screen error type', async () => {
    server.use(
      http.get('http://pmo.test/api/snapshot', () => HttpResponse.json({ schemaVersion: 99 })),
    );
    await expect(client.getSnapshot()).rejects.toBeInstanceOf(DataFormatError);
  });

  it('maps the API error shape and a 409 refresh', async () => {
    server.use(
      http.post('http://pmo.test/api/refresh', () =>
        HttpResponse.json(
          { runId: 'run-9', startedAt: '2026-10-28T12:00:00-04:00' },
          { status: 409 },
        ),
      ),
      http.get('http://pmo.test/api/refresh/history', () =>
        HttpResponse.json(
          { error: { code: 'NOPE', message: 'History unavailable' } },
          { status: 500 },
        ),
      ),
    );
    const refresh = await client.startRefresh('Marta');
    expect(refresh.kind).toBe('conflict');
    await expect(client.getRefreshHistory()).rejects.toMatchObject({
      code: 'NOPE',
    } satisfies Partial<ApiError>);
  });
});
