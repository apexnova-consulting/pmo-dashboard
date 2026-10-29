import type { HistoryPoint, Project, Risk, Snapshot, Update } from '@/data/schema';
import type { PortfolioHealthOptions } from './health';
import { explainPortfolioHealth } from './health';
import { addDaysYmd, calendarDate } from './dates';
import type { RagResult } from './metrics';

export interface PortfolioKpis {
  byRag: { red: number; amber: number; green: number; none: number };
  active: number | null;
  blockedProjects: number | null;
  openHighCriticalRisks: number | null;
  staleProjects: number | null;
  staleDays: number;
  milestonesDue14: number | null;
  updatesThisWeek: number | null;
  updatesDelta: number | null;
}

function historyNear(history: HistoryPoint[], day: string): HistoryPoint | null {
  const target = addDaysYmd(day, -7);
  let best: HistoryPoint | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const point of history) {
    if (point.date >= day) continue;
    const dist = Math.abs(
      (Date.parse(`${point.date}T00:00:00Z`) - Date.parse(`${target}T00:00:00Z`)) / 86_400_000,
    );
    if (dist < bestDist) {
      best = point;
      bestDist = dist;
    }
  }
  return best;
}

export function countUpdatesThisWeek(updates: Update[], asOfDay: string): number {
  const start = addDaysYmd(asOfDay, -7);
  return updates.filter((update) => update.date > start && update.date <= asOfDay).length;
}

export function portfolioKpis(
  snapshot: Pick<
    Snapshot,
    'projects' | 'updates' | 'risks' | 'milestones' | 'history' | 'generatedAt' | 'meta'
  >,
  projects: { project: Project; rag: RagResult }[],
  options: PortfolioHealthOptions,
): PortfolioKpis {
  const timeZone = snapshot.meta.timezone || 'America/New_York';
  const asOfDay = calendarDate(snapshot.generatedAt, timeZone);
  const updatesKnown = snapshot.updates != null;
  const risksKnown = snapshot.risks != null;
  const byRag = { red: 0, amber: 0, green: 0, none: 0 };
  for (const project of projects) {
    if (project.project.phase === 'closed') continue;
    byRag[project.rag.rag] += 1;
  }
  const active = snapshot.projects.filter((project) => project.phase === 'active').length;
  const blockedProjects = updatesKnown
    ? new Set(
        snapshot.updates
          .filter((update) => update.status === 'open' && update.blocked)
          .map((update) => update.projectKey),
      ).size
    : null;
  const openHighCriticalRisks = risksKnown
    ? snapshot.risks.filter(
        (risk) =>
          risk.status !== 'closed' && (risk.riskLevel === 'high' || risk.riskLevel === 'critical'),
      ).length +
      snapshot.updates.filter(
        (update) =>
          update.type === 'risk' &&
          update.status === 'open' &&
          (update.riskLevel === 'high' || update.riskLevel === 'critical') &&
          !snapshot.risks.some(
            (risk) =>
              risk.projectKey === update.projectKey &&
              risk.status !== 'closed' &&
              risk.riskLevel === update.riskLevel,
          ),
      ).length
    : null;

  const staleProjects = updatesKnown
    ? projects.filter((project) => {
        if (project.project.phase === 'closed') return false;
        const latest = snapshot.updates
          .filter((update) => update.projectKey === project.project.key)
          .map((update) => update.date)
          .sort()
          .at(-1);
        if (!latest) return false;
        const age =
          (Date.parse(`${asOfDay}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / 86_400_000;
        return age >= options.staleAmberDays;
      }).length
    : null;

  const milestoneDates = [
    ...snapshot.projects
      .map((project) => project.nextMilestoneDate)
      .filter((date): date is string => Boolean(date)),
    ...snapshot.milestones
      .filter((milestone) => !milestone.completedDate)
      .map((milestone) => milestone.forecastDate ?? milestone.plannedDate),
  ];
  const hasMilestoneSignal = milestoneDates.length > 0;
  const horizon = addDaysYmd(asOfDay, 14);
  const milestonesDue14 = hasMilestoneSignal
    ? new Set(milestoneDates.filter((date) => date >= asOfDay && date <= horizon)).size
    : null;

  const updatesThisWeek = updatesKnown ? countUpdatesThisWeek(snapshot.updates, asOfDay) : null;
  const prior = historyNear(snapshot.history, asOfDay);
  const previousWeek = updatesKnown
    ? snapshot.updates.filter((update) => {
        const start = addDaysYmd(asOfDay, -14);
        const end = addDaysYmd(asOfDay, -7);
        return update.date > start && update.date <= end;
      }).length
    : null;
  const updatesDelta =
    updatesThisWeek == null || previousWeek == null || snapshot.history.length === 0 || !prior
      ? null
      : updatesThisWeek - previousWeek;

  return {
    byRag,
    active,
    blockedProjects,
    openHighCriticalRisks,
    staleProjects,
    staleDays: options.staleAmberDays,
    milestonesDue14,
    updatesThisWeek,
    updatesDelta,
  };
}

export function projectHealthFor(
  snapshot: Snapshot,
  project: Project,
  options: PortfolioHealthOptions,
): RagResult {
  return explainPortfolioHealth(
    project,
    snapshot.updates,
    snapshot.risks,
    snapshot.generatedAt,
    snapshot.meta.timezone || 'America/New_York',
    options,
  );
}

export function isActiveRisk(risk: Pick<Risk, 'status'>): boolean {
  return risk.status !== 'closed';
}
