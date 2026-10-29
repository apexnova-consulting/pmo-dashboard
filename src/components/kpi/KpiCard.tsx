import type { ReactNode } from 'react';
import { METRICS } from '@/domain/metrics';
import { DeltaText } from '@/components/common/InfoTip';
import { InfoTip } from '@/components/common/InfoTip';

export function KpiCard({
  label,
  value,
  metricId,
  delta,
  higherIsWorse,
  children,
}: {
  label: string;
  value: string;
  metricId?: string;
  delta?: number | null;
  higherIsWorse?: boolean;
  children?: ReactNode;
}) {
  const definition = METRICS.find((metric) => metric.id === metricId)?.definition;
  return (
    <article className="flex min-h-32 flex-col rounded-[12px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</h2>
        {definition ? <InfoTip label={`About ${label}`}>{definition}</InfoTip> : null}
      </div>
      <p className="num mt-2 font-display text-[28px] font-bold leading-none">{value}</p>
      {delta !== undefined ? (
        <p className="mt-2">
          <DeltaText delta={delta} higherIsWorse={higherIsWorse} />
        </p>
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
