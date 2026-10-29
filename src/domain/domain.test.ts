import { describe, expect, it } from 'vitest';
import type { Milestone, Project, Ticket } from '@/data/schema';
import { domainOptions } from '@/lib/config';
import { completionOf, explainRag, isOpen, ticketFacts } from '@/domain/metrics';
import { agingBucket, countAging } from '@/domain/aging';
import { parseOwnerParam, projectRole, ticketMatchesOwner, toggleOwner } from '@/domain/filters';
import { refreshReducer, initialRefreshState } from '@/domain/refreshMachine';

const options = domainOptions();
const asOf = '2026-10-28T06:00:00-04:00';

function ticket(
  partial: Partial<Ticket> & Pick<Ticket, 'key' | 'dueDate' | 'statusCategory'>,
): Ticket {
  return {
    summary: 'Sample',
    type: 'Task',
    projectKey: 'SIS',
    statusName: 'To Do',
    priority: 'medium',
    assigneeId: 'shuchi',
    assigneeName: 'Shuchi',
    created: '2026-10-01T10:00:00-04:00',
    updated: '2026-10-27T10:00:00-04:00',
    resolvedAt: null,
    labels: [],
    flagged: false,
    ...partial,
  };
}

const project: Project = {
  key: 'SIS',
  name: 'SIS',
  leadId: 'shuchi',
  phase: 'active',
};

describe('ticket facts', () => {
  it('treats a due date on the snapshot day as not overdue', () => {
    const facts = ticketFacts(
      ticket({ key: 'SIS-1', dueDate: '2026-10-28', statusCategory: 'todo' }),
      asOf,
      'America/New_York',
      options,
    );
    expect(facts.overdue).toBe(false);
    expect(facts.dueSoon).toBe(true);
  });

  it('uses the snapshot timezone, not the UTC date', () => {
    const early = '2026-10-28T03:30:00Z';
    const facts = ticketFacts(
      ticket({ key: 'SIS-2', dueDate: '2026-10-27', statusCategory: 'in_progress' }),
      early,
      'America/New_York',
      options,
    );
    expect(facts.overdue).toBe(false);
    expect(facts.dueSoon).toBe(true);
  });

  it('leaves tickets with no due date out of overdue and due-soon', () => {
    const facts = ticketFacts(
      ticket({ key: 'SIS-3', dueDate: null, statusCategory: 'todo' }),
      asOf,
      'America/New_York',
      options,
    );
    expect(facts.overdue).toBe(false);
    expect(facts.dueSoon).toBe(false);
    expect(
      isOpen(
        ticket({
          key: 'SIS-4',
          dueDate: null,
          statusCategory: 'done',
          resolvedAt: '2026-10-20T10:00:00-04:00',
        }),
      ),
    ).toBe(false);
  });

  it('marks blocked from a flag, a label, or a configured status', () => {
    expect(
      ticketFacts(
        ticket({ key: 'A', dueDate: null, statusCategory: 'todo', flagged: true }),
        asOf,
        'America/New_York',
        options,
      ).blocked,
    ).toBe(true);
    expect(
      ticketFacts(
        ticket({ key: 'B', dueDate: null, statusCategory: 'todo', labels: ['Blocked'] }),
        asOf,
        'America/New_York',
        options,
      ).blocked,
    ).toBe(true);
    expect(
      ticketFacts(
        ticket({ key: 'C', dueDate: null, statusCategory: 'in_progress', statusName: 'On Hold' }),
        asOf,
        'America/New_York',
        options,
      ).blocked,
    ).toBe(true);
  });
});

describe('rag', () => {
  const milestones: Milestone[] = [];
  it('is green when no threshold is met', () => {
    const result = explainRag(
      project,
      [ticket({ key: 'G', dueDate: '2026-11-02', statusCategory: 'todo' })],
      milestones,
      asOf,
      'America/New_York',
      options,
    );
    expect(result.rag).toBe('green');
    expect(result.reasons).toHaveLength(0);
  });

  it('is red when overdue share crosses the red line', () => {
    const tickets = [
      ticket({ key: '1', dueDate: '2026-10-01', statusCategory: 'todo' }),
      ticket({ key: '2', dueDate: '2026-10-01', statusCategory: 'todo' }),
      ticket({ key: '3', dueDate: '2026-11-01', statusCategory: 'todo' }),
      ticket({ key: '4', dueDate: '2026-11-01', statusCategory: 'todo' }),
      ticket({ key: '5', dueDate: '2026-11-01', statusCategory: 'todo' }),
    ];
    expect(explainRag(project, tickets, milestones, asOf, 'America/New_York', options).rag).toBe(
      'red',
    );
  });

  it('lets a PMO override win', () => {
    const result = explainRag(
      { ...project, healthOverride: 'green', healthNote: 'Sponsor accepted the date.' },
      [ticket({ key: '1', dueDate: '2026-10-01', statusCategory: 'todo', flagged: true })],
      milestones,
      asOf,
      'America/New_York',
      options,
    );
    expect(result.rag).toBe('green');
    expect(result.overridden).toBe(true);
    expect(result.note).toMatch(/Sponsor/);
  });
});

