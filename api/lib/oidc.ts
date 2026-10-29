import { jsonError, type ServerEnv } from './env';
import { allowedUser, readBlob, secureCookie, signBlob, type SessionUser } from './session';

interface OidcCookie {
  state: string;
  verifier: string;
  redirect: string;
}

function randomToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodePart(part: string): unknown {
  const padded =
    part.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((part.length + 3) % 4);
  return JSON.parse(atob(padded));
}

export async function verifyIdToken(
  idToken: string,
  env: Pick<ServerEnv, 'tenantId' | 'clientId'>,
  fetcher: typeof fetch = fetch,
): Promise<SessionUser | null> {
  const [headerPart, payloadPart, signaturePart] = idToken.split('.');
  if (!headerPart || !payloadPart || !signaturePart) return null;
  const header = decodePart(headerPart) as { kid?: string; alg?: string };
  if (header.alg !== 'RS256' || !header.kid) return null;
  const jwksUrl = `https://login.microsoftonline.com/${encodeURIComponent(env.tenantId)}/discovery/v2.0/keys`;
  const jwksResponse = await fetcher(jwksUrl);
  if (!jwksResponse.ok) return null;
  const jwks = (await jwksResponse.json()) as { keys: JsonWebKey & { kid?: string }[] };
  const jwk = jwks.keys.find((key) => key.kid === header.kid) as JsonWebKey | undefined;
  if (!jwk) return null;
  const importKey = crypto.subtle.importKey.bind(crypto.subtle) as (
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: RsaHashedImportParams,
    extractable: boolean,
    keyUsages: KeyUsage[],
  ) => Promise<CryptoKey>;
  const key = await importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'verify',
  ]);
  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = Uint8Array.from(
    atob(signaturePart.replaceAll('-', '+').replaceAll('_', '/')),
    (char) => char.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) return null;
  const claims = decodePart(payloadPart) as {
    sub?: string;
    email?: string;
    preferred_username?: string;
    name?: string;
    aud?: string | string[];
    tid?: string;
    exp?: number;
    groups?: string[];
    roles?: string[];
  };
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const email = claims.email || claims.preferred_username || '';
  if (!claims.sub || !email || !claims.exp || claims.exp * 1000 < Date.now()) return null;
  if (claims.tid !== env.tenantId) return null;
  if (!audience.includes(env.clientId)) return null;
  return {
    sub: claims.sub,
    email,
    name: claims.name || email,
    groups: claims.groups ?? [],
    roles: claims.roles ?? [],
  };
}

export async function beginLogin(request: Request, env: ServerEnv): Promise<Response> {
  const verifier = randomToken();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const state = randomToken(16);
  const redirect = env.redirectUri || new URL('/api/auth/callback', request.url).toString();
  const authorize = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(env.tenantId)}/oauth2/v2.0/authorize`,
  );
  authorize.searchParams.set('client_id', env.clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', redirect);
  authorize.searchParams.set('response_mode', 'query');
  authorize.searchParams.set('scope', 'openid profile email');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  const cookie = await signBlob(
    { state, verifier, redirect } satisfies OidcCookie,
    env.sessionSecret,
  );
  const secure = secureCookie(request);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `pmo_oidc=${encodeURIComponent(cookie)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure ? '; Secure' : ''}`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function completeLogin(
  request: Request,
  env: ServerEnv,
  fetcher: typeof fetch = fetch,
): Promise<SessionUser | Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return jsonError(400, 'AUTH_CALLBACK', 'Sign-in did not return a code.');
  const raw = (request.headers.get('cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('pmo_oidc='));
  if (!raw) return jsonError(400, 'AUTH_CALLBACK', 'Sign-in could not be completed.');
  const cookie = await readBlob<OidcCookie>(
    decodeURIComponent(raw.slice('pmo_oidc='.length)),
    env.sessionSecret,
  );
  if (!cookie || cookie.state !== state)
    return jsonError(400, 'AUTH_CALLBACK', 'Sign-in could not be completed.');
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: cookie.redirect,
    code_verifier: cookie.verifier,
  });
  const tokenResponse = await fetcher(
    `https://login.microsoftonline.com/${encodeURIComponent(env.tenantId)}/oauth2/v2.0/token`,
    { method: 'POST', body },
  );
  if (!tokenResponse.ok) return jsonError(401, 'AUTH_CALLBACK', 'Sign-in could not be completed.');
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) return jsonError(401, 'AUTH_CALLBACK', 'Sign-in could not be completed.');
  const user = await verifyIdToken(tokens.id_token, env, fetcher);
  if (!user) return jsonError(401, 'AUTH_CALLBACK', 'Sign-in could not be completed.');
  if (!allowedUser(user, env))
    return jsonError(403, 'FORBIDDEN', 'This account is not allowed to open the dashboard.');
  return user;
}
