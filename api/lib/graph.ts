export interface GraphFile {
  body: string;
  etag: string;
}

export interface GraphClient {
  read(path: string): Promise<GraphFile | null>;
}

export class MemoryGraph implements GraphClient {
  constructor(private readonly files: Map<string, GraphFile>) {}

  async read(path: string): Promise<GraphFile | null> {
    return this.files.get(path) ?? null;
  }

  put(path: string, body: string, etag: string) {
    this.files.set(path, { body, etag });
  }
}

export async function fetchWithRetry(
  run: () => Promise<Response>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Response> {
  const first = await run();
  if (first.status !== 429 && first.status !== 503) return first;
  const retryAfter = Number(first.headers.get('retry-after') || '1');
  const seconds = Number.isFinite(retryAfter) ? retryAfter : 1;
  await wait(Math.min(Math.max(seconds, 0), 5) * 1000);
  return run();
}

interface TokenCache {
  value: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

export function clearTokenCache() {
  cachedToken = null;
}

export async function graphAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  fetcher: typeof fetch = fetch,
  now = Date.now,
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > now() + 60_000) return cachedToken.value;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const response = await fetcher(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    { method: 'POST', body },
  );
  if (!response.ok) throw new Error('GRAPH_TOKEN');
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('GRAPH_TOKEN');
  cachedToken = {
    value: json.access_token,
    expiresAt: now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export class SharePointGraph implements GraphClient {
  constructor(
    private readonly options: {
      tenantId: string;
      clientId: string;
      clientSecret: string;
      siteId: string;
      driveId: string;
      fetcher?: typeof fetch;
      log: (code: string, detail: string) => void;
    },
  ) {}

  async read(path: string): Promise<GraphFile | null> {
    const fetcher = this.options.fetcher ?? fetch;
    const token = await graphAccessToken(
      this.options.tenantId,
      this.options.clientId,
      this.options.clientSecret,
      fetcher,
    );
    const encoded = path
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const url = `https://graph.microsoft.com/v1.0/sites/${this.options.siteId}/drives/${this.options.driveId}/root:/${encoded}:/content`;
    const response = await fetchWithRetry(() =>
      fetcher(url, { headers: { Authorization: `Bearer ${token}` } }),
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      this.options.log('GRAPH_READ', String(response.status));
      throw new Error('GRAPH_READ');
    }
    const etag = response.headers.get('etag') || `"${path}"`;
    return { body: await response.text(), etag };
  }
}
