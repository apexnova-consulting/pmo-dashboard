import { RefreshRun, Snapshot } from '../../src/data/schema';
import { jsonError, noStore, type ServerEnv } from './env';
import type { GraphClient } from './graph';
import { allowedUser, canRefresh, demoUser, readSession, type SessionUser } from './session';

export interface ApiDeps {
  env: ServerEnv;
  graph: GraphClient;
  now: () => number;
  log: (code: string, detail: string) => void;
  trigger?: (url: string, body: string) => Promise<number>;
}

const SUMMARY_LIMIT = 2000;

export function truncateSummaries(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as { updates?: unknown };
  if (!Array.isArray(record.updates)) return value;
  return {
    ...record,
    updates: record.updates.map((item) => {
      if (!item || typeof item !== 'object' || !('summary' in item)) return item;
      const summary = (item as { summary?: unknown }).summary;
      if (typeof summary !== 'string' || summary.length <= SUMMARY_LIMIT) return item;
      return { ...item, summary: summary.slice(0, SUMMARY_LIMIT) };
    }),
  };
}

export async function currentUser(
  request: Request,
  deps: ApiDeps,
): Promise<SessionUser | Response> {
  if (deps.env.authMode === 'none' && deps.env.refreshMode === 'mock') return demoUser(deps.env);
  const user = await readSession(request, deps.env.sessionSecret);
  if (!user || !allowedUser(user, deps.env)) {
    return jsonError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return user;
}

export async function getSnapshot(request: Request, deps: ApiDeps): Promise<Response> {
  const user = await currentUser(request, deps);
  if (user instanceof Response) return user;
  let file;
  try {
    file = await deps.graph.read(deps.env.snapshotPath);
  } catch {
    deps.log('SNAPSHOT_READ', deps.env.snapshotPath);
    return jsonError(502, 'SNAPSHOT_READ', 'The snapshot could not be read.');
  }
  if (!file) return jsonError(502, 'SNAPSHOT_MISSING', 'The snapshot file was not found.');
  if (request.headers.get('if-none-match') === file.etag) {
    return new Response(null, { status: 304, headers: { ETag: file.etag, ...noStore() } });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.body);
  } catch {
    deps.log('BAD_SNAPSHOT', 'json');
    return jsonError(502, 'BAD_SNAPSHOT', 'The snapshot file could not be read.');
  }
  const result = Snapshot.safeParse(truncateSummaries(parsed));
  if (!result.success) {
    deps.log(
      'BAD_SNAPSHOT',
      result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(','),
    );
    return jsonError(502, 'BAD_SNAPSHOT', 'The snapshot file did not match the contract.');
  }
  return Response.json(result.data, { headers: { ETag: file.etag, ...noStore() } });
}

interface StatusFile {
  runId?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  progress?: number;
}

async function readJson<T>(deps: ApiDeps, path: string): Promise<T | null> {
  const file = await deps.graph.read(path);
  if (!file) return null;
  try {
    return JSON.parse(file.body) as T;
  } catch {
    return null;
  }
}

