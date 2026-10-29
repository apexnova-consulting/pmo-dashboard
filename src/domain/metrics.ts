import type { Milestone, Priority, Project, Ticket } from '@/data/schema';
import { RAG_CONFIG, type DomainOptions } from '@/lib/config';
import { addDaysYmd, calendarDate, calendarDaysBetween } from './dates';

export type RagLevel = 'red' | 'amber' | 'green' | 'none';

export interface RagReason {
  level: 'red' | 'amber';
  rule: string;
  detail: string;
}

export interface RagResult {
  rag: RagLevel;
  reasons: RagReason[];
  overridden: boolean;
  note: string | null;
}

const PRIORITY_RANK: Record<Priority, number> = {
  highest: 0,
  high: 1,
  medium: 2,
  low: 3,
  lowest: 4,
};

export function priorityRank(priority: Priority): number {
  return PRIORITY_RANK[priority];
}

export function isOpen(ticket: Ticket): boolean {
  return ticket.statusCategory !== 'done';
}

export function isBlocked(ticket: Ticket, blockedStatuses: readonly string[]): boolean {
  if (ticket.flagged) return true;
  if (ticket.labels.some((label) => label.toLowerCase() === 'blocked')) return true;
  const status = ticket.statusName.trim().toLowerCase();
  return blockedStatuses.some((name) => name.trim().toLowerCase() === status);
}

export function ticketFacts(
  ticket: Ticket,
  asOfIso: string,
  timeZone: string,
  options: DomainOptions,
) {
  const asOfDay = calendarDate(asOfIso, timeZone);
  const createdDay = calendarDate(ticket.created, timeZone);
  const updatedDay = calendarDate(ticket.updated, timeZone);
  const open = isOpen(ticket);
  const overdue = open && ticket.dueDate != null && ticket.dueDate < asOfDay;
  const dueSoon =
    open &&
    ticket.dueDate != null &&
    ticket.dueDate >= asOfDay &&
    ticket.dueDate <= addDaysYmd(asOfDay, 7);
  const blocked = open && isBlocked(ticket, options.blockedStatuses);
  const daysSinceUpdate = calendarDaysBetween(asOfDay, updatedDay);
  const stale = open && daysSinceUpdate > options.staleDays;
  const resolvedDay = ticket.resolvedAt ? calendarDate(ticket.resolvedAt, timeZone) : null;
  const ageDays =
    open || resolvedDay == null
      ? calendarDaysBetween(asOfDay, createdDay)
      : calendarDaysBetween(resolvedDay, createdDay);
  const daysOverdue =
    overdue && ticket.dueDate ? calendarDaysBetween(asOfDay, ticket.dueDate) : null;
  const resolvedWithin7 =
    resolvedDay != null && resolvedDay <= asOfDay && resolvedDay > addDaysYmd(asOfDay, -7);
  const resolvedWithin30 =
    resolvedDay != null && resolvedDay <= asOfDay && resolvedDay > addDaysYmd(asOfDay, -30);
  return {
    open,
    overdue,
    dueSoon,
    blocked,
    stale,
    ageDays,
    daysOverdue,
    daysSinceUpdate,
    resolvedWithin7,
    resolvedWithin30,
    asOfDay,
  };
}

export function milestoneSlipDays(milestone: Milestone): number | null {
  if (milestone.completedDate) return null;
  if (!milestone.forecastDate) return null;
  return calendarDaysBetween(milestone.forecastDate, milestone.plannedDate);
}

export function projectStaleDays(
  tickets: Ticket[],
  asOfIso: string,
  timeZone: string,
): number | null {
  if (tickets.length === 0) return null;
  const asOfDay = calendarDate(asOfIso, timeZone);
  const latest = tickets.reduce((max, ticket) => {
    const updated = calendarDate(ticket.updated, timeZone);
    return updated > max ? updated : max;
  }, '0000-01-01');
  return calendarDaysBetween(asOfDay, latest);
}

