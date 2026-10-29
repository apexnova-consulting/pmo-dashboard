import seedrandom from 'seedrandom';
import type {
  HistoryPoint,
  Milestone,
  Priority,
  Project,
  Rag,
  Risk,
  Snapshot,
  Ticket,
} from '@/data/schema';
import { Snapshot as SnapshotSchema } from '@/data/schema';
import { addDaysYmd, calendarDate, zonedWallTimeToIso } from '@/domain/dates';
import { explainRag, isBlocked } from '@/domain/metrics';
import { RAG_CONFIG } from '@/lib/config';

export const TIME_ZONE = 'America/New_York';
export const AS_OF = '2026-10-28T06:00:00-04:00';
export const AS_OF_DAY = '2026-10-28';
export const JIRA_BASE = 'https://ccny-pmo.atlassian.net';

export const SCENARIOS = [
  'normal',
  'empty',
  'huge',
  'stale',
  'error',
  'malformed',
  'refresh-fail',
] as const;
export type Scenario = (typeof SCENARIOS)[number];

const SUMMARIES = [
  'Confirm the cutover window with the Registrar',
  'Map legacy grade values to the new record',
  'Write the faculty change guide',
  'Review vendor answers on data retention',
  'Load a sample of last fall’s courses',
  'Check room readiness in Shepard Hall',
  'Replace the aging projector and controller',
  'Schedule the weekend install with Facilities',
  'Pilot the new course site with one department',
  'Export content from the current learning system',
  'Train college assistants on the new queue',
  'Document the financial-aid document checklist',
  'Compare the old and new award letters',
  'Survey access-point coverage in the NAC',
  'Order switches for the residence halls',
  'Remediate missing labels on the public forms',
  'Retest keyboard paths on the application',
  'Publish the weekly enrollment extract',
  'Reconcile the duplicate help-desk queues',
  'Draft the intake form for new requests',
  'Hold the design review with the sponsor',
  'Clear the blocked test environment',
] as const;

const TYPES = ['Task', 'Story', 'Bug', 'Epic'] as const;
const PRIORITIES: Priority[] = ['highest', 'high', 'medium', 'medium', 'medium', 'low', 'lowest'];

function at(dayOffset: number, time = '10:15:00') {
  return zonedWallTimeToIso(addDaysYmd(AS_OF_DAY, dayOffset), time, TIME_ZONE);
}

function day(dayOffset: number) {
  return addDaysYmd(AS_OF_DAY, dayOffset);
}

interface Batch {
  projectKey: string;
  count: number;
  category: Ticket['statusCategory'];
  assigneeId: string | null;
  dueOffset: number | null;
  ageDays: number;
  updatedDaysAgo: number;
  resolvedDaysAgo?: number;
  flagged?: boolean;
  statusName?: string;
  labels?: string[];
  points?: boolean;
  priority?: Priority;
}

function buildTickets(batches: Batch[], random: () => number): Ticket[] {
  const tickets: Ticket[] = [];
  let seq = 100;
  for (const batch of batches) {
    for (let index = 0; index < batch.count; index += 1) {
      seq += 1;
      const age = batch.ageDays + (index % 4) * 7;
      const resolvedAgo = (batch.resolvedDaysAgo ?? 3) + (index % 6) * 6;
      const createdOffset = batch.category === 'done' ? -(resolvedAgo + age) : -age;
      const updatedOffset = batch.category === 'done' ? -resolvedAgo : -batch.updatedDaysAgo;
      const dueOffset =
        batch.dueOffset == null ? null : batch.dueOffset - (index % 3 === 0 ? 0 : index % 2);
      const summary =
        SUMMARIES[Math.floor(random() * SUMMARIES.length)] ?? 'Follow up on the open item';
      const type = TYPES[Math.floor(random() * TYPES.length)] ?? 'Task';
      const priority =
        batch.priority ?? PRIORITIES[Math.floor(random() * PRIORITIES.length)] ?? 'medium';
      const statusName =
        batch.statusName ??
        (batch.category === 'done'
          ? 'Done'
          : batch.category === 'todo'
            ? 'To Do'
            : index % 2 === 0
              ? 'In Progress'
              : 'In Review');
      tickets.push({
        key: `${batch.projectKey}-${seq}`,
        summary,
        type,
        projectKey: batch.projectKey,
        statusName,
        statusCategory: batch.category,
        priority,
        assigneeId: batch.assigneeId,
        assigneeName:
          batch.assigneeId === 'shuchi'
            ? 'Shuchi'
            : batch.assigneeId === 'muhammad'
              ? 'Muhammad'
              : batch.assigneeId === 'marta'
                ? 'Marta'
                : null,
        reporterName: 'PMO intake',
        created: at(createdOffset, '09:00:00'),
        updated: at(updatedOffset, '15:30:00'),
        dueDate: dueOffset == null ? null : day(dueOffset),
        resolvedAt: batch.category === 'done' ? at(-resolvedAgo, '16:00:00') : null,
        labels: batch.labels ?? [],
        flagged: batch.flagged ?? false,
        storyPoints: batch.points ? ([1, 2, 3, 5][index % 4] ?? 2) : null,
        parentKey: null,
        sprint: 'Fall 2026',
      });
    }
  }
  return tickets;
}

