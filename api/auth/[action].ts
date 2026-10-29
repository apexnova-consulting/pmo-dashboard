import { jsonError } from '../lib/env';
import { adapt } from '../lib/nodeAdapter';
import { beginLogin, completeLogin } from '../lib/oidc';
import { liveDeps } from '../lib/runtime';
import {
  readSession,
  secureCookie,
  sessionClearCookie,
  sessionSetCookie,
  signSession,
} from '../lib/session';

async function handle(request: Request): Promise<Response> {
  const env = liveDeps().env;
  const action = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  if (env.authMode !== 'session') {
    return jsonError(404, 'AUTH_DISABLED', 'Sign-in is not enabled for this environment.');
  }
  if (!env.sessionSecret || !env.tenantId || !env.clientId) {
    return jsonError(500, 'AUTH_CONFIG', 'Sign-in is not configured.');
  }
  if (action === 'me') {
    const user = await readSession(request, env.sessionSecret);
    if (!user) return jsonError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    return Response.json({ name: user.name, email: user.email });
  }
  if (action === 'logout') {
    return new Response(null, {
      status: 302,
      headers: { Location: '/', 'Set-Cookie': sessionClearCookie(secureCookie(request)) },
    });
  }
  if (action === 'callback') {
    const result = await completeLogin(request, env);
    if (result instanceof Response) return result;
    const token = await signSession(result, env.sessionSecret);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': sessionSetCookie(token, secureCookie(request)),
      },
    });
  }
  if (action === 'login') return beginLogin(request, env);
  return jsonError(404, 'NOT_FOUND', 'That sign-in route does not exist.');
}

export const GET = handle;
export default adapt(handle);
