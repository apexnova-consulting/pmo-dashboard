import type { Project, Risk, Update } from '@/data/schema';
import { RAG_CONFIG } from '@/lib/config';
import { calendarDate, calendarDaysBetween } from './dates';
import type { RagReason, RagResult } from './metrics';

export interface PortfolioHealthOptions {
  blockedRedDays: number;
  staleRedDays: number;
  staleAmberDays: number;
}

export function portfolioHealthOptions(
  rag: typeof RAG_CONFIG = RAG_CONFIG,
): PortfolioHealthOptions {
  return rag.portfolio;
}

function latestUpdate(updates: Update[]): Update | null {
  return updates.reduce<Update | null>((latest, update) => {
    if (!latest || update.date > latest.date) return update;
    return latest;
  }, null);
}

export function explainPortfolioHealth(
  project: Project,
  updates: Update[],
  risks: Risk[],
  asOfIso: string,
  timeZone: string,
  options: PortfolioHealthOptions = portfolioHealthOptions(),
): RagResult {
  const asOfDay = calendarDate(asOfIso, timeZone);
  const projectUpdates = updates.filter((update) => update.projectKey === project.key);
  const projectRisks = risks.filter((risk) => risk.projectKey === project.key);
  const reasons: RagReason[] = [];
  const consider = (level: 'red' | 'amber', fired: boolean, rule: string, detail: string) => {
    if (fired) reasons.push({ level, rule, detail });
  };

  if (project.reportedHealth === 'red') {
    consider('red', true, 'Reported health', 'The project lead reported Red.');
  }
  if (project.reportedHealth === 'amber') {
    consider('amber', true, 'Reported health', 'The project lead reported Amber.');
  }

  const openBlocked = projectUpdates.filter((update) => update.status === 'open' && update.blocked);
  const oldestBlocked = openBlocked.reduce((max, update) => {
    const age = calendarDaysBetween(asOfDay, update.date);
    return age > max ? age : max;
  }, 0);
  consider(
    'red',
    openBlocked.some(
      (update) => calendarDaysBetween(asOfDay, update.date) > options.blockedRedDays,
    ),
    'Blocked update',
    `An open blocked update is ${oldestBlocked} days old (red after ${options.blockedRedDays}).`,
  );
  consider(
    'amber',
    openBlocked.length > 0 &&
      !openBlocked.some(
        (update) => calendarDaysBetween(asOfDay, update.date) > options.blockedRedDays,
      ),
    'Blocked update',
    `${openBlocked.length} open blocked ${openBlocked.length === 1 ? 'update' : 'updates'}.`,
  );

  const activeRisks = [
    ...projectRisks.filter((risk) => risk.status !== 'closed'),
    ...projectUpdates.filter((update) => update.status === 'open' && update.riskLevel),
  ];
  const critical = activeRisks.some((item) => item.riskLevel === 'critical');
  const high = activeRisks.some((item) => item.riskLevel === 'high');
  consider('red', critical, 'Critical risk', 'An open critical risk is recorded.');
  consider(
    'amber',
    high && !critical,
    'High risk',
    'An open high risk is recorded, and none are critical.',
  );

  const endPassed =
    project.targetEndDate != null &&
    project.targetEndDate < asOfDay &&
    project.phase !== 'closing' &&
    project.phase !== 'closed';
  consider(
    'red',
    endPassed,
    'Target end date',
    `The target end date ${project.targetEndDate} is before the snapshot day, and the phase is not closing or closed.`,
  );

  const nextDate = project.nextMilestoneDate;
  consider(
    'amber',
    nextDate != null && nextDate < asOfDay,
    'Next milestone',
    `The next milestone date ${nextDate} is before the snapshot day.`,
  );

  const latest = latestUpdate(projectUpdates);
  if (latest) {
    const silent = calendarDaysBetween(asOfDay, latest.date);
    consider(
      'red',
      silent >= options.staleRedDays,
      'No recent update',
      `The latest update is ${silent} days old (red at ${options.staleRedDays}).`,
    );
    consider(
      'amber',
      silent >= options.staleAmberDays && silent < options.staleRedDays,
      'No recent update',
      `The latest update is ${silent} days old (amber at ${options.staleAmberDays}).`,
    );
  }

  const hasRed = reasons.some((reason) => reason.level === 'red');
  const hasAmber = reasons.some((reason) => reason.level === 'amber');
  const noSignal = projectUpdates.length === 0 && project.reportedHealth == null;

  if (project.healthOverride) {
    return {
      rag: project.healthOverride,
      reasons,
      overridden: true,
      note: project.healthNote ?? null,
    };
  }

  if (!hasRed && !hasAmber && noSignal) {
    return {
      rag: 'none',
      reasons: [
        {
          level: 'amber',
          rule: 'No data',
          detail: 'This project has no updates and no reported health, so it is not marked Green.',
        },
      ],
      overridden: false,
      note: project.healthNote ?? null,
    };
  }

  const rag = hasRed ? 'red' : hasAmber ? 'amber' : 'green';
  return {
    rag,
    reasons: reasons.filter((reason) => reason.level === rag),
    overridden: false,
    note: project.healthNote ?? null,
  };
}
