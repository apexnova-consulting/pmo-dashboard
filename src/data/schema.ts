import { z } from 'zod';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTime = z.string().datetime({ offset: true });

export const StatusCategory = z.enum(['todo', 'in_progress', 'done']);
export const Priority = z.enum(['highest', 'high', 'medium', 'low', 'lowest']);
export const RagSchema = z.enum(['red', 'amber', 'green']);
export const RiskLevel = z.enum(['low', 'medium', 'high', 'critical']);
export const UpdateType = z.enum(['update', 'risk', 'decision', 'action']);

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
  reportedHealth: RagSchema.nullable().optional(),
  percentComplete: z.number().min(0).max(100).nullable().optional(),
  nextMilestoneName: z.string().nullable().optional(),
  nextMilestoneDate: IsoDate.nullable().optional(),
  lastUpdateDate: IsoDate.nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const Update = z.object({
  id: z.string(),
  projectKey: z.string(),
  date: IsoDate,
  type: UpdateType,
  title: z.string(),
  summary: z.string().max(2000),
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  healthSignal: RagSchema.nullable(),
  riskLevel: RiskLevel.nullable(),
  blocked: z.boolean(),
  status: z.enum(['open', 'resolved']),
  ownerId: z.string().nullable(),
  mitigation: z.string().optional(),
  source: z.enum(['list', 'email']),
  sourceUrl: z.string().url().optional(),
});

export const Risk = z.object({
  id: z.string(),
  title: z.string(),
  projectKey: z.string(),
  probability: z.number().min(1).max(5).optional(),
  impact: z.number().min(1).max(5).optional(),
  riskLevel: RiskLevel.optional(),
  ownerId: z.string().nullable(),
  mitigation: z.string().optional(),
  status: z.enum(['open', 'mitigating', 'closed']),
});

export const HistoryPoint = z.object({
  date: IsoDate,
  open: z.number().optional(),
  overdue: z.number().optional(),
  blocked: z.number().optional(),
  created: z.number().optional(),
  resolved: z.number().optional(),
  ragCounts: z.object({ red: z.number(), amber: z.number(), green: z.number() }),
  byProject: z.record(z.string(), RagSchema).optional(),
  blockedProjects: z.number().optional(),
  openRisks: z.number().optional(),
});

export const Snapshot = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  generatedAt: IsoDateTime,
  meta: z.object({
    jiraBaseUrl: z.string().url().optional(),
    timezone: z.string().default('America/New_York'),
    capacityUnit: z.string().optional(),
    source: z.string().optional(),
    mode: z.enum(['tickets', 'portfolio']).optional(),
    nextScheduledRun: IsoDateTime.optional(),
  }),
  team: z.array(TeamMember),
  projects: z.array(Project),
  tickets: z.array(Ticket).default([]),
  milestones: z.array(Milestone).default([]),
  risks: z.array(Risk).default([]),
  history: z.array(HistoryPoint).default([]),
  updates: z.array(Update).default([]),
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
export type Update = z.infer<typeof Update>;
export type Risk = z.infer<typeof Risk>;
export type HistoryPoint = z.infer<typeof HistoryPoint>;
export type Snapshot = z.infer<typeof Snapshot>;
export type Rag = z.infer<typeof RagSchema>;
export type Priority = z.infer<typeof Priority>;
export type StatusCategory = z.infer<typeof StatusCategory>;
export type RiskLevel = z.infer<typeof RiskLevel>;
export type UpdateType = z.infer<typeof UpdateType>;
export type RefreshRun = z.infer<typeof RefreshRun>;
export type RefreshStatus = z.infer<typeof RefreshStatus>;

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
}