const PROJECTS: Project[] = [
  {
    key: 'SIS',
    name: 'Student Information System Upgrade',
    leadId: 'shuchi',
    phase: 'active',
    startDate: '2026-06-01',
    targetEndDate: '2027-02-27',
    sponsor: 'Office of the Registrar',
    healthNote: 'Registrar asked for a written recovery plan before the next rehearsal.',
    url: `${JIRA_BASE}/browse/SIS`,
  },
  {
    key: 'LMS',
    name: 'LMS Migration',
    leadId: 'marta',
    phase: 'active',
    startDate: '2026-05-04',
    targetEndDate: '2026-12-18',
    sponsor: 'Office of the Provost',
    url: `${JIRA_BASE}/browse/LMS`,
  },
  {
    key: 'AV',
    name: 'Classroom AV Refresh',
    leadId: 'muhammad',
    phase: 'active',
    startDate: '2026-07-06',
    targetEndDate: '2026-12-11',
    sponsor: 'Facilities',
    url: `${JIRA_BASE}/browse/AV`,
  },
  {
    key: 'FAID',
    name: 'Financial Aid Process Automation',
    leadId: 'shuchi',
    phase: 'planning',
    startDate: '2026-09-08',
    targetEndDate: '2027-04-30',
    sponsor: 'Financial Aid',
    url: `${JIRA_BASE}/browse/FAID`,
  },
  {
    key: 'WIFI',
    name: 'Campus Wi-Fi Expansion',
    leadId: 'muhammad',
    phase: 'active',
    startDate: '2026-04-13',
    targetEndDate: '2026-11-20',
    sponsor: 'Office of Information Technology',
    url: `${JIRA_BASE}/browse/WIFI`,
  },
  {
    key: 'A11Y',
    name: 'Accessibility Remediation',
    leadId: 'marta',
    phase: 'active',
    startDate: '2026-03-02',
    targetEndDate: '2026-12-04',
    sponsor: 'Office of Accessibility',
    url: `${JIRA_BASE}/browse/A11Y`,
  },
  {
    key: 'ENRL',
    name: 'Enrollment Dashboard',
    leadId: 'shuchi',
    phase: 'closing',
    startDate: '2026-01-12',
    targetEndDate: '2026-11-06',
    sponsor: 'Enrollment Management',
    url: `${JIRA_BASE}/browse/ENRL`,
  },
  {
    key: 'HELP',
    name: 'Help Desk Consolidation',
    leadId: null,
    phase: 'intake',
    startDate: '2026-10-06',
    targetEndDate: null,
    sponsor: 'Office of Information Technology',
    url: `${JIRA_BASE}/browse/HELP`,
  },
  {
    key: 'REG',
    name: 'Registration Workflow Redesign',
    leadId: 'marta',
    phase: 'on_hold',
    startDate: '2026-02-02',
    targetEndDate: '2026-11-13',
    sponsor: 'Office of the Registrar',
    healthNote: 'Paused while the SIS cutover date is reset.',
    url: `${JIRA_BASE}/browse/REG`,
  },
];

