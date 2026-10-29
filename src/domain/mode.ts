export type DashboardMode = 'tickets' | 'portfolio';

export function getMode(snapshot: {
  tickets?: readonly unknown[] | null;
  meta?: { mode?: string | null } | null;
}): DashboardMode {
  const requested = snapshot.meta?.mode;
  if (requested === 'tickets' || requested === 'portfolio') return requested;
  return (snapshot.tickets?.length ?? 0) > 0 ? 'tickets' : 'portfolio';
}
