import { noStore, type ServerEnv } from './env';

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  roles: string[];
}

const COOKIE = 'pmo_session';

function bytesToB64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64UrlToBytes(value: string): Uint8Array {
  const padded =
    value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToB64Url(new Uint8Array(signature));
}

export async function signBlob(value: unknown, secret: string): Promise<string> {
  const payload = bytesToB64Url(new TextEncoder().encode(JSON.stringify(value)));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function readBlob<T>(token: string, secret: string): Promise<T | null> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !secret) return null;
  if ((await hmac(secret, payload)) !== signature) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64UrlToBytes(payload))) as T;
  } catch {
    return null;
  }
}

export async function signSession(
  user: SessionUser,
  secret: string,
  ttlSeconds = 8 * 60 * 60,
): Promise<string> {
  const payload = bytesToB64Url(
    new TextEncoder().encode(
      JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
    ),
  );
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function readSession(request: Request, secret: string): Promise<SessionUser | null> {
  if (!secret) return null;
  const header = request.headers.get('cookie') || '';
  const pair = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  if (!pair) return null;
  const token = decodeURIComponent(pair.slice(COOKIE.length + 1));
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = await hmac(secret, payload);
  if (expected !== signature) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(b64UrlToBytes(payload))) as SessionUser & {
      exp?: number;
    };
    if (!json.exp || json.exp * 1000 < Date.now()) return null;
    return {
      sub: json.sub,
      email: json.email,
      name: json.name,
      groups: json.groups ?? [],
      roles: json.roles ?? [],
    };
  } catch {
    return null;
  }
}

export function sessionSetCookie(token: string, secure: boolean): string {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure ? '; Secure' : ''}`;
}

export function sessionClearCookie(secure: boolean): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function allowedUser(user: SessionUser, env: ServerEnv): boolean {
  if (env.allowedEmails.length === 0 && env.allowedGroupIds.length === 0) return true;
  const email = user.email.toLowerCase();
  if (env.allowedEmails.some((item) => item.toLowerCase() === email)) return true;
  return user.groups.some((group) => env.allowedGroupIds.includes(group));
}

export function canRefresh(user: SessionUser, roles: string[]): boolean {
  if (roles.length === 0) return true;
  const haystack = new Set(
    [user.email, ...user.groups, ...user.roles].map((item) => item.toLowerCase()),
  );
  return roles.some((role) => haystack.has(role.toLowerCase()));
}

export function secureCookie(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0]?.trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

export function demoUser(env: ServerEnv): SessionUser {
  return {
    sub: 'demo',
    email: 'demo@example.com',
    name: 'Demo',
    groups: [],
    roles: env.refreshRoles.length > 0 ? [env.refreshRoles[0]!] : [],
  };
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const cache = noStore();
  if (Array.isArray(cache)) {
    for (const [key, value] of cache) headers.set(key, value);
  } else {
    for (const [key, value] of Object.entries(cache)) headers.set(key, value);
  }
  return headers;
}
