import { describe, expect, it } from 'vitest';
import type { Project, Risk, Update } from '@/data/schema';
import { explainPortfolioHealth } from './health';

const asOf = '2026-10-28T06:00:00-04:00';
const zone = 'America/New_York';
const options = { blockedRedDays: 5, staleRedDays: 21, staleAmberDays: 10 };

function project(partial: Partial<Project> = {}): Project {
  return {
    key: 'SIS',
    name: 'SIS',
    leadId: 'shuchi',
    phase: 'active',
    ...partial,
  };
}

function note(partial: Partial<Update> & Pick<Update, 'id' | 'date'>): Update {
  return {
    projectKey: 'SIS',
    type: 'update',
    title: 'Note',
    summary: 'Note',
    authorId: 'shuchi',
    authorName: 'Shuchi',
    healthSignal: null,
    riskLevel: null,
    blocked: false,
    status: 'open',
    ownerId: 'shuchi',
    source: 'list',
    ...partial,
  };
}

describe('portfolio health', () => {
  it('is No data when nothing has been reported', () => {
    const result = explainPortfolioHealth(project(), [], [], asOf, zone, options);
    expect(result.rag).toBe('none');
    expect(result.reasons[0]?.rule).toBe('No data');
  });

  it('lets a PMO override win', () => {
    const result = explainPortfolioHealth(
      project({ healthOverride: 'green', healthNote: 'Accepted' }),
      [],
      [],
      asOf,
      zone,
      options,
    );
    expect(result.rag).toBe('green');
    expect(result.overridden).toBe(true);
  });

  it('turns red on a reported red, a critical risk, or a passed end date', () => {
    expect(
      explainPortfolioHealth(
        project({ reportedHealth: 'red' }),
        [note({ id: 'a', date: '2026-10-27' })],
        [],
        asOf,
        zone,
        options,
      ).rag,
    ).toBe('red');
    const critical: Risk = {
      id: 'r',
      title: 'Outage',
      projectKey: 'SIS',
      riskLevel: 'critical',
      ownerId: 'shuchi',
      status: 'open',
    };
    expect(explainPortfolioHealth(project(), [], [critical], asOf, zone, options).rag).toBe('red');
    expect(
      explainPortfolioHealth(
        project({ targetEndDate: '2026-10-01', reportedHealth: 'green' }),
        [note({ id: 'a', date: '2026-10-27' })],
        [],
        asOf,
        zone,
        options,
      ).rag,
    ).toBe('red');
    expect(
      explainPortfolioHealth(
        project({ targetEndDate: '2026-10-01', phase: 'closing', reportedHealth: 'green' }),
        [note({ id: 'a', date: '2026-10-27' })],
        [],
        asOf,
        zone,
        options,
      ).rag,
    ).toBe('green');
  });

  it('treats blocked age and silence on the boundary days', () => {
    const blocked = (date: string) =>
      explainPortfolioHealth(
        project({ reportedHealth: 'green' }),
        [note({ id: 'b', date, blocked: true })],
        [],
        asOf,
        zone,
        options,
      ).rag;
    expect(blocked('2026-10-23')).toBe('amber');
    expect(blocked('2026-10-22')).toBe('red');

    const silent = (date: string) =>
      explainPortfolioHealth(project(), [note({ id: 's', date })], [], asOf, zone, options).rag;
    expect(silent('2026-10-19')).toBe('green');
    expect(silent('2026-10-18')).toBe('amber');
    expect(silent('2026-10-08')).toBe('amber');
    expect(silent('2026-10-07')).toBe('red');
  });

  it('marks a passed next milestone amber and keeps today off that rule', () => {
    expect(
      explainPortfolioHealth(
        project({ nextMilestoneDate: '2026-10-27', reportedHealth: 'green' }),
        [note({ id: 'a', date: '2026-10-27' })],
        [],
        asOf,
        zone,
        options,
      ).rag,
    ).toBe('amber');
    expect(
      explainPortfolioHealth(
        project({ nextMilestoneDate: '2026-10-28', reportedHealth: 'green' }),
        [note({ id: 'a', date: '2026-10-27' })],
        [],
        asOf,
        zone,
        options,
      ).rag,
    ).toBe('green');
  });

  it('prefers red when red and amber rules both fire', () => {
    const result = explainPortfolioHealth(
      project({ reportedHealth: 'amber' }),
      [note({ id: 'a', date: '2026-10-20', blocked: true, riskLevel: 'critical', type: 'risk' })],
      [],
      asOf,
      zone,
      options,
    );
    expect(result.rag).toBe('red');
    expect(result.reasons.some((reason) => reason.level === 'red')).toBe(true);
  });
});