const MILESTONES: Milestone[] = [
  {
    id: 'sis-rehearsal',
    name: 'Data migration rehearsal',
    projectKey: 'SIS',
    plannedDate: '2026-10-01',
    forecastDate: '2026-10-19',
    completedDate: null,
  },
  {
    id: 'sis-cutover',
    name: 'Cutover recommendation',
    projectKey: 'SIS',
    plannedDate: '2026-11-18',
    forecastDate: '2026-12-02',
    completedDate: null,
  },
  {
    id: 'lms-pilot',
    name: 'Department pilot',
    projectKey: 'LMS',
    plannedDate: '2026-11-04',
    forecastDate: '2026-11-04',
    completedDate: null,
  },
  {
    id: 'lms-content',
    name: 'Content freeze',
    projectKey: 'LMS',
    plannedDate: '2026-11-20',
    forecastDate: '2026-11-18',
    completedDate: null,
  },
  {
    id: 'av-slip',
    name: 'Equipment delivery',
    projectKey: 'AV',
    plannedDate: '2026-10-22',
    forecastDate: '2026-10-26',
    completedDate: null,
  },
  {
    id: 'av-pilot',
    name: 'Pilot room acceptance',
    projectKey: 'AV',
    plannedDate: '2026-10-30',
    forecastDate: '2026-10-30',
    completedDate: null,
  },
  {
    id: 'faid-base',
    name: 'Requirements baseline',
    projectKey: 'FAID',
    plannedDate: '2026-10-20',
    forecastDate: '2026-10-25',
    completedDate: null,
  },
  {
    id: 'faid-sign',
    name: 'Workflow sign-off',
    projectKey: 'FAID',
    plannedDate: '2026-11-06',
    forecastDate: '2026-11-06',
    completedDate: null,
  },
  {
    id: 'wifi-map',
    name: 'Coverage map review',
    projectKey: 'WIFI',
    plannedDate: '2026-11-03',
    forecastDate: '2026-11-03',
    completedDate: null,
  },
  {
    id: 'wifi-halls',
    name: 'Residence hall install',
    projectKey: 'WIFI',
    plannedDate: '2026-11-17',
    forecastDate: '2026-11-17',
    completedDate: null,
  },
  {
    id: 'a11y-readout',
    name: 'Audit readout',
    projectKey: 'A11Y',
    plannedDate: '2026-11-09',
    forecastDate: '2026-11-09',
    completedDate: null,
  },
  {
    id: 'a11y-forms',
    name: 'Public forms republished',
    projectKey: 'A11Y',
    plannedDate: '2026-10-10',
    forecastDate: '2026-10-10',
    completedDate: '2026-10-09',
  },
  {
    id: 'enrl-live',
    name: 'Dashboard in daily use',
    projectKey: 'ENRL',
    plannedDate: '2026-10-15',
    forecastDate: '2026-10-15',
    completedDate: '2026-10-16',
  },
  {
    id: 'enrl-handoff',
    name: 'Handoff to Enrollment Management',
    projectKey: 'ENRL',
    plannedDate: '2026-11-02',
    forecastDate: '2026-11-02',
    completedDate: null,
  },
  {
    id: 'help-charter',
    name: 'Charter review',
    projectKey: 'HELP',
    plannedDate: '2026-11-12',
    forecastDate: '2026-11-12',
    completedDate: null,
  },
  {
    id: 'reg-restart',
    name: 'Restart decision',
    projectKey: 'REG',
    plannedDate: '2026-11-13',
    forecastDate: '2026-11-13',
    completedDate: null,
  },
];

const RISKS: Risk[] = [
  {
    id: 'risk-sis-vendor',
    title: 'SIS vendor may miss the rehearsal window',
    projectKey: 'SIS',
    probability: 4,
    impact: 5,
    ownerId: 'shuchi',
    mitigation: 'Hold a twice-weekly recovery stand-up until the rehearsal date holds.',
    status: 'mitigating',
  },
  {
    id: 'risk-wifi-access',
    title: 'Residence halls may limit evening survey access',
    projectKey: 'WIFI',
    probability: 3,
    impact: 3,
    ownerId: 'muhammad',
    mitigation: 'Book access with Housing before the November review.',
    status: 'open',
  },
  {
    id: 'risk-lms-quality',
    title: 'Migrated course content may lose structure',
    projectKey: 'LMS',
    probability: 3,
    impact: 4,
    ownerId: 'marta',
    mitigation: 'Sample ten courses from each school before the pilot.',
    status: 'open',
  },
  {
    id: 'risk-closed',
    title: 'Early enrollment extract missed a column',
    projectKey: 'ENRL',
    probability: 2,
    impact: 2,
    ownerId: 'shuchi',
    mitigation: 'Column restored and checked against the fall census.',
    status: 'closed',
  },
];

