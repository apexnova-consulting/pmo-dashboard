import type {
  HistoryPoint,
  Milestone,
  Priority,
  Project,
  Risk,
  Snapshot,
  TeamMember,
  Ticket,
  Update,
} from '@/data/schema';
import type { DomainOptions } from '@/lib/config';
import { countAging } from './aging';
import { addDaysYmd, calendarDate, calendarDaysBetween } from './dates';
import {
  isAllOwners,
  portfolioProjectRole,
  projectRole,
  ticketMatchesOwner,
  type OwnerSelection,
} from './filters';
import { explainPortfolioHealth, portfolioHealthOptions } from './health';
import { getMode, type DashboardMode } from './mode';
import {
  completionOf,
  explainRag,
  milestoneSlipDays,
  priorityRank,
  ticketFacts,
  type RagResult,
} from './metrics';
import { portfolioKpis, type PortfolioKpis } from './portfolio';

export interface EnrichedTicket {
  ticket: Ticket;
  open: boolean;
  overdue: boolean;
  dueSoon: boolean;
  blocked: boolean;
  stale: boolean;
  ageDays: number;
  daysOverdue: number | null;
  daysSinceUpdate: number;
  resolvedWithin7: boolean;
  resolvedWithin30: boolean;
  projectName: string;
  assignee: TeamMember | null;
}

export interface EnrichedMilestone {
  milestone: Milestone;
  slipDays: number | null;
  slipped: boolean;
  upcoming: boolean;
}

export interface EnrichedUpdate {
  update: Update;
  projectName: string;
  author: TeamMember | null;
  ageDays: number;
}

export interface LeadLoadRow {
  id: string;
  name: string;
  color: string;
  projects: number;
  blocked: number;
  openRisks: number;
  latestUpdate: string | null;
}

export interface EnrichedProject {
  project: Project;
  rag: RagResult;
  open: number;
  overdue: number;
  blocked: number;
  done: number;
  total: number;
  completion: {
    ratio: number | null;
    basis: 'count' | 'story_points' | 'none' | 'reported';
  };
  nextMilestone: EnrichedMilestone | null;
  lastUpdated: string | null;
  trend: HistoryPoint['ragCounts'] extends never ? never : ('red' | 'amber' | 'green')[];
  role: 'lead' | 'contributor' | 'unassigned' | null;
  lead: TeamMember | null;
  openRisks: number;
}

export interface WeekPoint {
  date: string;
  created: number;
  resolved: number;
  open: number;
  red: number;
  amber: number;
  green: number;
}

export interface WorkloadRow {
  id: string;
  name: string;
  color: string;
  open: number;
  overdue: number;
  dueSoon: number;
  blocked: number;
  resolved30: number;
  avgAge: number | null;
  weeklyCapacity: number | null;
  byPriority: Record<Priority, number>;
}

export interface DashboardModel {
  asOf: string;
  timeZone: string;
  mode: DashboardMode;
  jiraBaseUrl: string | null;
  nextScheduledRun: string | null;
  team: TeamMember[];
  filtered: boolean;
  tickets: EnrichedTicket[];
  projects: EnrichedProject[];
  milestones: EnrichedMilestone[];
  risks: Risk[];
  kpis: {
    projects: { red: number; amber: number; green: number; total: number };
    open: number;
    openDelta: number | null;
    overdue: number;
    overdueDelta: number | null;
    dueSoon: number;
    blocked: number;
    throughput: number;
    throughputSeries: number[];
    netFlow: number | null;
  };
  attention: { id: string; label: string; href: string; tone: 'red' | 'amber' }[];
  needsAttention: EnrichedTicket[];
  upcoming: { day: string; items: EnrichedMilestone[] }[];
  weeks: WeekPoint[];
  statusCounts: { todo: number; in_progress: number; done: number };
  aging: ReturnType<typeof countAging>;
  overdueByProject: { key: string; name: string; count: number }[];
  blockedTickets: EnrichedTicket[];
  staleTickets: EnrichedTicket[];
  workload: WorkloadRow[];
  updates: EnrichedUpdate[];
  portfolioKpis: PortfolioKpis | null;
  needsProjects: EnrichedProject[];
  leadLoad: LeadLoadRow[];
  myWork: {
    groups: { id: string; title: string; tickets: EnrichedTicket[] }[];
    leadProjects: EnrichedProject[];
    recentlyResolved: EnrichedTicket[];
  };
}

