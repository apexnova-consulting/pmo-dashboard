import { z } from 'zod';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTime = z.string().datetime({ offset: true });

export const StatusCategory = z.enum(['todo', 'in_progress', 'done']);
export const Priority = z.enum(['highest', 'high', 'medium', 'low', 'lowest']);
export const RagSchema = z.enum(['red', 'amber', 'green']);

export const TeamMember = z.object({
  id: z.string(),
  displayName: z.string(),
  jiraAccountId: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  avatarColor: z.string().optional(),
  weeklyCapacity: z.number().optional(),
});

export const Ticket = z.object({
  key: z.string(),
  summary: z.string(),
  type: z.string(),
  projectKey: z.string(),
  statusName: z.string(),
  statusCategory: StatusCategory,
  priority: Priority,
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  reporterName: z.string().optional(),
  created: IsoDateTime,
  updated: IsoDateTime,
  dueDate: IsoDate.nullable(),
  resolvedAt: IsoDateTime.nullable(),
  labels: z.array(z.string()).default([]),
  flagged: z.boolean().default(false),
  storyPoints: z.number().nullable().optional(),
  parentKey: z.string().nullable().optional(),
  sprint: z.string().nullable().optional(),
  url: z.string().url().optional(),
});

export const Milestone = z.object({
  id: z.string(),
  name: z.string(),
  projectKey: z.string(),
  plannedDate: IsoDate,
  forecastDate: IsoDate.nullable(),
  completedDate: IsoDate.nullable(),
});

export const Project = z.object({
  key: z.string(),
  name: z.string(),
  leadId: z.string().nullable(),
  phase: z.enum(['intake', 'planning', 'active', 'on_hold', 'closing', 'closed']),
  startDate: IsoDate.nullable().optional(),
  targetEndDate: IsoDate.nullable().optional(),
  healthOverride: RagSchema.nullable().optional(),
  healthNote: z.string().nullable().optional(),
  sponsor: z.string().optional(),
  url: z.string().url().optional(),
});

export const Risk = z.object({
  id: z.string(),
  title: z.string(),
  projectKey: z.string(),
  probability: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  ownerId: z.string().nullable(),
  mitigation: z.string().optional(),
  status: z.enum(['open', 'mitigating', 'closed']),
});

export const HistoryPoint = z.object({
  date: IsoDate,
  open: z.number(),
  overdue: z.number(),
  blocked: z.number(),
  created: z.number(),
  resolved: z.number(),
  ragCounts: z.object({ red: z.number(), amber: z.number(), green: z.number() }),
  byProject: z.record(z.string(), RagSchema).optional(),
});

export const Snapshot = z.object({
  schemaVersion: z.literal(1),
  generatedAt: IsoDateTime,
  meta: z.object({
    jiraBaseUrl: z.string().url(),
    timezone: z.string().default('America/New_York'),
    capacityUnit: z.string().optional(),
    source: z.string().optional(),
  }),
  team: z.array(TeamMember),
  projects: z.array(Project),
  tickets: z.array(Ticket),
  milestones: z.array(Milestone).default([]),
  risks: z.array(Risk).default([]),
  history: z.array(HistoryPoint).default([]),
});

export const RefreshStatus = z.enum(['queued', 'running', 'succeeded', 'failed']);

export const RefreshRun = z.object({
  runId: z.string(),
  status: RefreshStatus,
  startedAt: IsoDateTime,
  finishedAt: IsoDateTime.optional(),
  message: z.string().optional(),
  progress: z.number().min(0).max(1).optional(),
  triggeredBy: z.string().optional(),
});

export const RefreshAccepted = z.object({
  runId: z.string(),
  startedAt: IsoDateTime,
});

export const ApiErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type TeamMember = z.infer<typeof TeamMember>;
export type Ticket = z.infer<typeof Ticket>;
export type Milestone = z.infer<typeof Milestone>;
export type Project = z.infer<typeof Project>;
export type Risk = z.infer<typeof Risk>;
export type HistoryPoint = z.infer<typeof HistoryPoint>;
export type Snapshot = z.infer<typeof Snapshot>;
export type Rag = z.infer<typeof RagSchema>;
export type Priority = z.infer<typeof Priority>;
export type StatusCategory = z.infer<typeof StatusCategory>;
export type RefreshRun = z.infer<typeof RefreshRun>;
export type RefreshStatus = z.infer<typeof RefreshStatus>;
