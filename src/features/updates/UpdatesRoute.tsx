import { useOutletContext } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { EmptyState, PageSkeleton } from '@/components/common/States';
import { UpdatesPage } from '@/features/updates/UpdatesPage';

export default function UpdatesRoute() {
  const dash = useOutletContext<DashContext>();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model) return <EmptyState title="No updates" body="The snapshot did not load." />;
  if (dash.model.mode === 'tickets') {
    return (
      <EmptyState
        title="This snapshot uses tickets"
        body="Updates appear when the snapshot has no tickets. Open Tickets & Tasks for this view."
        actionHref="/tickets"
        actionLabel="Open tickets"
      />
    );
  }
  return <UpdatesPage dash={dash} />;
}