function normalTickets(random: () => number): Ticket[] {
  return buildTickets(
    [
      {
        projectKey: 'SIS',
        count: 5,
        category: 'in_progress',
        assigneeId: 'shuchi',
        dueOffset: -6,
        ageDays: 30,
        updatedDaysAgo: 2,
        flagged: true,
        priority: 'highest',
      },
      {
        projectKey: 'SIS',
        count: 3,
        category: 'in_progress',
        assigneeId: 'shuchi',
        dueOffset: -2,
        ageDays: 24,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'SIS',
        count: 1,
        category: 'in_progress',
        assigneeId: 'muhammad',
        dueOffset: 12,
        ageDays: 18,
        updatedDaysAgo: 1,
        statusName: 'Blocked',
      },
      {
        projectKey: 'SIS',
        count: 6,
        category: 'in_progress',
        assigneeId: 'shuchi',
        dueOffset: 4,
        ageDays: 16,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'SIS',
        count: 5,
        category: 'todo',
        assigneeId: 'marta',
        dueOffset: 16,
        ageDays: 40,
        updatedDaysAgo: 3,
      },
      {
        projectKey: 'SIS',
        count: 14,
        category: 'done',
        assigneeId: 'shuchi',
        dueOffset: -1,
        ageDays: 20,
        updatedDaysAgo: 4,
        resolvedDaysAgo: 4,
      },
      {
        projectKey: 'AV',
        count: 3,
        category: 'in_progress',
        assigneeId: 'muhammad',
        dueOffset: -4,
        ageDays: 28,
        updatedDaysAgo: 2,
        priority: 'high',
      },
      {
        projectKey: 'AV',
        count: 1,
        category: 'in_progress',
        assigneeId: 'muhammad',
        dueOffset: 9,
        ageDays: 15,
        updatedDaysAgo: 2,
        statusName: 'On Hold',
      },
      {
        projectKey: 'AV',
        count: 2,
        category: 'in_progress',
        assigneeId: 'shuchi',
        dueOffset: 6,
        ageDays: 12,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'AV',
        count: 14,
        category: 'todo',
        assigneeId: 'muhammad',
        dueOffset: 20,
        ageDays: 21,
        updatedDaysAgo: 2,
      },
      {
        projectKey: 'AV',
        count: 10,
        category: 'done',
        assigneeId: 'muhammad',
        dueOffset: -8,
        ageDays: 30,
        updatedDaysAgo: 9,
        resolvedDaysAgo: 9,
      },
      {
        projectKey: 'LMS',
        count: 8,
        category: 'in_progress',
        assigneeId: 'marta',
        dueOffset: 8,
        ageDays: 14,
        updatedDaysAgo: 1,
        points: true,
      },
      {
        projectKey: 'LMS',
        count: 2,
        category: 'in_progress',
        assigneeId: 'muhammad',
        dueOffset: 11,
        ageDays: 22,
        updatedDaysAgo: 12,
        points: true,
      },
      {
        projectKey: 'LMS',
        count: 5,
        category: 'todo',
        assigneeId: 'marta',
        dueOffset: 18,
        ageDays: 10,
        updatedDaysAgo: 1,
        points: true,
      },
      {
        projectKey: 'LMS',
        count: 14,
        category: 'done',
        assigneeId: 'marta',
        dueOffset: -3,
        ageDays: 25,
        updatedDaysAgo: 2,
        resolvedDaysAgo: 2,
        points: true,
      },
      {
        projectKey: 'WIFI',
        count: 8,
        category: 'in_progress',
        assigneeId: 'muhammad',
        dueOffset: 7,
        ageDays: 18,
        updatedDaysAgo: 1,
        points: true,
      },
      {
        projectKey: 'WIFI',
        count: 1,
        category: 'todo',
        assigneeId: 'marta',
        dueOffset: 14,
        ageDays: 9,
        updatedDaysAgo: 2,
        points: true,
      },
      {
        projectKey: 'WIFI',
        count: 3,
        category: 'todo',
        assigneeId: 'muhammad',
        dueOffset: null,
        ageDays: 6,
        updatedDaysAgo: 1,
        points: true,
      },
      {
        projectKey: 'WIFI',
        count: 10,
        category: 'done',
        assigneeId: 'muhammad',
        dueOffset: -5,
        ageDays: 20,
        updatedDaysAgo: 6,
        resolvedDaysAgo: 6,
        points: true,
      },
      {
        projectKey: 'A11Y',
        count: 1,
        category: 'in_progress',
        assigneeId: 'marta',
        dueOffset: -1,
        ageDays: 19,
        updatedDaysAgo: 1,
        priority: 'high',
      },
      {
        projectKey: 'A11Y',
        count: 1,
        category: 'in_progress',
        assigneeId: 'marta',
        dueOffset: 13,
        ageDays: 17,
        updatedDaysAgo: 2,
        labels: ['blocked'],
      },
      {
        projectKey: 'A11Y',
        count: 1,
        category: 'todo',
        assigneeId: 'shuchi',
        dueOffset: 5,
        ageDays: 8,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'A11Y',
        count: 13,
        category: 'todo',
        assigneeId: 'marta',
        dueOffset: 21,
        ageDays: 26,
        updatedDaysAgo: 2,
      },
      {
        projectKey: 'A11Y',
        count: 10,
        category: 'done',
        assigneeId: 'marta',
        dueOffset: -12,
        ageDays: 40,
        updatedDaysAgo: 11,
        resolvedDaysAgo: 11,
      },
      {
        projectKey: 'FAID',
        count: 5,
        category: 'in_progress',
        assigneeId: 'shuchi',
        dueOffset: 10,
        ageDays: 12,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'FAID',
        count: 3,
        category: 'todo',
        assigneeId: 'shuchi',
        dueOffset: 24,
        ageDays: 8,
        updatedDaysAgo: 2,
      },
      {
        projectKey: 'FAID',
        count: 4,
        category: 'done',
        assigneeId: 'shuchi',
        dueOffset: -2,
        ageDays: 15,
        updatedDaysAgo: 5,
        resolvedDaysAgo: 5,
      },
      {
        projectKey: 'ENRL',
        count: 4,
        category: 'in_progress',
        assigneeId: 'shuchi',
        dueOffset: 3,
        ageDays: 11,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'ENRL',
        count: 18,
        category: 'done',
        assigneeId: 'shuchi',
        dueOffset: -6,
        ageDays: 50,
        updatedDaysAgo: 7,
        resolvedDaysAgo: 7,
      },
      {
        projectKey: 'HELP',
        count: 4,
        category: 'todo',
        assigneeId: null,
        dueOffset: 15,
        ageDays: 7,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'HELP',
        count: 3,
        category: 'todo',
        assigneeId: 'muhammad',
        dueOffset: 9,
        ageDays: 5,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'HELP',
        count: 3,
        category: 'in_progress',
        assigneeId: 'marta',
        dueOffset: null,
        ageDays: 4,
        updatedDaysAgo: 1,
      },
      {
        projectKey: 'HELP',
        count: 6,
        category: 'done',
        assigneeId: 'muhammad',
        dueOffset: -4,
        ageDays: 12,
        updatedDaysAgo: 3,
        resolvedDaysAgo: 3,
      },
      {
        projectKey: 'REG',
        count: 6,
        category: 'todo',
        assigneeId: 'marta',
        dueOffset: 30,
        ageDays: 55,
        updatedDaysAgo: 25,
      },
      {
        projectKey: 'REG',
        count: 2,
        category: 'done',
        assigneeId: 'marta',
        dueOffset: -20,
        ageDays: 40,
        updatedDaysAgo: 30,
        resolvedDaysAgo: 30,
      },
    ],
    random,
  );
}

