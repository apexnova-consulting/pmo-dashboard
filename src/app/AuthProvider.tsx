import { useEffect, useState, type ReactNode } from 'react';
import { config } from '@/lib/config';

type Gate = 'ready' | 'checking' | 'denied';

function productionHttpWithoutAuth() {
  return import.meta.env.PROD && config.dataSource === 'http' && config.authMode === 'none';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Gate>(
    productionHttpWithoutAuth() ? 'denied' : config.authMode === 'none' ? 'ready' : 'checking',
  );

  useEffect(() => {
    if (config.authMode !== 'session' || productionHttpWithoutAuth()) return;
    let cancelled = false;
    fetch('/api/auth/me', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then((response) => {
        if (cancelled) return;
        if (response.ok) setState('ready');
        else window.location.assign('/api/auth/login');
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
          {productionHttpWithoutAuth()
            ? 'This build is set to read live data without sign-in. Turn on session sign-in before connecting the snapshot.'
            : 'This dashboard sits behind City College sign-in. The sign-in service did not respond.'}
        </p>
      </main>
    );
  }
  return children;
}
