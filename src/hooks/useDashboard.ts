import { useMemo } from 'react';
import { domainOptions } from '@/lib/config';
import { deriveDashboard } from '@/domain/derive';
import { useOwnerFilter } from '@/hooks/useFilters';
import { useSnapshot } from '@/hooks/useSnapshot';

export function useDashboard() {
  const snap = useSnapshot();
  const teamIds = snap.snapshot ? snap.snapshot.team.map((member) => member.id) : null;
  const owners = useOwnerFilter(teamIds);
  const model = useMemo(
    () =>
      snap.snapshot ? deriveDashboard(snap.snapshot, owners.selection, domainOptions()) : null,
    [snap.snapshot, owners.selection],
  );
  return { ...snap, owners, model };
}
