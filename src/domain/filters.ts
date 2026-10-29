import type { Project, Ticket, Update } from '@/data/schema';

export interface OwnerSelection {
  ids: string[];
  includeUnassigned: boolean;
}

export function allOwners(): OwnerSelection {
  return { ids: [], includeUnassigned: false };
}

export function isAllOwners(selection: OwnerSelection): boolean {
  return selection.ids.length === 0 && !selection.includeUnassigned;
}

export function parseOwnerParam(value: string | null, teamIds: string[] | null): OwnerSelection {
  if (!value || value === 'all') return allOwners();
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const includeUnassigned = parts.includes('unassigned');
  const ids = parts
    .filter((part) => part !== 'unassigned' && part !== 'all')
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => teamIds == null || teamIds.includes(id));
  if (ids.length === 0 && !includeUnassigned) return allOwners();
  return { ids, includeUnassigned };
}

export function serializeOwner(selection: OwnerSelection): string {
  if (isAllOwners(selection)) return 'all';
  return [...selection.ids, ...(selection.includeUnassigned ? ['unassigned'] : [])].join(',');
}

export function toggleOwner(selection: OwnerSelection, id: string): OwnerSelection {
  if (id === 'unassigned') {
    const includeUnassigned = !selection.includeUnassigned;
    if (selection.ids.length === 0 && !includeUnassigned) return allOwners();
    return { ids: selection.ids, includeUnassigned };
  }
  const ids = selection.ids.includes(id)
    ? selection.ids.filter((item) => item !== id)
    : [...selection.ids, id];
  if (ids.length === 0 && !selection.includeUnassigned) return allOwners();
  return { ids, includeUnassigned: selection.includeUnassigned };
}

export function ticketMatchesOwner(
  ticket: Pick<Ticket, 'assigneeId'>,
  selection: OwnerSelection,
): boolean {
  if (isAllOwners(selection)) return true;
  if (ticket.assigneeId == null) return selection.includeUnassigned;
  return selection.ids.includes(ticket.assigneeId);
}

export function projectRole(
  project: Pick<Project, 'key' | 'leadId'>,
  openTickets: Pick<Ticket, 'projectKey' | 'assigneeId'>[],
  selection: OwnerSelection,
): 'lead' | 'contributor' | 'unassigned' | null {
  const projectTickets = openTickets.filter((ticket) => ticket.projectKey === project.key);
  if (isAllOwners(selection)) {
    return project.leadId == null ? 'unassigned' : null;
  }
  if (project.leadId && selection.ids.includes(project.leadId)) return 'lead';
  if (
    projectTickets.some((ticket) => ticket.assigneeId && selection.ids.includes(ticket.assigneeId))
  ) {
    return 'contributor';
  }
  const unassignedHere =
    selection.includeUnassigned &&
    (project.leadId == null || projectTickets.some((ticket) => ticket.assigneeId == null));
  if (unassignedHere) return 'unassigned';
  return null;
}

export function portfolioProjectRole(
  project: Pick<Project, 'key' | 'leadId'>,
  updates: Pick<Update, 'projectKey' | 'authorId' | 'ownerId' | 'status'>[],
  selection: OwnerSelection,
): 'lead' | 'contributor' | 'unassigned' | null {
  const openUpdates = updates.filter(
    (update) => update.projectKey === project.key && update.status === 'open',
  );
  if (isAllOwners(selection)) {
    return project.leadId == null ? 'unassigned' : null;
  }
  if (project.leadId && selection.ids.includes(project.leadId)) return 'lead';
  if (
    openUpdates.some(
      (update) =>
        (update.authorId != null && selection.ids.includes(update.authorId)) ||
        (update.ownerId != null && selection.ids.includes(update.ownerId)),
    )
  ) {
    return 'contributor';
  }
  const unassignedHere =
    selection.includeUnassigned &&
    (project.leadId == null ||
      openUpdates.some((update) => update.authorId == null || update.ownerId == null));
  if (unassignedHere) return 'unassigned';
  return null;
}
