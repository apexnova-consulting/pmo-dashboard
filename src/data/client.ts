import type { RefreshRun, Snapshot } from '@/data/schema';
import { RefreshRun as RefreshRunSchema } from '@/data/schema';
import { ApiError, DataFormatError } from '@/data/errors';

export interface SnapshotOk {
  kind: 'ok';
  snapshot: Snapshot;
  etag?: string;
}

export interface SnapshotNotModified {
  kind: 'not-modified';
}

export type SnapshotResult = SnapshotOk | SnapshotNotModified;

export interface RefreshStart {
  kind: 'accepted' | 'conflict';
  runId: string;
  startedAt: string;
}

export interface DataClient {
  getSnapshot(etag?: string): Promise<SnapshotResult>;
  startRefresh(triggeredBy: string): Promise<RefreshStart>;
  getRefresh(runId: string): Promise<RefreshRun>;
  getRefreshHistory(limit?: number): Promise<RefreshRun[]>;
}

export function readErrorBody(body: unknown, fallback: string): ApiError {
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    body.error &&
    typeof body.error === 'object' &&
    'message' in body.error &&
    'code' in body.error &&
    typeof body.error.message === 'string' &&
    typeof body.error.code === 'string'
  ) {
    return new ApiError(body.error.message, body.error.code);
  }
  return new ApiError(fallback, 'HTTP');
}

export function parseRefreshRun(body: unknown): RefreshRun {
  const parsed = RefreshRunSchema.safeParse(body);
  if (!parsed.success) {
    throw new DataFormatError(
      'The refresh status could not be read.',
      parsed.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  }
  return parsed.data;
}
