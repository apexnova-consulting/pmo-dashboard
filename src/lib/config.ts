export const RAG_CONFIG = {
  red: { overduePct: 0.2, blockedCount: 3, milestoneSlipDays: 14, maxStaleDays: 21 },
  amber: { overduePct: 0.1, blockedCount: 1, milestoneSlipDays: 3, maxStaleDays: 14 },
  portfolio: { blockedRedDays: 5, staleRedDays: 21, staleAmberDays: 10 },
} as const;

export const FEATURE_FLAGS = {
  showWorkload: true,
  showRiskRegister: true,
  showRefresh: true,
} as const;

function numberEnv(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listEnv(value: string | undefined, fallback: string[]) {
  if (value == null || value.trim() === '') return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const env = import.meta.env;

export const config = {
  dataSource: env.VITE_DATA_SOURCE === 'http' ? 'http' : 'mock',
  apiBaseUrl: env.VITE_API_BASE_URL || '/api',
  timezone: env.VITE_TIMEZONE || 'America/New_York',
  staleAfterHours: numberEnv(env.VITE_STALE_AFTER_HOURS, 30),
  refreshPollMs: numberEnv(env.VITE_REFRESH_POLL_MS, 3000),
  refreshTimeoutMs: numberEnv(env.VITE_REFRESH_TIMEOUT_MS, 600_000),
  refreshCooldownMs: numberEnv(env.VITE_REFRESH_COOLDOWN_MS, 60_000),
  refreshConfirmMs: numberEnv(env.VITE_REFRESH_CONFIRM_MS, 300_000),
  blockedStatuses: listEnv(env.VITE_BLOCKED_STATUSES, ['Blocked', 'On Hold', 'Waiting']),
  staleDays: numberEnv(env.VITE_STALE_DAYS, 10),
  appVersion: env.VITE_APP_VERSION || '1.0.0',
  scenario: env.VITE_SCENARIO || '',
  authMode: env.VITE_AUTH_MODE === 'session' ? 'session' : 'none',
  refreshRoles: listEnv(env.VITE_REFRESH_ROLES, []),
} as const;

export type DomainOptions = {
  blockedStatuses: readonly string[];
  staleDays: number;
  rag: typeof RAG_CONFIG;
};

export function domainOptions(): DomainOptions {
  return {
    blockedStatuses: config.blockedStatuses,
    staleDays: config.staleDays,
    rag: RAG_CONFIG,
  };
}
