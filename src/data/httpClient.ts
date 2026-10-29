import {
  Snapshot as SnapshotSchema,
  RefreshAccepted,
  RefreshRun as RefreshRunSchema,
} from '@/data/schema';
import { ApiError, DataFormatError } from '@/data/errors';
import type { DataClient, RefreshStart, SnapshotResult } from '@/data/client';
import { config } from '@/lib/config';

function issuePaths(error: { issues: { path: PropertyKey[] }[] }) {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function httpError(status: number, body: unknown, fallback: string) {
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    body.error &&
    typeof body.error === 'object' &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  ) {
    const code =
      'code' in body.error && typeof body.error.code === 'string'
        ? body.error.code
        : `HTTP_${status}`;
    return new ApiError(body.error.message, code);
  }
  return new ApiError(fallback, `HTTP_${status}`);
}

export class HttpClient implements DataClient {
  private etag: string | undefined;

  constructor(private readonly baseUrl: string) {}

  async getSnapshot(etag?: string): Promise<SnapshotResult> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = etag ?? this.etag;
    if (token) headers['If-None-Match'] = token;
    const response = await fetch(`${this.baseUrl}/snapshot`, { headers });
    if (response.status === 304) return { kind: 'not-modified' };
    const body = await readJson(response);
    if (response.status === 401) throw new ApiError('Sign in required.', 'UNAUTHORIZED');
    if (!response.ok) throw httpError(response.status, body, 'The snapshot could not be loaded.');
    const parsed = SnapshotSchema.safeParse(body);
    if (!parsed.success) {
      console.error(
        'Snapshot failed validation',
        parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
      );
      throw new DataFormatError(
        'The data format changed, so this snapshot could not be read.',
        issuePaths(parsed.error),
      );
    }
    const nextEtag = response.headers.get('ETag') ?? undefined;
    this.etag = nextEtag ?? undefined;
    return { kind: 'ok', snapshot: parsed.data, etag: nextEtag };
  }

  async startRefresh(triggeredBy: string): Promise<RefreshStart> {
    const response = await fetch(`${this.baseUrl}/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggeredBy }),
    });
    const body = await readJson(response);
    if (response.status === 409) {
      const parsed = RefreshAccepted.safeParse(body);
      if (!parsed.success) throw httpError(response.status, body, 'A refresh is already running.');
      return { kind: 'conflict', ...parsed.data };
    }
    if (!response.ok) throw httpError(response.status, body, 'Refresh could not be started.');
    const parsed = RefreshAccepted.safeParse(body);
    if (!parsed.success) {
      throw new DataFormatError(
        'The refresh response could not be read.',
        issuePaths(parsed.error),
      );
    }
    return { kind: 'accepted', ...parsed.data };
  }

  async getRefresh(runId: string) {
    const response = await fetch(`${this.baseUrl}/refresh/${encodeURIComponent(runId)}`, {
      headers: { Accept: 'application/json' },
    });
    const body = await readJson(response);
    if (!response.ok) throw httpError(response.status, body, 'Refresh status could not be loaded.');
    const parsed = RefreshRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new DataFormatError('The refresh status could not be read.', issuePaths(parsed.error));
    }
    return parsed.data;
  }

  async getRefreshHistory(limit = 10) {
    const response = await fetch(`${this.baseUrl}/refresh/history?limit=${limit}`, {
      headers: { Accept: 'application/json' },
    });
    const body = await readJson(response);
    if (!response.ok)
      throw httpError(response.status, body, 'Refresh history could not be loaded.');
    const parsed = RefreshRunSchema.array().safeParse(body);
    if (!parsed.success) {
      throw new DataFormatError('The refresh history could not be read.', issuePaths(parsed.error));
    }
    return parsed.data;
  }
}

export const httpClient = new HttpClient(config.apiBaseUrl);