const RAG_ORDER = { red: 0, amber: 1, green: 2, none: 3 } as const;
const EMPTY_PRIORITY: Record<Priority, number> = {
  highest: 0,
  high: 0,
  medium: 0,
  low: 0,
  lowest: 0,
};

function closestHistory(history: HistoryPoint[], asOfDay: string): HistoryPoint | null {
  const target = addDaysYmd(asOfDay, -7);
  let best: HistoryPoint | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const point of history) {
    if (point.date >= asOfDay) continue;
    const dist = Math.abs(calendarDaysBetween(point.date, target));
    if (dist < bestDist || (dist === bestDist && best && point.date < best.date)) {
      best = point;
      bestDist = dist;
    }
  }
  return best;
}

function weekSeries(
  snapshot: Snapshot,
  tickets: Ticket[],
  projectKeys: Set<string>,
  filtered: boolean,
): WeekPoint[] {
  const timeZone = snapshot.meta.timezone;
  const asOfDay = calendarDate(snapshot.generatedAt, timeZone);
  const history = [...snapshot.history].sort((a, b) => a.date.localeCompare(b.date));
  if (!filtered && history.length > 0) {
    return history.slice(-12).map((point) => ({
      date: point.date,
      created: point.created ?? 0,
      resolved: point.resolved ?? 0,
      open: point.open ?? 0,
      red: point.ragCounts.red,
      amber: point.ragCounts.amber,
      green: point.ragCounts.green,
    }));
  }
  const dates = history.length
    ? history.map((point) => point.date).slice(-12)
    : Array.from({ length: 12 }, (_, index) => addDaysYmd(asOfDay, -7 * (11 - index)));
  return dates.map((date, index) => {
    const prev = index === 0 ? addDaysYmd(date, -7) : dates[index - 1]!;
    let created = 0;
    let resolved = 0;
    let open = 0;
    for (const ticket of tickets) {
      const createdDay = calendarDate(ticket.created, timeZone);
      if (createdDay > prev && createdDay <= date) created += 1;
      if (ticket.resolvedAt) {
        const resolvedDay = calendarDate(ticket.resolvedAt, timeZone);
        if (resolvedDay > prev && resolvedDay <= date) resolved += 1;
      }
      if (createdDay <= date) {
        const stillOpen =
          ticket.statusCategory !== 'done'
            ? !ticket.resolvedAt || calendarDate(ticket.resolvedAt, timeZone) > date
            : ticket.resolvedAt != null && calendarDate(ticket.resolvedAt, timeZone) > date;
        if (stillOpen && ticket.statusCategory !== 'done') open += 1;
        if (
          ticket.statusCategory === 'done' &&
          ticket.resolvedAt &&
          calendarDate(ticket.resolvedAt, timeZone) > date &&
          createdDay <= date
        ) {
          open += 1;
        }
      }
    }
    const point = history.find((item) => item.date === date);
    const counts = { red: 0, amber: 0, green: 0 };
    if (point?.byProject) {
      for (const [key, rag] of Object.entries(point.byProject)) {
        if (!projectKeys.has(key)) continue;
        counts[rag] += 1;
      }
    }
    return { date, created, resolved, open, ...counts };
  });
}

function throughputSeries(tickets: EnrichedTicket[], asOfDay: string, timeZone: string): number[] {
  return Array.from({ length: 8 }, (_, index) => {
    const end = addDaysYmd(asOfDay, -7 * (7 - index));
    const start = addDaysYmd(end, -7);
    return tickets.filter((item) => {
      if (!item.ticket.resolvedAt) return false;
      const day = calendarDate(item.ticket.resolvedAt, timeZone);
      return day > start && day <= end;
    }).length;
  });
}

