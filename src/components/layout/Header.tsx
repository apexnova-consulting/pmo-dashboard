import { Menu, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TeamMember } from '@/data/schema';
import type { OwnerSelection } from '@/domain/filters';
import { isAllOwners } from '@/domain/filters';
import { formatDataAsOf } from '@/domain/dates';
import { hoursSince } from '@/domain/dates';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { RefreshButton } from '@/features/refresh/RefreshButton';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

function relativeHours(iso: string) {
  const hours = hoursSince(iso, new Date());
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes ago`;
  if (hours < 48) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function OwnerFilter({
  team,
  selection,
  onToggle,
  onAll,
  tone = 'header',
}: {
  team: TeamMember[];
  selection: OwnerSelection;
  onToggle: (id: string) => void;
  onAll: () => void;
  tone?: 'header' | 'page';
}) {
  const all = isAllOwners(selection);
  const item = (id: string, label: string, pressed: boolean) => (
    <button
      key={id}
      type="button"
      aria-pressed={pressed}
      onClick={() => (id === 'all' ? onAll() : onToggle(id))}
      className={cn(
        'whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold',
        tone === 'header'
          ? pressed
            ? 'bg-white text-brand-strong underline decoration-2 underline-offset-4'
            : 'header-control text-on-brand hover:underline'
          : pressed
            ? 'bg-brand-tint text-brand-strong underline underline-offset-4'
            : 'text-brand-strong hover:underline',
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Filter by owner" className="flex items-center gap-1">
      {item('all', 'All', all)}
      {team.map((member) => item(member.id, member.displayName, selection.ids.includes(member.id)))}
      {item('unassigned', 'Unassigned', selection.includeUnassigned)}
    </div>
  );
}

export function AppHeader({
  team,
  selection,
  onToggle,
  onAll,
  generatedAt,
  timeZone,
  onMenu,
}: {
  team: TeamMember[];
  selection: OwnerSelection;
  onToggle: (id: string) => void;
  onAll: () => void;
  generatedAt: string | null;
  timeZone: string;
  onMenu: () => void;
}) {
  const { theme, toggle } = useTheme();
  return (
    <div className="sticky top-0 z-30">
      <div className="h-1 bg-accent" />
      <header className="relative bg-header text-on-brand">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-3 px-4 py-2">
          <button
            type="button"
            className="header-control inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/80 md:hidden"
            aria-label="Open menu"
            onClick={onMenu}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
          <Link
            to="/"
            className="header-control flex items-center rounded-sm"
            aria-label="PMO Dashboard home"
          >
            <img
              src="/brand/ccny-cuny-logo.png"
              alt="The City College of New York"
              className="h-12 w-auto min-w-[120px]"
            />
          </Link>
          <p className="hidden font-display text-lg font-bold tracking-[0.06em] lg:block">
            PMO Dashboard
          </p>
          <div className="no-print ml-auto flex items-center gap-2">
            <div className="hidden md:block">
              <OwnerFilter team={team} selection={selection} onToggle={onToggle} onAll={onAll} />
            </div>
            {generatedAt ? (
              <Tooltip content={relativeHours(generatedAt)}>
                <span className="hidden text-sm text-on-brand sm:inline">
                  Data as of {formatDataAsOf(generatedAt, timeZone)}
                </span>
              </Tooltip>
            ) : (
              <span className="hidden text-sm sm:inline">Data as of n/a</span>
            )}
            <Button
              variant="header"
              className="h-10 w-10 px-0"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggle}
            >
              {theme === 'dark' ? (
                <Sun aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Moon aria-hidden="true" className="h-4 w-4" />
              )}
            </Button>
            <RefreshButton />
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2 px-4 pb-3 md:hidden">
          <OwnerFilter team={team} selection={selection} onToggle={onToggle} onAll={onAll} />
        </div>
      </header>
    </div>
  );
}
