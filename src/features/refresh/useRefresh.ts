import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getDataClient } from '@/data/factory';
import { config } from '@/lib/config';
import { initialRefreshState, refreshReducer, type RefreshState } from '@/domain/refreshMachine';
import { useAnnounce } from '@/app/announce';
import { useScenario } from '@/hooks/useSnapshot';

const RUN_KEY = 'pmo-refresh-run';
const SUCCESS_KEY = 'pmo-refresh-success';

function loadInitial(): RefreshState {
  const last = Number(window.sessionStorage.getItem(SUCCESS_KEY) || '');
  return {
    ...initialRefreshState,
    lastSuccessAt: Number.isFinite(last) && last > 0 ? last : null,
  };
}

export function useRefresh() {
  const scenario = useScenario();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RefreshState>(loadInitial);
  const [now, setNow] = useState(() => Date.now());
  const handled = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = (event: Parameters<typeof refreshReducer>[1]) => {
    setState((current) => refreshReducer(current, event));
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(RUN_KEY);
    if (saved) dispatch({ type: 'hydrate', runId: saved });
  }, []);

  const start = async () => {
    try {
      const result = await getDataClient(scenario).startRefresh('PMO dashboard user');
      window.sessionStorage.setItem(RUN_KEY, result.runId);
      if (result.kind === 'conflict') {
        dispatch({ type: 'conflict', runId: result.runId, startedAt: result.startedAt });
        announce('A refresh is already in progress');
      } else {
        dispatch({ type: 'accepted', runId: result.runId, startedAt: result.startedAt });
        announce('Refresh started');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refresh could not be started';
      dispatch({ type: 'fail_start', message });
      announce(`Refresh failed: ${message}`);
    }
  };

  const request = () => {
    const current = stateRef.current;
    const next = refreshReducer(current, {
      type: 'request',
      now: Date.now(),
      cooldownMs: config.refreshCooldownMs,
      confirmMs: config.refreshConfirmMs,
    });
    setState(next);
    if (next.phase === 'starting' && current.phase !== 'starting') void start();
  };

  const confirm = () => {
    setState((current) => refreshReducer(current, { type: 'confirm' }));
    void start();
  };

  const runId = state.runId;
  const polling = state.phase === 'running' || state.phase === 'timed_out';

  useEffect(() => {
    if (!polling || !runId) return;
    let stop = false;
    let timer = 0;
    const tick = async () => {
      if (stop) return;
      try {
        const run = await getDataClient(scenario).getRefresh(runId);
        if (stop) return;
        if (run.status === 'succeeded' || run.status === 'failed') {
          const mark = `${runId}:${run.status}`;
          if (handled.current === mark) return;
          handled.current = mark;
          window.sessionStorage.removeItem(RUN_KEY);
          if (run.status === 'succeeded') {
            const at = Date.now();
            window.sessionStorage.setItem(SUCCESS_KEY, String(at));
            dispatch({ type: 'poll', status: 'succeeded', now: at, progress: 1 });
            await queryClient.invalidateQueries({ queryKey: ['snapshot'] });
            await queryClient.invalidateQueries({ queryKey: ['refresh-history'] });
            announce('Data updated');
          } else {
            dispatch({ type: 'poll', status: 'failed', now: Date.now(), message: run.message });
            announce(`Refresh failed: ${run.message ?? 'unknown error'}`);
          }
          return;
        }
        dispatch({
          type: 'poll',
          status: run.status,
          now: Date.now(),
          progress: run.progress,
          message: run.message,
        });
        const started = new Date(run.startedAt).getTime();
        if (Date.now() - started > config.refreshTimeoutMs) {
          dispatch({ type: 'timeout' });
          return;
        }
        const wait = Date.now() - started > 30_000 ? 10_000 : config.refreshPollMs;
        timer = window.setTimeout(() => void tick(), wait);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Refresh status could not be loaded';
        dispatch({ type: 'fail_start', message });
        announce(`Refresh failed: ${message}`);
      }
    };
    void tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [polling, runId, scenario, announce, queryClient]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'R' || !event.shiftKey || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable)
          return;
      }
      event.preventDefault();
      request();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cooldownLeft =
    state.lastSuccessAt == null
      ? 0
      : Math.max(0, config.refreshCooldownMs - (now - state.lastSuccessAt));

  return {
    state,
    request,
    confirm,
    cancel: () => dispatch({ type: 'cancel' }),
    keepWaiting: () => dispatch({ type: 'keep_waiting' }),
    dismiss: () => dispatch({ type: 'dismiss' }),
    cooldownLeft,
  };
}
