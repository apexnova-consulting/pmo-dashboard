import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { FEATURE_FLAGS } from '@/lib/config';
import { useScopedHref } from '@/hooks/useFilters';
import { cn } from '@/lib/utils';

function groupsFor(mode: 'tickets' | 'portfolio') {
  return [
    {
      label: 'Portfolio',
      items: [
        { to: '/', label: 'Overview', end: true },
        { to: '/projects', label: 'Projects', end: false },
        mode === 'portfolio'
          ? { to: '/updates', label: 'Updates', end: false }
          : { to: '/tickets', label: 'Tickets & Tasks', end: false },
        { to: '/risks', label: 'Risks & Blockers', end: false },
      ],
    },
    {
      label: 'People',
      items: [
        {
          to: '/my-work',
          label: mode === 'portfolio' ? 'My Projects' : 'My Work',
          end: false,
        },
        ...(FEATURE_FLAGS.showWorkload
          ? [
              {
                to: '/workload',
                label: mode === 'portfolio' ? 'Projects per lead' : 'Workload',
                end: false,
              },
            ]
          : []),
      ],
    },
    {
      label: 'System',
      items: [{ to: '/about', label: 'Data & Status', end: false }],
    },
  ];
}

function NavItems({
  mode,
  onNavigate,
}: {
  mode: 'tickets' | 'portfolio';
  onNavigate?: () => void;
}) {
  const groups = groupsFor(mode);
  const href = useScopedHref();
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-1">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="section-title mb-3 text-xs">{group.label}</p>
          <ul className="mt-3 space-y-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={href(item.to)}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-brand-strong',
                      isActive
                        ? 'bg-brand-tint font-bold underline decoration-2 underline-offset-4'
                        : 'hover:underline',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Sidebar({ mode }: { mode: 'tickets' | 'portfolio' }) {
  return (
    <nav aria-label="Dashboard" className="no-print hidden w-64 shrink-0 px-4 py-6 md:block">
      <NavItems mode={mode} />
    </nav>
  );
}

export function MobileNav({
  open,
  onClose,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'tickets' | 'portfolio';
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 md:hidden" />
        <Dialog.Content className="fixed inset-0 z-50 overflow-y-auto bg-page p-6 md:hidden">
          <div className="mb-6 flex items-center justify-between">
            <Dialog.Title className="section-title text-lg">Menu</Dialog.Title>
            <Dialog.Close
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand text-brand-strong"
              aria-label="Close menu"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <NavItems mode={mode} onNavigate={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
