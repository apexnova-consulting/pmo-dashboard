import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    const stored = window.localStorage.getItem('pmo-theme');
    if (stored === 'light' || stored === 'dark') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = media.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      setTheme(next);
    };
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('pmo-theme', next);
    setTheme(next);
  };

  return { theme, toggle };
}

export function useDensity() {
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() =>
    window.localStorage.getItem('pmo-density') === 'compact' ? 'compact' : 'comfortable',
  );
  const toggle = () => {
    const next = density === 'compact' ? 'comfortable' : 'compact';
    window.localStorage.setItem('pmo-density', next);
    setDensity(next);
  };
  return { density, toggle };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    setMatches(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
