import { describe, expect, it, vi } from 'vitest';
import { portfolioFixture } from '../../src/data/mock/portfolioFixture';
import { readServerEnv, type ServerEnv } from './env';
import { fetchWithRetry, MemoryGraph } from './graph';
import { getHistory, getRefresh, getSnapshot, postRefresh, type ApiDeps } from './handlers';
import { signSession, type SessionUser } from './session';

const secret = 'test-session-secret';
const user: SessionUser = {
  sub: 'shuchi',
  email: 'shuchi@example.com',
  name: 'Shuchi',
  groups: [],
  roles: ['pmo-editor'],
};

function env(partial: Partial<ServerEnv> = {}): ServerEnv {
  return {
    ...readServerEnv({}),
    authMode: 'session',
    refreshMode: 'mock',
    sessionSecret: secret,
    refreshRoles: ['pmo-editor'],
    snapshotPath: 'PMO/snapshot.json',
    statusPath: 'PMO/refresh-status.json',
    historyPath: 'PMO/refresh-history.json',
    ...partial,
  };
}

async function authed(path = 'http://localhost/api/snapshot'): Promise<Request> {
  const token = await signSession(user, secret);
  return new Request(path, { headers: { cookie: `pmo_session=${encodeURIComponent(token)}` } });
}

function deps(
  graph: MemoryGraph,
  partial: Partial<ServerEnv> = {},
  log: (code: string, detail: string) => void = () => undefined,
): ApiDeps {
  return { env: env(partial), graph, now: () => Date.parse('2026-10-28T15:00:00Z'), log };
}

describe('api handlers', () => {
  it('returns the snapshot, honors etag, and rejects a bad file', async () => {
    const graph = new MemoryGraph(
      new Map([['PMO/snapshot.json', { body: JSON.stringify(portfolioFixture), etag: '"v2"' }]]),
    );
    const ok = await getSnapshot(await authed(), deps(graph));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('etag')).toBe('"v2"');
    expect(ok.headers.get('cache-control')).toContain('no-store');

    const same = await getSnapshot(
      new Request('http://localhost/api/snapshot', {
        headers: {
          cookie: (await authed()).headers.get('cookie') || '',
          'if-none-match': '"v2"',
        },
      }),
      deps(graph),
    );
    expect(same.status).toBe(304);

    const logs: string[] = [];
    graph.put(
      'PMO/snapshot.json',
      JSON.stringify({
        schemaVersion: 2,
        updates: [{ summary: 'SECRET-EMAIL-BODY do not log this sentence' }],
      }),
      '"bad"',
    );
    const bad = await getSnapshot(
      await authed(),
      deps(graph, {}, (code, detail) => logs.push(`${code} ${detail}`)),
    );
    expect(bad.status).toBe(502);
    const body = (await bad.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BAD_SNAPSHOT');
    expect(JSON.stringify(body)).not.toContain('SECRET-EMAIL-BODY');
    expect(logs.join(' ')).not.toContain('SECRET-EMAIL-BODY');
  });

  it('requires a session', async () => {
    const graph = new MemoryGraph(new Map());
    const response = await getSnapshot(new Request('http://localhost/api/snapshot'), deps(graph));
    expect(response.status).toBe(401);
  });

  it('starts, conflicts, and refuses the wrong role', async () => {
    const graph = new MemoryGraph(
      new Map([
        [
          'PMO/refresh-status.json',
          {
            body: JSON.stringify({
              runId: 'trigger.old.1',
              status: 'running',
              startedAt: '2026-10-28T14:55:00Z',
            }),
            etag: '"s"',
          },
        ],
      ]),
    );
    const conflict = await postRefresh(await authed('http://localhost/api/refresh'), deps(graph));
    expect(conflict.status).toBe(409);

    graph.put(
      'PMO/refresh-status.json',
      JSON.stringify({ runId: 'done', status: 'succeeded', startedAt: '2026-10-28T06:00:00Z' }),
      '"s2"',
    );
    const accepted = await postRefresh(
      await authed('http://localhost/api/refresh'),
      deps(graph, { refreshMode: 'reload-only' }),
    );
    expect(accepted.status).toBe(202);
    const acceptedBody = (await accepted.json()) as { runId: string };
    expect(acceptedBody.runId.startsWith('reloadonly.')).toBe(true);

    const viewer: SessionUser = { ...user, roles: ['reader'], email: 'reader@example.com' };
    const token = await signSession(viewer, secret);
    const forbidden = await postRefresh(
      new Request('http://localhost/api/refresh', {
        method: 'POST',
        headers: { cookie: `pmo_session=${encodeURIComponent(token)}` },
      }),
      deps(graph),
    );
    expect(forbidden.status).toBe(403);
  });

  it('reads run status from the status file and history', async () => {
    const graph = new MemoryGraph(
      new Map([
        [
          'PMO/refresh-status.json',
          {
            body: JSON.stringify({
              runId: 'trigger.abc.1',
              status: 'running',
              startedAt: '2026-10-28T14:00:00-04:00',
              progress: 0.4,
            }),
            etag: '"s"',
          },
        ],
        [
          'PMO/refresh-history.json',
          {
            body: JSON.stringify([
              {
                runId: 'old',
                status: 'succeeded',
                startedAt: '2026-10-27T06:00:00-04:00',
                finishedAt: '2026-10-27T06:02:00-04:00',
              },
            ]),
            etag: '"h"',
          },
        ],
      ]),
    );
    const running = await getRefresh('trigger.abc.1', await authed(), deps(graph));
    expect((await running.json()) as { status: string }).toMatchObject({ status: 'running' });

    const reloaded = await getRefresh('reloadonly.1.x', await authed(), deps(graph));
    const reloadBody = (await reloaded.json()) as { status: string; message: string };
    expect(reloadBody.status).toBe('succeeded');
    expect(reloadBody.message).toMatch(/Reloaded the latest data/);

    const history = await getHistory(
      await authed('http://localhost/api/refresh/history?limit=10'),
      deps(graph),
    );
    expect(await history.json()).toHaveLength(1);
  });

  it('retries a graph 429 once', async () => {
    const wait = vi.fn(async () => undefined);
    const run = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('slow', { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const response = await fetchWithRetry(run, wait);
    expect(response.status).toBe(200);
    expect(wait).toHaveBeenCalledWith(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
