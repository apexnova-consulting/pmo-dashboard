export type RefreshPhase = 'idle' | 'confirming' | 'starting' | 'running' | 'timed_out';

export interface RefreshState {
  phase: RefreshPhase;
  runId: string | null;
  startedAt: string | null;
  progress: number | null;
  message: string | null;
  error: string | null;
  lastSuccessAt: number | null;
  conflict: boolean;
}

export type RefreshEvent =
  | {
      type: 'request';
      now: number;
      cooldownMs: number;
      confirmMs: number;
    }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'accepted'; runId: string; startedAt: string }
  | { type: 'conflict'; runId: string; startedAt: string }
  | {
      type: 'poll';
      status: 'queued' | 'running' | 'succeeded' | 'failed';
      progress?: number;
      message?: string;
      finishedAt?: string;
      now: number;
    }
  | { type: 'timeout' }
  | { type: 'keep_waiting' }
  | { type: 'dismiss' }
  | { type: 'fail_start'; message: string }
  | { type: 'hydrate'; runId: string }
  | { type: 'clear_error' };

export const initialRefreshState: RefreshState = {
  phase: 'idle',
  runId: null,
  startedAt: null,
  progress: null,
  message: null,
  error: null,
  lastSuccessAt: null,
  conflict: false,
};

export function refreshReducer(state: RefreshState, event: RefreshEvent): RefreshState {
  switch (event.type) {
    case 'request': {
      if (state.phase === 'starting' || state.phase === 'running' || state.phase === 'confirming') {
        return state;
      }
      if (state.lastSuccessAt != null && event.now - state.lastSuccessAt < event.cooldownMs) {
        return state;
      }
      if (state.lastSuccessAt != null && event.now - state.lastSuccessAt < event.confirmMs) {
        return { ...state, phase: 'confirming', conflict: false };
      }
      return {
        ...state,
        phase: 'starting',
        error: null,
        message: null,
        conflict: false,
        progress: null,
      };
    }
    case 'confirm':
      if (state.phase !== 'confirming') return state;
      return { ...state, phase: 'starting', error: null, message: null };
    case 'cancel':
      if (state.phase !== 'confirming') return state;
      return { ...state, phase: 'idle' };
    case 'accepted':
      return {
        ...state,
        phase: 'running',
        runId: event.runId,
        startedAt: event.startedAt,
        progress: 0,
        conflict: false,
        error: null,
      };
    case 'conflict':
      return {
        ...state,
        phase: 'running',
        runId: event.runId,
        startedAt: event.startedAt,
        conflict: true,
        error: null,
      };
    case 'poll': {
      if (state.phase !== 'running' && state.phase !== 'timed_out') return state;
      if (event.status === 'succeeded') {
        return {
          ...state,
          phase: 'idle',
          progress: 1,
          message: event.message || 'Data updated',
          error: null,
          lastSuccessAt: event.now,
          runId: null,
          conflict: false,
        };
      }
      if (event.status === 'failed') {
        return {
          ...state,
          phase: 'idle',
          progress: null,
          error: event.message || 'Refresh failed',
          message: event.message || 'Refresh failed',
          runId: null,
          conflict: false,
        };
      }
      return {
        ...state,
        phase: 'running',
        progress: event.progress ?? state.progress,
        message: event.message ?? state.message,
      };
    }
    case 'timeout':
      if (state.phase !== 'running') return state;
      return { ...state, phase: 'timed_out' };
    case 'keep_waiting':
      if (state.phase !== 'timed_out') return state;
      return { ...state, phase: 'running' };
    case 'dismiss':
      if (state.phase !== 'timed_out' && state.phase !== 'confirming') return state;
      return { ...initialRefreshState, lastSuccessAt: state.lastSuccessAt, error: state.error };
    case 'fail_start':
      return {
        ...state,
        phase: 'idle',
        error: event.message,
        message: event.message,
        runId: null,
      };
    case 'hydrate':
      if (state.phase === 'running' || state.phase === 'starting') return state;
      return { ...state, phase: 'running', runId: event.runId, progress: null };
    case 'clear_error':
      return { ...state, error: null, message: state.phase === 'idle' ? null : state.message };
    default:
      return state;
  }
}