export function completionOf(tickets: Ticket[]): {
  ratio: number | null;
  basis: 'count' | 'story_points' | 'none';
} {
  if (tickets.length === 0) return { ratio: null, basis: 'none' };
  const withPoints = tickets.filter((ticket) => ticket.storyPoints != null);
  if (withPoints.length / tickets.length >= 0.8) {
    const total = withPoints.reduce((sum, ticket) => sum + (ticket.storyPoints ?? 0), 0);
    if (total <= 0) return { ratio: null, basis: 'story_points' };
    const done = withPoints
      .filter((ticket) => ticket.statusCategory === 'done')
      .reduce((sum, ticket) => sum + (ticket.storyPoints ?? 0), 0);
    return { ratio: done / total, basis: 'story_points' };
  }
  const done = tickets.filter((ticket) => ticket.statusCategory === 'done').length;
  return { ratio: done / tickets.length, basis: 'count' };
}

export function explainRag(
  project: Project,
  tickets: Ticket[],
  milestones: Milestone[],
  asOfIso: string,
  timeZone: string,
  options: DomainOptions = {
    blockedStatuses: ['Blocked', 'On Hold', 'Waiting'],
    staleDays: 10,
    rag: RAG_CONFIG,
  },
): RagResult {
  const openTickets = tickets.filter(isOpen);
  const facts = openTickets.map((ticket) => ticketFacts(ticket, asOfIso, timeZone, options));
  const openCount = facts.length;
  const overdueCount = facts.filter((fact) => fact.overdue).length;
  const blockedCount = facts.filter((fact) => fact.blocked).length;
  const overduePct = openCount === 0 ? 0 : overdueCount / openCount;
  const slips = milestones
    .filter((milestone) => milestone.projectKey === project.key)
    .map(milestoneSlipDays)
    .filter((days): days is number => days != null && days > 0);
  const maxSlip = slips.length ? Math.max(...slips) : 0;
  const staleDays = projectStaleDays(tickets, asOfIso, timeZone);
  const { red, amber } = options.rag;
  const reasons: RagReason[] = [];

  const consider = (level: 'red' | 'amber', fired: boolean, rule: string, detail: string) => {
    if (fired) reasons.push({ level, rule, detail });
  };

  consider(
    'red',
    overduePct >= red.overduePct && openCount > 0,
    'Overdue share',
    `${Math.round(overduePct * 100)}% of open tickets are overdue (red at ${Math.round(red.overduePct * 100)}%).`,
  );
  consider(
    'amber',
    overduePct >= amber.overduePct && overduePct < red.overduePct && openCount > 0,
    'Overdue share',
    `${Math.round(overduePct * 100)}% of open tickets are overdue (amber at ${Math.round(amber.overduePct * 100)}%).`,
  );
  consider(
    'red',
    blockedCount >= red.blockedCount,
    'Blocked tickets',
    `${blockedCount} blocked or flagged (red at ${red.blockedCount}).`,
  );
  consider(
    'amber',
    blockedCount >= amber.blockedCount && blockedCount < red.blockedCount,
    'Blocked tickets',
    `${blockedCount} blocked or flagged (amber at ${amber.blockedCount}).`,
  );
  consider(
    'red',
    maxSlip >= red.milestoneSlipDays,
    'Milestone slip',
    `An open milestone is ${maxSlip} days past plan (red at ${red.milestoneSlipDays}).`,
  );
  consider(
    'amber',
    maxSlip >= amber.milestoneSlipDays && maxSlip < red.milestoneSlipDays,
    'Milestone slip',
    `An open milestone is ${maxSlip} days past plan (amber at ${amber.milestoneSlipDays}).`,
  );
  consider(
    'red',
    staleDays != null && staleDays >= red.maxStaleDays,
    'No recent updates',
    `Nothing in this project was updated for ${staleDays} days (red at ${red.maxStaleDays}).`,
  );
  consider(
    'amber',
    staleDays != null && staleDays >= amber.maxStaleDays && staleDays < red.maxStaleDays,
    'No recent updates',
    `Nothing in this project was updated for ${staleDays} days (amber at ${amber.maxStaleDays}).`,
  );

  const computed: RagLevel = reasons.some((reason) => reason.level === 'red')
    ? 'red'
    : reasons.some((reason) => reason.level === 'amber')
      ? 'amber'
      : 'green';

  if (project.healthOverride) {
    return {
      rag: project.healthOverride,
      reasons,
      overridden: true,
      note: project.healthNote ?? null,
    };
  }

  return {
    rag: computed,
    reasons: reasons.filter((reason) => reason.level === computed || computed === 'green'),
    overridden: false,
    note: project.healthNote ?? null,
  };
}