function historyFor(tickets: Ticket[], projects: Project[]): HistoryPoint[] {
  const dates = Array.from({ length: 13 }, (_, index) => addDaysYmd(AS_OF_DAY, -7 * (12 - index)));
  const latest: Record<string, Rag> = {};
  for (const project of projects) {
    const projectTickets = tickets.filter((ticket) => ticket.projectKey === project.key);
    latest[project.key] = explainRag(project, projectTickets, MILESTONES, AS_OF, TIME_ZONE, {
      blockedStatuses: ['Blocked', 'On Hold', 'Waiting'],
      staleDays: 10,
      rag: RAG_CONFIG,
    }).rag;
  }
  return dates.map((date, index) => {
    const prev = addDaysYmd(date, -7);
    let created = 0;
    let resolved = 0;
    let open = 0;
    let overdue = 0;
    let blocked = 0;
    for (const ticket of tickets) {
      const createdDay = calendarDate(ticket.created, TIME_ZONE);
      const resolvedDay = ticket.resolvedAt ? calendarDate(ticket.resolvedAt, TIME_ZONE) : null;
      if (createdDay > prev && createdDay <= date) created += 1;
      if (resolvedDay && resolvedDay > prev && resolvedDay <= date) resolved += 1;
      const openThen = createdDay <= date && (resolvedDay == null || resolvedDay > date);
      if (!openThen) continue;
      open += 1;
      if (ticket.dueDate && ticket.dueDate < date) overdue += 1;
      if (isBlocked(ticket, ['Blocked', 'On Hold', 'Waiting'])) blocked += 1;
    }
    const byProject: Record<string, Rag> = { ...latest };
    const sis = latest.SIS ?? 'red';
    byProject.SIS = index < 4 ? 'green' : index < 8 ? 'amber' : sis;
    const ragCounts = { red: 0, amber: 0, green: 0 };
    for (const rag of Object.values(byProject)) ragCounts[rag] += 1;
    return { date, open, overdue, blocked, created, resolved, ragCounts, byProject };
  });
}

