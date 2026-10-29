import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/layout/Header';
import { MobileNav, Sidebar } from '@/components/layout/Sidebar';
import { useDashboard } from '@/hooks/useDashboard';
import { useAnnounce } from '@/app/announce';
import { hoursSince } from '@/domain/dates';
import { config } from '@/lib/config';
import { isAllOwners } from '@/domain/filters';
import { formatDataAsOf } from '@/domain/dates';
import { serializeOwner } from '@/domain/filters';

const titles: Record<string, string> = {
  '/': 'Overview',
  '/my-work': 'My Work',
  '/projects': 'Projects',
  '/tickets': 'Tickets & Tasks',
  '/risks': 'Risks & Blockers',
  '/workload': 'Workload',
  '/about': 'Data & Status',
};

export function AppShell() {
  const dash = useDashboard();
  const location = useLocation();
  const announce = useAnnounce();
  const [menu, setMenu] = useState(false);
  const base = location.pathname.startsWith('/projects/')
    ? 'Project'
    : (titles[location.pathname] ?? 'PMO Dashboard');

  useEffect(() => {
    document.title = `${base} · CCNY PMO Dashboard`;
  }, [base]);

  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);

  const ownerKey = serializeOwner(dash.owners.selection);
  useEffect(() => {
    if (!dash.model) return;
    if (isAllOwners(dash.owners.selection)) {
      announce('Showing the whole portfolio');
      return;
    }
    const names = dash.model.team
      .filter((member) => dash.owners.selection.ids.includes(member.id))
      .map((member) => member.displayName);
    if (dash.owners.selection.includeUnassigned) names.push('Unassigned');
    announce(`Showing work for ${names.join(', ')}`);
  }, [ownerKey, dash.model, dash.owners.selection, announce]);

  const stale =
    dash.snapshot != null &&
    hoursSince(dash.snapshot.generatedAt, new Date()) > config.staleAfterHours;

  return (
    <div className="min-h-screen bg-page text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <AppHeader
        team={dash.snapshot?.team ?? []}
        selection={dash.owners.selection}
        onToggle={dash.owners.toggle}
        onAll={dash.owners.setAll}
        generatedAt={dash.snapshot?.generatedAt ?? null}
        timeZone={dash.snapshot?.meta.timezone ?? config.timezone}
        onMenu={() => setMenu(true)}
      />
      {stale && dash.snapshot ? (
        <div
          className="border-b border-rag-amber bg-rag-amber-bg px-4 py-2 text-sm text-rag-amber"
          role="status"
        >
          Data has not updated since{' '}
          {formatDataAsOf(dash.snapshot.generatedAt, dash.snapshot.meta.timezone)}. A daily run may
          have been missed.
        </div>
      ) : null}
      {dash.showingStale ? (
        <div
          className="border-b border-rag-amber bg-rag-amber-bg px-4 py-2 text-sm text-rag-amber"
          role="alert"
        >
          {dash.formatError
            ? 'The data format changed, so the newest snapshot could not be read. Showing the last good snapshot.'
            : 'The newest snapshot could not be loaded. Showing the last good snapshot.'}
          <button type="button" className="link ml-2 font-bold" onClick={() => void dash.refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[1440px]">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-6">
          <Outlet context={dash} />
          <footer className="mt-10 border-t border-line pt-4 text-sm text-muted">
            Internal tool of the CCNY PMO. Not an official public City College website.
          </footer>
        </main>
      </div>
      <MobileNav open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}

export type DashContext = ReturnType<typeof useDashboard>;