export function jiraUrl(
  base: string | null | undefined,
  key: string,
  explicit?: string,
): string | null {
  if (explicit) return explicit;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/browse/${encodeURIComponent(key)}`;
}

export function deriveDashboard(
  snapshot: Snapshot,
  selection: OwnerSelection,
  options: DomainOptions,
): DashboardModel {
  const timeZone = snapshot.meta.timezone || 'America/New_York';
  const asOf = snapshot.generatedAt;
  const asOfDay = calendarDate(asOf, timeZone);
  const mode = getMode(snapshot);
  const teamById = new Map(snapshot.team.map((member) => [member.id, member]));
  const projectByKey = new Map(snapshot.projects.map((project) => [project.key, project]));
  const filtered = !isAllOwners(selection);
  const healthOptions = portfolioHealthOptions();

  const allEnriched: EnrichedTicket[] = snapshot.tickets.map((ticket) => {
    const facts = ticketFacts(ticket, asOf, timeZone, options);
    return {
      ticket,
      ...facts,
      projectName: projectByKey.get(ticket.projectKey)?.name ?? ticket.projectKey,
      assignee: ticket.assigneeId ? (teamById.get(ticket.assigneeId) ?? null) : null,
    };
  });

  const openForRole = allEnriched.filter((item) => item.open).map((item) => item.ticket);
  const scopedTickets = allEnriched.filter((item) => ticketMatchesOwner(item.ticket, selection));

  const projects: EnrichedProject[] = snapshot.projects
    .map((project) => {
      const projectTickets = allEnriched.filter((item) => item.ticket.projectKey === project.key);
      const scoped = filtered
        ? projectTickets.filter((item) => ticketMatchesOwner(item.ticket, selection))
        : projectTickets;
      const role =
        mode === 'portfolio'
          ? portfolioProjectRole(project, snapshot.updates, selection)
          : projectRole(project, openForRole, selection);
      const milestones = snapshot.milestones.filter(
        (milestone) => milestone.projectKey === project.key,
      );
      const projectUpdates = snapshot.updates.filter((update) => update.projectKey === project.key);
      const rag =
        mode === 'portfolio'
          ? explainPortfolioHealth(
              project,
              snapshot.updates,
              snapshot.risks,
              asOf,
              timeZone,
              healthOptions,
            )
          : explainRag(
              project,
              projectTickets.map((item) => item.ticket),
              milestones,
              asOf,
              timeZone,
              options,
            );
      const incomplete = milestones
        .filter((milestone) => !milestone.completedDate)
        .map((milestone) => ({
          milestone,
          slipDays: milestoneSlipDays(milestone),
          slipped: (milestoneSlipDays(milestone) ?? 0) > 0,
          upcoming: false,
        }))
        .sort((a, b) => {
          const aDate = a.milestone.forecastDate ?? a.milestone.plannedDate;
          const bDate = b.milestone.forecastDate ?? b.milestone.plannedDate;
          return aDate.localeCompare(bDate);
        });
      const lastUpdated =
        mode === 'portfolio'
          ? (projectUpdates
              .map((update) => update.date)
              .sort()
              .at(-1) ??
            project.lastUpdateDate ??
            null)
          : projectTickets.reduce<string | null>((latest, item) => {
              if (!latest || item.ticket.updated > latest) return item.ticket.updated;
              return latest;
            }, null);
      const reportedCompletion =
        project.percentComplete == null
          ? null
          : { ratio: project.percentComplete / 100, basis: 'reported' as const };
      const trend = [...snapshot.history]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-8)
        .map((point) => point.byProject?.[project.key])
        .filter((ragLevel): ragLevel is 'red' | 'amber' | 'green' => ragLevel != null);
      return {
        project,
        rag,
        open: scoped.filter((item) => item.open).length,
        overdue: scoped.filter((item) => item.overdue).length,
        blocked:
          mode === 'portfolio'
            ? projectUpdates.filter((update) => update.status === 'open' && update.blocked).length
            : scoped.filter((item) => item.blocked).length,
        done: scoped.filter((item) => item.ticket.statusCategory === 'done').length,
        total: scoped.length,
        completion:
          mode === 'portfolio' && reportedCompletion
            ? reportedCompletion
            : completionOf(scoped.map((item) => item.ticket)),
        nextMilestone: incomplete[0] ?? null,
        lastUpdated,
        trend,
        role: filtered ? role : project.leadId == null ? 'unassigned' : null,
        lead: project.leadId ? (teamById.get(project.leadId) ?? null) : null,
        openRisks: snapshot.risks.filter(
          (risk) => risk.projectKey === project.key && risk.status !== 'closed',
        ).length,
      };
    })
    .filter((project) => (filtered ? project.role != null : true))
    .sort((a, b) => {
      const ragDiff = RAG_ORDER[a.rag.rag] - RAG_ORDER[b.rag.rag];
      if (ragDiff !== 0) return ragDiff;
      if (mode === 'portfolio') return b.blocked - a.blocked || b.openRisks - a.openRisks;
      return b.overdue - a.overdue;
    });

  const inScope = new Set(projects.map((project) => project.project.key));
  const visibleTickets = scopedTickets;

  const milestones: EnrichedMilestone[] = snapshot.milestones
    .filter((milestone) => !filtered || inScope.has(milestone.projectKey))
    .map((milestone) => {
      const slipDays = milestoneSlipDays(milestone);
      const when = milestone.forecastDate ?? milestone.plannedDate;
      const upcoming =
        !milestone.completedDate && when >= asOfDay && when <= addDaysYmd(asOfDay, 14);
      return { milestone, slipDays, slipped: (slipDays ?? 0) > 0, upcoming };
    });

  const risks = (snapshot.risks ?? []).filter((risk) => {
    if (!filtered) return true;
    if (risk.ownerId == null) return selection.includeUnassigned || inScope.has(risk.projectKey);
    if (selection.ids.includes(risk.ownerId)) return true;
    return inScope.has(risk.projectKey);
  });

  const projectCounts = {
    red: projects.filter((project) => project.rag.rag === 'red').length,
    amber: projects.filter((project) => project.rag.rag === 'amber').length,
    green: projects.filter((project) => project.rag.rag === 'green').length,
    total: projects.filter((project) => project.project.phase !== 'closed').length,
  };

  const historyPoint = closestHistory(snapshot.history, asOfDay);
  const open = visibleTickets.filter((item) => item.open).length;
  const overdue = visibleTickets.filter((item) => item.overdue).length;
  const weeks = weekSeries(
    snapshot,
    visibleTickets.map((item) => item.ticket),
    inScope,
    filtered,
  );
  const lastWeek = weeks.at(-1);

  const blockedLong = visibleTickets.filter(
    (item) => item.blocked && item.daysSinceUpdate > 5,
  ).length;
  const attention: DashboardModel['attention'] = [];
  if (mode === 'tickets' && overdue > 0) {
    attention.push({
      id: 'overdue',
      label: `${overdue} overdue ${overdue === 1 ? 'ticket' : 'tickets'}`,
      href: '/tickets?chip=overdue',
      tone: 'red',
    });
  }
  if (projectCounts.red > 0) {
    attention.push({
      id: 'red',
      label: `${projectCounts.red} ${projectCounts.red === 1 ? 'project' : 'projects'} Red`,
      href: '/projects?rag=red',
      tone: 'red',
    });
  }
  if (mode === 'tickets' && blockedLong > 0) {
    attention.push({
      id: 'blocked',
      label: `${blockedLong} blocked more than 5 days`,
      href: '/risks',
      tone: 'amber',
    });
  }

  const needsAttention = visibleTickets
    .filter((item) => item.overdue || item.blocked)
    .sort((a, b) => {
      const severity =
        Number(b.blocked && b.overdue) - Number(a.blocked && a.overdue) ||
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.blocked) - Number(a.blocked) ||
        priorityRank(a.ticket.priority) - priorityRank(b.ticket.priority) ||
        (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0) ||
        b.ageDays - a.ageDays;
      return severity;
    })
    .slice(0, 10);

  const upcomingMap = new Map<string, EnrichedMilestone[]>();
  for (const item of milestones.filter((milestone) => milestone.upcoming)) {
    const day = item.milestone.forecastDate ?? item.milestone.plannedDate;
    const list = upcomingMap.get(day) ?? [];
    list.push(item);
    upcomingMap.set(day, list);
  }
  const upcoming = [...upcomingMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, items]) => ({ day, items }));

  const statusCounts = {
    todo: visibleTickets.filter((item) => item.ticket.statusCategory === 'todo').length,
    in_progress: visibleTickets.filter((item) => item.ticket.statusCategory === 'in_progress')
      .length,
    done: visibleTickets.filter((item) => item.ticket.statusCategory === 'done').length,
  };

  const people: { id: string; name: string; color: string; capacity: number | null }[] = [
    ...snapshot.team.map((member) => ({
      id: member.id,
      name: member.displayName,
      color: member.avatarColor || 'var(--series-2)',
      capacity: member.weeklyCapacity ?? null,
    })),
    { id: 'unassigned', name: 'Unassigned', color: 'var(--series-neutral)', capacity: null },
  ];
  const visiblePeople = people.filter((person) => {
    if (!filtered) return true;
    if (person.id === 'unassigned') return selection.includeUnassigned;
    return selection.ids.includes(person.id);
  });

  const workload: WorkloadRow[] = visiblePeople.map((person) => {
    const rows = visibleTickets.filter((item) =>
      person.id === 'unassigned'
        ? item.ticket.assigneeId == null
        : item.ticket.assigneeId === person.id,
    );
    const openRows = rows.filter((item) => item.open);
    const byPriority = { ...EMPTY_PRIORITY };
    for (const item of openRows) byPriority[item.ticket.priority] += 1;
    const avgAge = openRows.length
      ? openRows.reduce((sum, item) => sum + item.ageDays, 0) / openRows.length
      : null;
    return {
      id: person.id,
      name: person.name,
      color: person.color,
      open: openRows.length,
      overdue: rows.filter((item) => item.overdue).length,
      dueSoon: rows.filter((item) => item.dueSoon).length,
      blocked: rows.filter((item) => item.blocked).length,
      resolved30: rows.filter((item) => item.resolvedWithin30).length,
      avgAge,
      weeklyCapacity: person.capacity,
      byPriority,
    };
  });

  const groupOf = (item: EnrichedTicket) => {
    if (!item.open) return null;
    if (item.overdue) return 'overdue';
    if (item.dueSoon) return 'dueSoon';
    if (item.blocked) return 'blocked';
    if (item.ticket.dueDate) return 'later';
    return 'none';
  };
  const groupTitles: { id: string; title: string }[] = [
    { id: 'overdue', title: 'Overdue' },
    { id: 'dueSoon', title: 'Due this week' },
    { id: 'later', title: 'Due later' },
    { id: 'none', title: 'No due date' },
    { id: 'blocked', title: 'Blocked' },
  ];
  const myWork = {
    groups: groupTitles.map((group) => ({
      ...group,
      tickets: visibleTickets
        .filter((item) => groupOf(item) === group.id)
        .sort(
          (a, b) =>
            priorityRank(a.ticket.priority) - priorityRank(b.ticket.priority) ||
            a.ageDays - b.ageDays,
        ),
    })),
    leadProjects: projects.filter((project) => {
      if (isAllOwners(selection))
        return project.project.leadId != null && project.project.phase !== 'closed';
      return selection.ids.includes(project.project.leadId ?? '');
    }),
    recentlyResolved: visibleTickets
      .filter((item) => item.resolvedWithin7)
      .sort((a, b) => (b.ticket.resolvedAt ?? '').localeCompare(a.ticket.resolvedAt ?? '')),
  };

  const openDelta = !filtered && historyPoint?.open != null ? open - historyPoint.open : null;
  const overdueDelta =
    !filtered && historyPoint?.overdue != null ? overdue - historyPoint.overdue : null;

  const updates: EnrichedUpdate[] = snapshot.updates
    .filter((update) => !filtered || inScope.has(update.projectKey))
    .map((update) => ({
      update,
      projectName: projectByKey.get(update.projectKey)?.name ?? update.projectKey,
      author: update.authorId ? (teamById.get(update.authorId) ?? null) : null,
      ageDays: calendarDaysBetween(asOfDay, update.date),
    }))
    .sort(
      (a, b) =>
        b.update.date.localeCompare(a.update.date) || b.update.id.localeCompare(a.update.id),
    );

  const needsProjects = projects
    .filter(
      (project) =>
        project.rag.rag === 'red' ||
        project.blocked > 0 ||
        project.rag.reasons.some((reason) => reason.rule === 'No recent update'),
    )
    .slice(0, 10);

  const peopleForLeads: { id: string; name: string; color: string }[] = [
    ...snapshot.team.map((member) => ({
      id: member.id,
      name: member.displayName,
      color: member.avatarColor || 'var(--series-2)',
    })),
    { id: 'unassigned', name: 'Unassigned', color: 'var(--series-neutral)' },
  ];
  const leadLoad: LeadLoadRow[] = peopleForLeads
    .filter((person) => {
      if (!filtered) return true;
      if (person.id === 'unassigned') return selection.includeUnassigned;
      return selection.ids.includes(person.id);
    })
    .map((person) => {
      const led = projects.filter((project) =>
        person.id === 'unassigned'
          ? project.project.leadId == null
          : project.project.leadId === person.id,
      );
      const latest = led
        .map((project) => project.lastUpdated)
        .filter((date): date is string => Boolean(date))
        .sort()
        .at(-1);
      return {
        id: person.id,
        name: person.name,
        color: person.color,
        projects: led.length,
        blocked: led.filter((project) => project.blocked > 0).length,
        openRisks: led.reduce((sum, project) => sum + project.openRisks, 0),
        latestUpdate: latest ?? null,
      };
    });

  if (mode === 'portfolio') {
    attention.length = 0;
    if (projectCounts.red > 0) {
      attention.push({
        id: 'red',
        label: `${projectCounts.red} ${projectCounts.red === 1 ? 'project' : 'projects'} Red`,
        href: '/projects?rag=red',
        tone: 'red',
      });
    }
    const blockedProjects = projects.filter((project) => project.blocked > 0).length;
    if (blockedProjects > 0) {
      attention.push({
        id: 'blocked',
        label: `${blockedProjects} blocked ${blockedProjects === 1 ? 'project' : 'projects'}`,
        href: '/risks',
        tone: 'red',
      });
    }
    const staleCount = projects.filter((project) =>
      project.rag.reasons.some((reason) => reason.rule === 'No recent update'),
    ).length;
    if (staleCount > 0) {
      attention.push({
        id: 'stale',
        label: `${staleCount} ${staleCount === 1 ? 'project' : 'projects'} with no recent update`,
        href: '/risks',
        tone: 'amber',
      });
    }
    const dueSoon = projects.filter((project) => {
      const date = project.project.nextMilestoneDate;
      return date != null && date >= asOfDay && date <= addDaysYmd(asOfDay, 14);
    }).length;
    if (dueSoon > 0) {
      attention.push({
        id: 'milestones',
        label: `${dueSoon} ${dueSoon === 1 ? 'milestone' : 'milestones'} due in 14 days`,
        href: '/projects',
        tone: 'amber',
      });
    }
  }

  const kpisPortfolio =
    mode === 'portfolio'
      ? portfolioKpis(
          {
            ...snapshot,
            projects: projects.map((project) => project.project),
            updates: snapshot.updates.filter((update) => inScope.has(update.projectKey)),
            risks,
            milestones: snapshot.milestones.filter((milestone) =>
              inScope.has(milestone.projectKey),
            ),
            history: filtered ? [] : snapshot.history,
          },
          projects,
          healthOptions,
        )
      : null;

  return {
    asOf,
    timeZone,
    mode,
    jiraBaseUrl: snapshot.meta.jiraBaseUrl ?? null,
    nextScheduledRun: snapshot.meta.nextScheduledRun ?? null,
    team: snapshot.team,
    filtered,
    tickets: visibleTickets,
    projects,
    milestones,
    risks,
    kpis: {
      projects: projectCounts,
      open,
      openDelta,
      overdue,
      overdueDelta,
      dueSoon: visibleTickets.filter((item) => item.dueSoon).length,
      blocked: visibleTickets.filter((item) => item.blocked).length,
      throughput: visibleTickets.filter((item) => item.resolvedWithin7).length,
      throughputSeries: throughputSeries(visibleTickets, asOfDay, timeZone),
      netFlow: lastWeek ? lastWeek.created - lastWeek.resolved : null,
    },
    attention: attention.slice(0, mode === 'portfolio' ? 4 : 3),
    updates,
    portfolioKpis: kpisPortfolio,
    needsProjects,
    leadLoad,
    needsAttention,
    upcoming,
    weeks,
    statusCounts,
    aging: countAging(visibleTickets),
    overdueByProject: projects
      .map((project) => ({
        key: project.project.key,
        name: project.project.name,
        count: project.overdue,
      }))
      .filter((project) => project.count > 0)
      .sort((a, b) => b.count - a.count),
    blockedTickets: visibleTickets
      .filter((item) => item.blocked)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate),
    staleTickets: visibleTickets
      .filter((item) => item.stale)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate),
    workload,
    myWork,
  };
}

export function phaseLabel(phase: Project['phase']): string {
  switch (phase) {
    case 'intake':
      return 'Intake';
    case 'planning':
      return 'Planning';
    case 'active':
      return 'Active';
    case 'on_hold':
      return 'On hold';
    case 'closing':
      return 'Closing';
    case 'closed':
      return 'Closed';
    default:
      return phase;
  }
}

export function priorityLabel(priority: Priority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
