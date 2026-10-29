import { useEffect, useState, type ReactNode } from 'react';
import { config } from '@/lib/config';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'ready' | 'checking' | 'denied'>(
    config.authMode === 'none' ? 'ready' : 'checking',
  );

  useEffect(() => {
    if (config.authMode !== 'static') return;
    let cancelled = false;
    fetch('/.auth/me', { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (cancelled) return;
        if (response.ok) setState('ready');
        else window.location.assign('/.auth/login/aad?post_login_redirect_uri=/');
      })
      .catch(() => {
        if (!cancelled) setState('denied');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking') {
    return (
      <p className="px-6 py-16 text-muted" role="status">
        Checking your college sign-in…
      </p>
    );
  }
  if (state === 'denied') {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="section-title text-2xl">Sign-in required</h1>
        <p className="mt-4">
          This dashboard sits behind City College sign-in. The sign-in service did not respond.
        </p>
      </main>
    );
  }
  return children;
}
