import { describe, expect, it } from 'vitest';
import { portfolioFixture } from '@/data/mock/portfolioFixture';
import { legacyFixture } from '@/data/mock/legacyFixture';
import { formatZodIssues, Snapshot } from '@/data/schema';
import { deriveDashboard } from '@/domain/derive';
import { allOwners, parseOwnerParam } from '@/domain/filters';
import { domainOptions } from '@/lib/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('schema v2', () => {
  it('parses the portfolio fixture and ignores unknown fields', () => {
    const parsed = Snapshot.parse({ ...portfolioFixture, extra: true });
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.tickets).toEqual([]);
    expect(parsed.meta.jiraBaseUrl).toBeUndefined();
    expect('extra' in parsed).toBe(false);
  });

  it('parses a v1 ticket snapshot', () => {
    const parsed = Snapshot.parse(legacyFixture);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.tickets).toHaveLength(2);
    expect(parsed.updates).toEqual([]);
  });

  it('parses when tickets are omitted', () => {
    const raw = JSON.parse(JSON.stringify(portfolioFixture)) as Record<string, unknown>;
    delete raw.tickets;
    const parsed = Snapshot.parse(raw);
    expect(parsed.tickets).toEqual([]);
  });

  it('prints a field path for the broken fixture', () => {
    const broken = JSON.parse(
      readFileSync(path.join(process.cwd(), 'src/data/mock/fixtures/broken.json'), 'utf8'),
    );
    const result = Snapshot.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      const text = formatZodIssues(result.error);
      expect(text).toMatch(/generatedAt/);
      expect(text).toMatch(/projects\.0\.key/);
    }
  });
});

describe('portfolio derive', () => {
  const snapshot = Snapshot.parse(portfolioFixture);
  const model = deriveDashboard(snapshot, allOwners(), domainOptions());

  it('does not mark a project green without data', () => {
    const help = model.projects.find((project) => project.project.key === 'HELP');
    expect(help?.rag.rag).toBe('none');
    expect(
      model.projects.some(
        (project) =>
          project.rag.rag === 'green' &&
          project.rag.reasons.some((reason) => reason.rule === 'No data'),
      ),
    ).toBe(false);
  });

  it('builds the health trend from rag counts alone', () => {
    expect(snapshot.history.every((point) => point.open == null)).toBe(true);
    expect(model.weeks.at(-1)).toMatchObject({ red: 3, amber: 3, green: 3 });
  });

  it('includes a project for a lead, an author, or an owner on an open update', () => {
    const marta = deriveDashboard(snapshot, parseOwnerParam('marta', null), domainOptions());
    const keys = marta.projects.map((project) => project.project.key);
    expect(keys).toContain('LMS');
    expect(keys).toContain('SIS');
    expect(marta.projects.find((project) => project.project.key === 'LMS')?.role).toBe('lead');
    expect(marta.projects.find((project) => project.project.key === 'SIS')?.role).toBe(
      'contributor',
    );
  });
});