function team() {
  return [
    {
      id: 'shuchi',
      displayName: 'Shuchi',
      role: 'PMO lead',
      avatarColor: '#5C3A96',
      weeklyCapacity: 12,
    },
    {
      id: 'muhammad',
      displayName: 'Muhammad',
      role: 'PMO lead',
      avatarColor: '#0072B2',
      weeklyCapacity: 10,
    },
    {
      id: 'marta',
      displayName: 'Marta',
      role: 'PMO lead',
      avatarColor: '#009E73',
      weeklyCapacity: 11,
    },
  ];
}

export function generateSnapshot(scenario: Scenario = 'normal'): Snapshot {
  if (scenario === 'empty') {
    return SnapshotSchema.parse({
      schemaVersion: 1,
      generatedAt: AS_OF,
      meta: {
        jiraBaseUrl: JIRA_BASE,
        timezone: TIME_ZONE,
        capacityUnit: 'open tickets',
        source: 'mock snapshot · empty',
      },
      team: team(),
      projects: [],
      tickets: [],
      milestones: [],
      risks: [],
      history: [],
    });
  }

  const random = seedrandom(`ccny-pmo-v1-${scenario === 'huge' ? 'huge' : 'normal'}`);
  const tickets = scenario === 'huge' ? hugeTickets(random) : normalTickets(random);
  const projects = PROJECTS;
  const snapshot = SnapshotSchema.parse({
    schemaVersion: 1,
    generatedAt: scenario === 'stale' ? '2026-10-20T06:00:00-04:00' : AS_OF,
    meta: {
      jiraBaseUrl: JIRA_BASE,
      timezone: TIME_ZONE,
      capacityUnit: 'open tickets',
      source: 'mock snapshot · copilot-automation contract v1',
    },
    team: team(),
    projects,
    tickets,
    milestones: scenario === 'huge' ? MILESTONES : MILESTONES,
    risks: RISKS,
    history:
      scenario === 'huge'
        ? historyFor(tickets.slice(0, 400), projects)
        : historyFor(tickets, projects),
  });
  return snapshot;
}

function hugeTickets(random: () => number): Ticket[] {
  const keys = PROJECTS.map((project) => project.key);
  const assignees = ['shuchi', 'muhammad', 'marta', null] as const;
  const batches: Batch[] = [];
  for (let index = 0; index < 500; index += 1) {
    const projectKey = keys[index % keys.length] ?? 'SIS';
    const assigneeId = assignees[index % assignees.length] ?? null;
    const category: Ticket['statusCategory'] =
      index % 5 === 0 ? 'done' : index % 3 === 0 ? 'todo' : 'in_progress';
    batches.push({
      projectKey,
      count: 10,
      category,
      assigneeId,
      dueOffset: category === 'done' ? -3 : (index % 11) - 4,
      ageDays: 5 + (index % 40),
      updatedDaysAgo: index % 17 === 0 ? 12 : 2,
      resolvedDaysAgo: category === 'done' ? 1 + (index % 20) : undefined,
      flagged: index % 80 === 0,
      points: projectKey === 'LMS' || projectKey === 'WIFI',
    });
  }
  return buildTickets(batches, random);
}

export function parseScenario(value: string | null | undefined): Scenario {
  if (value && (SCENARIOS as readonly string[]).includes(value)) return value as Scenario;
  return 'normal';
}