describe('completion and aging', () => {
  it('uses story points only when most tickets have them', () => {
    const withPoints = [1, 2, 3, 5].map((points, index) =>
      ticket({
        key: `P-${index}`,
        dueDate: null,
        statusCategory: index === 0 ? 'done' : 'todo',
        storyPoints: points,
      }),
    );
    expect(completionOf(withPoints).basis).toBe('story_points');
    expect(completionOf([ticket({ key: 'C', dueDate: null, statusCategory: 'done' })]).basis).toBe(
      'count',
    );
    expect(completionOf([]).ratio).toBeNull();
  });

  it('places ages in exclusive buckets', () => {
    expect(agingBucket(0)).toBe('0-7');
    expect(agingBucket(7)).toBe('0-7');
    expect(agingBucket(8)).toBe('8-14');
    expect(agingBucket(60)).toBe('60+');
    const counts = countAging([
      { ageDays: 3, open: true },
      { ageDays: 90, open: true },
      { ageDays: 1, open: false },
    ]);
    expect(counts.find((bucket) => bucket.id === '0-7')?.count).toBe(1);
    expect(counts.find((bucket) => bucket.id === '60+')?.count).toBe(1);
  });
});

describe('owner filter', () => {
  it('parses multi-select and the unassigned bucket', () => {
    expect(parseOwnerParam('shuchi,marta', ['shuchi', 'marta', 'muhammad'])).toEqual({
      ids: ['shuchi', 'marta'],
      includeUnassigned: false,
    });
    expect(parseOwnerParam('unassigned', ['shuchi'])).toEqual({ ids: [], includeUnassigned: true });
    expect(parseOwnerParam('nope', ['shuchi']).ids).toEqual([]);
  });

  it('toggles back to everyone when the last person is cleared', () => {
    const one = toggleOwner({ ids: [], includeUnassigned: false }, 'shuchi');
    expect(one.ids).toEqual(['shuchi']);
    expect(toggleOwner(one, 'shuchi')).toEqual({ ids: [], includeUnassigned: false });
  });

  it('marks lead versus contributor', () => {
    const open = [
      { projectKey: 'SIS', assigneeId: 'marta' },
      { projectKey: 'AV', assigneeId: 'muhammad' },
    ];
    expect(
      projectRole({ key: 'SIS', leadId: 'shuchi' }, open, {
        ids: ['shuchi'],
        includeUnassigned: false,
      }),
    ).toBe('lead');
    expect(
      projectRole({ key: 'SIS', leadId: 'shuchi' }, open, {
        ids: ['marta'],
        includeUnassigned: false,
      }),
    ).toBe('contributor');
    expect(ticketMatchesOwner({ assigneeId: null }, { ids: [], includeUnassigned: true })).toBe(
      true,
    );
    expect(ticketMatchesOwner({ assigneeId: 'shuchi' }, { ids: [], includeUnassigned: true })).toBe(
      false,
    );
  });
});

describe('refresh state machine', () => {
  it('asks for confirmation inside five minutes and refuses the cooldown', () => {
    const cooling = refreshReducer(
      { ...initialRefreshState, lastSuccessAt: 1_000 },
      { type: 'request', now: 30_000, cooldownMs: 60_000, confirmMs: 300_000 },
    );
    expect(cooling.phase).toBe('idle');
    const confirm = refreshReducer(
      { ...initialRefreshState, lastSuccessAt: 1_000 },
      { type: 'request', now: 120_000, cooldownMs: 60_000, confirmMs: 300_000 },
    );
    expect(confirm.phase).toBe('confirming');
    expect(refreshReducer(confirm, { type: 'confirm' }).phase).toBe('starting');
  });

  it('attaches to a conflict and records success and failure', () => {
    const running = refreshReducer(initialRefreshState, {
      type: 'conflict',
      runId: 'run-1',
      startedAt: asOf,
    });
    expect(running.phase).toBe('running');
    expect(running.conflict).toBe(true);
    const done = refreshReducer(running, { type: 'poll', status: 'succeeded', now: 50_000 });
    expect(done.phase).toBe('idle');
    expect(done.lastSuccessAt).toBe(50_000);
    const failed = refreshReducer(running, {
      type: 'poll',
      status: 'failed',
      now: 50_000,
      message: 'Jira timed out',
    });
    expect(failed.error).toBe('Jira timed out');
    expect(refreshReducer(running, { type: 'timeout' }).phase).toBe('timed_out');
  });
});
