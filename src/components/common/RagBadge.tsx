import { Check, Circle, Triangle } from 'lucide-react';
import type { RagResult } from '@/domain/metrics';
import { cn } from '@/lib/utils';
import { Popover } from '@/components/ui/popover';

const styles = {
  red: 'bg-rag-red-bg text-rag-red',
  amber: 'bg-rag-amber-bg text-rag-amber',
  green: 'bg-rag-green-bg text-rag-green',
} as const;

const labels = { red: 'Red', amber: 'Amber', green: 'Green' } as const;

export function RagBadge({
  rag,
  className,
}: {
  rag: 'red' | 'amber' | 'green';
  className?: string;
}) {
  const Icon = rag === 'green' ? Check : rag === 'amber' ? Triangle : Circle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
        styles[rag],
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
      {labels[rag]}
    </span>
  );
}

export function RagWhy({ result }: { result: RagResult }) {
  return (
    <Popover
      label="Why this health status"
      trigger={
        <button type="button" className="link text-sm">
          Why?
        </button>
      }
    >
      <p className="font-bold">{labels[result.rag]}</p>
      {result.overridden ? (
        <p className="mt-2">
          PMO override.{' '}
          {result.note
            ? result.note
            : 'A manual health call is set on this project and it wins over the calculated rules.'}
        </p>
      ) : null}
      {result.rag === 'green' && !result.overridden ? (
        <p className="mt-2">No red or amber threshold was met.</p>
      ) : null}
      {result.reasons.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {result.reasons.map((reason) => (
            <li key={`${reason.level}-${reason.rule}`}>{reason.detail}</li>
          ))}
        </ul>
      ) : null}
      {result.note && !result.overridden ? <p className="mt-2 text-muted">{result.note}</p> : null}
    </Popover>
  );
}