export function createRunId(mode: string, now: number): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${mode.replaceAll('-', '')}.${now.toString(36)}.${suffix}`;
}

export function runStartedMs(runId: string): number | null {
  const stamp = runId.split('.')[1];
  if (!stamp) return null;
  const ms = Number.parseInt(stamp, 36);
  return Number.isFinite(ms) ? ms : null;
}

function iso(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export async function postRefresh(request: Request, deps: ApiDeps): Promise<Response> {
  const user = await currentUser(request, deps);
  if (user instanceof Response) return user;
  if (!canRefresh(user, deps.env.refreshRoles)) {
    return jsonError(403, 'FORBIDDEN', 'You do not have a role that can refresh.');
  }
  const status = await readJson<StatusFile>(deps, deps.env.statusPath);
  const started = status?.startedAt ? Date.parse(status.startedAt) : NaN;
  const stillRunning =
    status?.status === 'running' &&
    status.runId &&
    status.startedAt &&
    Number.isFinite(started) &&
    deps.now() - started < deps.env.refreshTimeoutMs;
  if (stillRunning && status?.runId && status.startedAt) {
    return Response.json(
      { runId: status.runId, startedAt: status.startedAt },
      { status: 409, headers: noStore() },
    );
  }
  const now = deps.now();
  const runId = createRunId(deps.env.refreshMode, now);
  const startedAt = iso(now);
  if (deps.env.refreshMode === 'trigger') {
    if (!deps.env.flowUrl)
      return jsonError(502, 'FLOW_TRIGGER', 'The refresh flow is not configured.');
    const trigger =
      deps.trigger ??
      (async (url: string, body: string) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        return response.status;
      });
    let statusCode = 0;
    try {
      statusCode = await trigger(deps.env.flowUrl, JSON.stringify({ runId, startedAt }));
    } catch {
      deps.log('FLOW_TRIGGER', 'request failed');
      return jsonError(502, 'FLOW_TRIGGER', 'The refresh flow did not accept the request.');
    }
    deps.log('FLOW_TRIGGER', String(statusCode));
    if (statusCode < 200 || statusCode >= 300) {
      return jsonError(502, 'FLOW_TRIGGER', 'The refresh flow did not accept the request.');
    }
  }
  return Response.json({ runId, startedAt }, { status: 202, headers: noStore() });
}

export async function getRefresh(
  runId: string,
  request: Request,
  deps: ApiDeps,
): Promise<Response> {
  const user = await currentUser(request, deps);
  if (user instanceof Response) return user;
  const startedMs = runStartedMs(runId);
  const startedAt = startedMs == null ? new Date(deps.now()).toISOString() : iso(startedMs);
  if (runId.startsWith('reloadonly.')) {
    return Response.json(
      {
        runId,
        status: 'succeeded',
        startedAt,
        finishedAt: iso(deps.now()),
        progress: 1,
        message: `Reloaded the latest data; the daily flow updates it at ${deps.env.nextScheduledLabel}.`,
      },
      { headers: noStore() },
    );
  }
  const status = await readJson<StatusFile>(deps, deps.env.statusPath);
  if (status?.runId === runId && status.status && status.startedAt) {
    const runningTooLong =
      status.status === 'running' &&
      deps.now() - Date.parse(status.startedAt) > deps.env.refreshTimeoutMs;
    const body = {
      runId,
      status: runningTooLong ? 'failed' : status.status,
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
      message: runningTooLong ? 'The refresh timed out.' : status.message,
      progress: status.progress,
    };
    const parsed = RefreshRun.safeParse(body);
    if (parsed.success) return Response.json(parsed.data, { headers: noStore() });
  }
  const snapshotFile = await deps.graph.read(deps.env.snapshotPath);
  if (snapshotFile && startedMs != null) {
    try {
      const snapshot = JSON.parse(snapshotFile.body) as { generatedAt?: string };
      if (snapshot.generatedAt && Date.parse(snapshot.generatedAt) > startedMs) {
        return Response.json(
          {
            runId,
            status: 'succeeded',
            startedAt,
            finishedAt: snapshot.generatedAt,
            progress: 1,
          },
          { headers: noStore() },
        );
      }
    } catch {
      deps.log('SNAPSHOT_READ', 'status compare');
    }
  }
  if (startedMs != null && deps.now() - startedMs > deps.env.refreshTimeoutMs) {
    return Response.json(
      { runId, status: 'failed', startedAt, message: 'The refresh timed out.' },
      { headers: noStore() },
    );
  }
  return Response.json(
    { runId, status: 'running', startedAt, progress: 0.2 },
    { headers: noStore() },
  );
}

export async function getHistory(request: Request, deps: ApiDeps): Promise<Response> {
  const user = await currentUser(request, deps);
  if (user instanceof Response) return user;
  const limit = Number(new URL(request.url).searchParams.get('limit') || '10');
  const raw = await readJson<unknown>(deps, deps.env.historyPath);
  const rows = Array.isArray(raw) ? raw : [];
  const parsed = rows
    .map((row) => RefreshRun.safeParse(row))
    .filter((row) => row.success)
    .map((row) => row.data)
    .slice(0, Number.isFinite(limit) ? limit : 10);
  return Response.json(parsed, { headers: noStore() });
}
