/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_JIRA_BASE_URL?: string;
  readonly VITE_TIMEZONE?: string;
  readonly VITE_STALE_AFTER_HOURS?: string;
  readonly VITE_REFRESH_POLL_MS?: string;
  readonly VITE_REFRESH_TIMEOUT_MS?: string;
  readonly VITE_REFRESH_COOLDOWN_MS?: string;
  readonly VITE_REFRESH_CONFIRM_MS?: string;
  readonly VITE_BLOCKED_STATUSES?: string;
  readonly VITE_STALE_DAYS?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_SCENARIO?: string;
  readonly VITE_AUTH_MODE?: string;
  readonly VITE_REFRESH_ROLES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
