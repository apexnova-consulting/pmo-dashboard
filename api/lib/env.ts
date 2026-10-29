export type RefreshMode = 'trigger' | 'reload-only' | 'mock';
export type AuthMode = 'none' | 'session';

export interface ServerEnv {
  authMode: AuthMode;
  refreshMode: RefreshMode;
  refreshRoles: string[];
  refreshTimeoutMs: number;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  driveId: string;
  snapshotPath: string;
  statusPath: string;
  historyPath: string;
  flowUrl: string;
  sessionSecret: string;
  allowedGroupIds: string[];
  allowedEmails: string[];
  redirectUri: string;
  nextScheduledLabel: string;
}

function list(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const refreshMode = source.REFRESH_MODE;
  const authMode = source.AUTH_MODE;
  return {
    authMode: authMode === 'session' ? 'session' : 'none',
    refreshMode:
      refreshMode === 'trigger' || refreshMode === 'reload-only' || refreshMode === 'mock'
        ? refreshMode
        : 'mock',
    refreshRoles: list(source.REFRESH_ROLES),
    refreshTimeoutMs: Number(source.REFRESH_TIMEOUT_MS || 600_000),
    tenantId: source.MS_TENANT_ID || '',
    clientId: source.MS_CLIENT_ID || '',
    clientSecret: source.MS_CLIENT_SECRET || '',
    siteId: source.SP_SITE_ID || '',
    driveId: source.SP_DRIVE_ID || '',
    snapshotPath: source.SP_SNAPSHOT_PATH || 'PMO/snapshot.json',
    statusPath: source.SP_STATUS_PATH || 'PMO/refresh-status.json',
    historyPath: source.SP_HISTORY_PATH || 'PMO/refresh-history.json',
    flowUrl: source.REFRESH_FLOW_URL || '',
    sessionSecret: source.SESSION_SECRET || '',
    allowedGroupIds: list(source.ALLOWED_GROUP_IDS),
    allowedEmails: list(source.ALLOWED_EMAILS),
    redirectUri: source.AUTH_REDIRECT_URI || '',
    nextScheduledLabel: source.NEXT_SCHEDULED_LABEL || '6:00 AM Eastern',
  };
}

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: noStore() });
}

export function noStore(): HeadersInit {
  return { 'Cache-Control': 'private, no-store' };
}
