import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Popover } from '@/components/ui/popover';

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover
      label={label}
      trigger={
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-strong"
          aria-label={label}
        >
          <Info aria-hidden="true" className="h-4 w-4" />
        </button>
      }
    >
      <p>{children}</p>
    </Popover>
  );
}

export function DeltaText({
  delta,
  higherIsWorse = false,
}: {
  delta: number | null;
  higherIsWorse?: boolean;
}) {
  if (delta == null) return <span className="text-sm text-muted">n/a vs 7 days</span>;
  if (delta === 0) return <span className="text-sm text-muted">No change vs 7 days</span>;
  const up = delta > 0;
  const tone = higherIsWorse ? (up ? 'text-rag-red' : 'text-rag-green') : 'text-ink';
  return (
    <span className={`text-sm ${tone}`}>
      {up ? 'Up' : 'Down'} {Math.abs(delta)} vs 7 days
    </span>
  );
}
