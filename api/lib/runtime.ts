import { readServerEnv, type ServerEnv } from './env';
import { MemoryGraph, SharePointGraph, type GraphClient } from './graph';
import type { ApiDeps } from './handlers';
import { portfolioFixture } from '../../src/data/mock/portfolioFixture';

const memory = new MemoryGraph(
  new Map([
    ['PMO/snapshot.json', { body: JSON.stringify(portfolioFixture), etag: '"portfolio-v2"' }],
    [
      'PMO/refresh-status.json',
      {
        body: JSON.stringify({
          runId: 'mock-idle',
          status: 'succeeded',
          startedAt: '2026-10-28T06:00:00-04:00',
          finishedAt: '2026-10-28T06:02:00-04:00',
        }),
        etag: '"status"',
      },
    ],
    ['PMO/refresh-history.json', { body: '[]', etag: '"history"' }],
  ]),
);

export function graphFor(env: ServerEnv): GraphClient {
  if (env.refreshMode === 'mock' || !env.tenantId || !env.clientId || !env.clientSecret) {
    return memory;
  }
  return new SharePointGraph({
    tenantId: env.tenantId,
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    siteId: env.siteId,
    driveId: env.driveId,
    log: (code, detail) => console.error(code, detail),
  });
}

export function liveDeps(): ApiDeps {
  const env = readServerEnv();
  return {
    env,
    graph: graphFor(env),
    now: () => Date.now(),
    log: (code, detail) => console.error(code, detail),
  };
}
