import { describe, expect, it } from 'vitest';
import { domainOptions } from '@/lib/config';
import { deriveDashboard } from '@/domain/derive';
import { explainRag } from '@/domain/metrics';
import { allOwners } from '@/domain/filters';
import { generateSnapshot } from '@/data/mock/generate';
import { Snapshot as SnapshotSchema } from '@/data/schema';

describe('mock snapshot', () => {
  it('validates and stays deterministic', () => {
    const first = generateSnapshot('normal');
    const second = generateSnapshot('normal');
    expect(SnapshotSchema.parse(first)).toMatchObject({ schemaVersion: 1 });
    expect(first.tickets.map((ticket) => ticket.key)).toEqual(
      second.tickets.map((ticket) => ticket.key),
    );
    expect(first.team.map((member) => member.id)).toEqual(['shuchi', 'muhammad', 'marta']);
    expect(first.history.length).toBeGreaterThanOrEqual(12);
  });

  it('produces the portfolio shape the dashboard is designed around', () => {
    const snapshot = generateSnapshot('normal');
    const options = domainOptions();
    const ragFor = (key: string) =>
      explainRag(
        snapshot.projects.find((project) => project.key === key)!,
        snapshot.tickets.filter((ticket) => ticket.projectKey === key),
        snapshot.milestones,
        snapshot.generatedAt,
        snapshot.meta.timezone,
        options,
      ).rag;
    expect(ragFor('SIS')).toBe('red');
    expect(ragFor('REG')).toBe('red');
    expect(ragFor('LMS')).toBe('green');
    expect(ragFor('WIFI')).toBe('green');
    expect(ragFor('AV')).toBe('amber');
    expect(ragFor('FAID')).toBe('amber');
    expect(snapshot.tickets.some((ticket) => ticket.assigneeId == null)).toBe(true);
    expect(
      snapshot.milestones.some(
        (milestone) =>
          milestone.forecastDate &&
          milestone.forecastDate > milestone.plannedDate &&
          !milestone.completedDate,
      ),
    ).toBe(true);
    const sis = snapshot.history.map((point) => point.byProject?.SIS);
    expect(sis[0]).toBe('green');
    expect(sis[4]).toBe('amber');
    expect(sis.at(-1)).toBe('red');
    const model = deriveDashboard(snapshot, allOwners(), options);
    expect(model.kpis.overdue).toBeGreaterThan(0);
    expect(model.attention.length).toBeGreaterThan(0);
    expect(model.kpis.openDelta).not.toBeNull();
  });

  it('covers empty and large scenarios', () => {
    expect(generateSnapshot('empty').tickets).toHaveLength(0);
    expect(generateSnapshot('huge').tickets).toHaveLength(5000);
    expect(generateSnapshot('stale').generatedAt.startsWith('2026-10-20')).toBe(true);
  });
});
