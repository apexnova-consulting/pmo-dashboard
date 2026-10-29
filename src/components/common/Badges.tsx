import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Minus } from 'lucide-react';
import type { Priority } from '@/data/schema';
import { priorityLabel } from '@/domain/derive';

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
