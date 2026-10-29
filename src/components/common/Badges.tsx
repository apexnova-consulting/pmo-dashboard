import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Mail, Minus } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import type { Priority, RiskLevel } from '@/data/schema';
import { priorityLabel } from '@/domain/derive';
import { cn } from '@/lib/utils';

const icons = {
  highest: ChevronsUp,
  high: ChevronUp,
  medium: Minus,
  low: ChevronDown,
  lowest: ChevronsDown,
} as const;

export function PriorityBadge({ priority }: { priority: Priority }) {
  const Icon = icons[priority];
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Icon aria-hidden="true" className="h-4 w-4" />
      {priorityLabel(priority)}
    </span>
  );
}

const riskLabels: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold">
      <Minus aria-hidden="true" className="h-4 w-4" />
      {riskLabels[level]}
    </span>
  );
}

export function SourceBadge({ source, href }: { source: 'list' | 'email'; href?: string }) {
  const label = source === 'email' ? 'Email' : 'List';
  const body = (
    <span className="inline-flex items-center gap-1 text-sm">
      {source === 'email' ? <Mail aria-hidden="true" className="h-4 w-4" /> : null}
      {label}
    </span>
  );
  if (source === 'email' && href) {
    return (
      <a className="link" href={href} target="_blank" rel="noopener noreferrer">
        {body}
        <span className="sr-only"> source</span>
      </a>
    );
  }
  return body;
}

export function ExternalAnchor({
  href,
  children,
  sr,
  className,
  onClick,
}: {
  href: string | null;
  children: ReactNode;
  sr?: string;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a
      className={cn('link', className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      {children}
      {sr ? <span className="sr-only"> {sr}</span> : null}
    </a>
  );
}

export function StatusLabel({
  name,
  category,
}: {
  name: string;
  category: 'todo' | 'in_progress' | 'done';
}) {
  const label = category === 'todo' ? 'To do' : category === 'in_progress' ? 'In progress' : 'Done';
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={
          category === 'done'
            ? 'h-2.5 w-2.5 rounded-full bg-series-4'
            : category === 'in_progress'
              ? 'h-2.5 w-2.5 rounded-full bg-series-1'
              : 'h-2.5 w-2.5 rounded-full border border-muted'
        }
      />
      <span>
        {name}
        <span className="sr-only"> ({label})</span>
      </span>
    </span>
  );
}
