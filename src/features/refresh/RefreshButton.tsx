import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { useRefresh } from '@/features/refresh/useRefresh';
import { cn } from '@/lib/utils';

export function RefreshButton() {
  const refresh = useRefresh();
  const { state, cooldownLeft } = refresh;
  const busy = state.phase === 'starting' || state.phase === 'running';
  const cooling = cooldownLeft > 0 && !busy;
  const seconds = Math.ceil(cooldownLeft / 1000);
  const label = busy ? 'Refreshing…' : cooling ? `Wait ${seconds}s` : 'Refresh';

  const button = (
    <Button
      variant="header"
      className="relative"
      aria-busy={busy}
      disabled={busy || cooling}
      onClick={refresh.request}
    >
      <RefreshCw aria-hidden="true" className={cn('h-4 w-4', busy && 'animate-spin')} />
      <span className="hidden md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
      {state.error ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rag-red"
          aria-label="Last refresh failed"
        />
      ) : null}
    </Button>
  );

  return (
    <div className="flex items-center gap-2">
      {state.phase === 'confirming' ? (
        <Popover
          open
          onOpenChange={(open) => {
            if (!open) refresh.cancel();
          }}
          label="Confirm refresh"
          trigger={button}
        >
          <p>A refresh finished less than five minutes ago. Run it again?</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={refresh.confirm}>
              Run again
            </Button>
            <Button type="button" variant="secondary" onClick={refresh.cancel}>
              Cancel
            </Button>
          </div>
        </Popover>
      ) : (
        <Tooltip
          content={
            cooling
              ? `Available again in ${seconds} seconds. Shortcut Shift+R.`
              : 'Load a new snapshot. Shortcut Shift+R.'
          }
        >
          {button}
        </Tooltip>
      )}
      {state.phase === 'timed_out' ? (
        <div
          className="absolute right-4 top-20 z-30 w-72 rounded-[12px] border border-line bg-card p-4 text-sm text-ink"
          role="dialog"
          aria-label="Refresh is taking a long time"
        >
          <p>This refresh has been running for more than 10 minutes.</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={refresh.keepWaiting}>
              Keep waiting
            </Button>
            <Button type="button" variant="secondary" onClick={refresh.dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
      {state.error && state.phase === 'idle' ? (
        <Link
          to="/about"
          className="header-control hidden rounded-full border border-white/80 px-3 py-2 text-xs text-on-brand lg:inline"
        >
          View details
        </Link>
      ) : null}
      {busy ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-white/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.progress == null ? undefined : Math.round(state.progress * 100)}
          aria-label="Refresh progress"
        >
          <div
            className={cn(
              'h-full bg-accent',
              state.progress == null && 'progress-indeterminate w-1/3',
            )}
            style={
              state.progress == null ? undefined : { width: `${Math.round(state.progress * 100)}%` }
            }
          />
        </div>
      ) : null}
    </div>
  );
}
