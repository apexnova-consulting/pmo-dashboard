import { formatInTimeZone } from 'date-fns-tz';
import type { RefreshRun } from '@/data/schema';
import { ApiError, DataFormatError } from '@/data/errors';
import type { DataClient, RefreshStart, SnapshotResult } from '@/data/client';
import { AS_OF, generateSnapshot, TIME_ZONE, type Scenario } from '@/data/mock/generate';

function durationMs(scenario: Scenario) {
  return scenario === 'refresh-reload' || scenario === 'refresh-unchanged' ? 400 : 8000;
}

interface ActiveRun {
  runId: string;
  startedAtMs: number;
  fail: boolean;
  triggeredBy: string;
}

interface Persisted {
  generatedAt: string | null;
  active: ActiveRun | null;
  history: RefreshRun[];
}

const memory = new Map<string, Persisted>();

function seedHistory(): RefreshRun[] {
  const rows: RefreshRun[] = [
    [
      'run-1008',
      '2026-10-28T06:00:00-04:00',
      '2026-10-28T06:02:10-04:00',
      'succeeded',
      'Scheduled',
    ],
    [
      'run-1007',
      '2026-10-27T06:00:00-04:00',
      '2026-10-27T06:01:40-04:00',
      'succeeded',
      'Scheduled',
    ],
    ['run-1006', '2026-10-26T06:00:00-04:00', '2026-10-26T06:04:05-04:00', 'failed', 'Scheduled'],
    ['run-1005', '2026-10-25T06:00:00-04:00', '2026-10-25T06:01:55-04:00', 'succeeded', 'Shuchi'],
    [
      'run-1004',
      '2026-10-24T06:00:00-04:00',
      '2026-10-24T06:02:20-04:00',
      'succeeded',
      'Scheduled',
    ],
    [
      'run-1003',
      '2026-10-23T06:00:00-04:00',
      '2026-10-23T06:01:30-04:00',
      'succeeded',
      'Scheduled',
    ],
  ].map(([runId, startedAt, finishedAt, status, triggeredBy]) => ({
    runId: runId ?? 'run',
    startedAt: startedAt ?? AS_OF,
    finishedAt: finishedAt ?? AS_OF,
    status: status === 'failed' ? 'failed' : 'succeeded',
    triggeredBy: triggeredBy ?? 'Scheduled',
    progress: 1,
    message: status === 'failed' ? 'The scheduled read did not finish.' : undefined,
  }));
  return rows;
}

function storageKey(scenario: Scenario) {
  return `pmo-mock-refresh:${scenario}`;
}

function load(scenario: Scenario): Persisted {
  const fallback: Persisted = { generatedAt: null, active: null, history: seedHistory() };
  if (typeof sessionStorage === 'undefined') return memory.get(scenario) ?? fallback;
  const raw = sessionStorage.getItem(storageKey(scenario));
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || !Array.isArray(parsed.history)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function save(scenario: Scenario, state: Persisted) {
  if (typeof sessionStorage === 'undefined') {
    memory.set(scenario, state);
    return;
  }
  sessionStorage.setItem(storageKey(scenario), JSON.stringify(state));
}

function iso(ms: number) {
  return formatInTimeZone(new Date(ms), TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export class MockClient implements DataClient {
  constructor(private readonly scenario: Scenario) {}

  private state() {
    const state = load(this.scenario);
    this.settle(state);
    return state;
  }

  private settle(state: Persisted) {
    if (!state.active) return;
    const elapsed = Date.now() - state.active.startedAtMs;
    if (elapsed < durationMs(this.scenario)) return;
    const finished: RefreshRun = {
      runId: state.active.runId,
      status: state.active.fail ? 'failed' : 'succeeded',
      startedAt: iso(state.active.startedAtMs),
      finishedAt: iso(state.active.startedAtMs + durationMs(this.scenario)),
      progress: 1,
      triggeredBy: state.active.triggeredBy,
      message: state.active.fail
        ? 'The automation reported an error while reading the lists.'
        : this.scenario === 'refresh-reload'
          ? 'Reloaded the latest data; the daily flow updates it at 6:00 AM Eastern.'
          : this.scenario === 'refresh-unchanged'
            ? undefined
            : undefined,
    };
    if (
      !state.active.fail &&
      this.scenario !== 'refresh-unchanged' &&
      this.scenario !== 'refresh-reload'
    ) {
      state.generatedAt = finished.finishedAt ?? state.generatedAt;
    }
    state.history = [finished, ...state.history].slice(0, 10);
    state.active = null;
    save(this.scenario, state);
  }

  async getSnapshot(): Promise<SnapshotResult> {
    if (this.scenario === 'error') {
      throw new ApiError('The snapshot service is unavailable.', 'UPSTREAM');
    }
    if (this.scenario === 'malformed') {
      console.error('Snapshot failed validation', [
        { path: 'schemaVersion', code: 'invalid_literal' },
      ]);
      throw new DataFormatError(
        'The data format changed, so this snapshot could not be read.',
        'schemaVersion',
      );
    }
    const state = this.state();
    const base =
      this.scenario === 'refresh-fail' ||
      this.scenario === 'refresh-unchanged' ||
      this.scenario === 'refresh-reload'
        ? 'portfolio'
        : this.scenario;
    const snapshot = generateSnapshot(base);
    if (state.generatedAt && this.scenario !== 'stale') snapshot.generatedAt = state.generatedAt;
    return { kind: 'ok', snapshot, etag: `"${snapshot.generatedAt}"` };
  }

  async startRefresh(triggeredBy: string): Promise<RefreshStart> {
    const state = this.state();
    if (state.active) {
      return {
        kind: 'conflict',
        runId: state.active.runId,
        startedAt: iso(state.active.startedAtMs),
      };
    }
    const startedAtMs = Date.now();
    const runId = `run-${startedAtMs.toString(36)}`;
    state.active = {
      runId,
      startedAtMs,
      fail: this.scenario === 'refresh-fail',
      triggeredBy,
    };
    save(this.scenario, state);
    return { kind: 'accepted', runId, startedAt: iso(startedAtMs) };
  }

  async getRefresh(runId: string): Promise<RefreshRun> {
    const state = this.state();
    if (state.active && state.active.runId === runId) {
      const elapsed = Date.now() - state.active.startedAtMs;
      const progress = Math.max(0, Math.min(0.95, elapsed / durationMs(this.scenario)));
      return {
        runId,
        status: 'running',
        startedAt: iso(state.active.startedAtMs),
        progress,
        triggeredBy: state.active.triggeredBy,
      };
    }
    const found = state.history.find((run) => run.runId === runId);
    if (!found) throw new ApiError('That refresh run was not found.', 'NOT_FOUND');
    return found;
  }

  async getRefreshHistory(limit = 10): Promise<RefreshRun[]> {
    return this.state().history.slice(0, limit);
  }
}

const clients = new Map<Scenario, MockClient>();

export function getMockClient(scenario: Scenario) {
  const existing = clients.get(scenario);
  if (existing) return existing;
  const created = new MockClient(scenario);
  clients.set(scenario, created);
  return created;
}

export function resetMockClients() {
  clients.clear();
  memory.clear();
  if (typeof sessionStorage !== 'undefined') {
    for (const scenario of [
      'normal',
      'empty',
      'huge',
      'stale',
      'error',
      'malformed',
      'refresh-fail',
      'portfolio',
      'tickets',
      'refresh-unchanged',
      'refresh-reload',
    ]) {
      sessionStorage.removeItem(storageKey(scenario as Scenario));
    }
  }
}