export const METRICS: { id: string; name: string; definition: string }[] = [
  {
    id: 'open',
    name: 'Open ticket',
    definition: 'Status category is not Done.',
  },
  {
    id: 'overdue',
    name: 'Overdue',
    definition:
      'Open, and the due date is before the snapshot calendar day in the snapshot timezone. Due today is not overdue.',
  },
  {
    id: 'dueSoon',
    name: 'Due in 7 days',
    definition:
      'Open, with a due date from the snapshot day through seven calendar days later, inclusive.',
  },
  {
    id: 'blocked',
    name: 'Blocked',
    definition:
      'Open, and flagged, labeled "blocked", or in a status listed in VITE_BLOCKED_STATUSES.',
  },
  {
    id: 'age',
    name: 'Age',
    definition:
      'Calendar days from created to the snapshot day for open tickets, or from created to resolved for done tickets.',
  },
  {
    id: 'stale',
    name: 'Stale ticket',
    definition: 'Open, and last updated more than the configured stale-day threshold (default 10).',
  },
  {
    id: 'throughput',
    name: 'Throughput (7 days)',
    definition:
      'Tickets whose resolved time falls in the seven calendar days ending on the snapshot day.',
  },
  {
    id: 'complete',
    name: 'Percent complete',
    definition:
      'Done tickets divided by all tickets. If at least 80% of tickets have story points, done points divided by points on those tickets.',
  },
  {
    id: 'netFlow',
    name: 'Net flow',
    definition:
      'Tickets created in a week minus tickets resolved that week. Positive means the backlog grew.',
  },
  {
    id: 'slip',
    name: 'Schedule variance',
    definition:
      'Forecast date minus planned date, in calendar days, for milestones that are not complete. Positive means slipped.',
  },
  {
    id: 'delta',
    name: 'Change vs 7 days',
    definition:
      'Current value minus the history point closest to seven days earlier. Shown as n/a when that point is missing.',
  },
  {
    id: 'assigned',
    name: 'Assigned project',
    definition:
      'A project is in a person’s view when they are the PMO lead, or they are the assignee on at least one open ticket. The table marks that as Lead or Contributor. Unassigned covers a missing lead or an open ticket with no assignee.',
  },
  {
    id: 'daysBlocked',
    name: 'Days blocked',
    definition:
      'Days since the blocked ticket was last updated. The snapshot has no blocked-since timestamp, so this is the time sitting in the current update.',
  },
  {
    id: 'portfolioHealth',
    name: 'Projects by health',
    definition:
      'Red, amber, green, or no data. Red wins over amber. A project with no updates and no reported health is No data, never Green. A PMO override wins.',
  },
  {
    id: 'activeProjects',
    name: 'Active projects',
    definition: 'Projects whose phase is Active.',
  },
  {
    id: 'blockedProjects',
    name: 'Blocked projects',
    definition: 'Projects with at least one open update marked blocked.',
  },
  {
    id: 'openRisks',
    name: 'Open high or critical risks',
    definition: 'Risks that are not closed and are marked high or critical.',
  },
  {
    id: 'staleProjects',
    name: 'No recent update',
    definition:
      'Projects whose latest update is at least the amber silence threshold (default 10 days). Projects with no updates are No data, not counted here.',
  },
  {
    id: 'milestonesDue',
    name: 'Milestones due in 14 days',
    definition:
      'Next milestone dates, or incomplete milestone dates, from the snapshot day through 14 calendar days later. Shown as n/a when the snapshot has no milestone dates.',
  },
  {
    id: 'updatesWeek',
    name: 'Updates this week',
    definition:
      'Updates dated in the seven calendar days ending on the snapshot day. The change versus the previous week is shown when history has an earlier point.',
  },
  {
    id: 'portfolioAssigned',
    name: 'Assigned project',
    definition:
      'A project is in a person’s view when they are the lead, or they are the author or owner on an open update. Unassigned covers a missing lead or an open update with no author or owner.',
  },
];
