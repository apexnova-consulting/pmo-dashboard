import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  allOwners,
  isAllOwners,
  parseOwnerParam,
  serializeOwner,
  toggleOwner,
  type OwnerSelection,
} from '@/domain/filters';

const STORAGE_KEY = 'pmo-owner-filter';

export function useOwnerFilter(teamIds: string[] | null) {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get('owner')) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored || stored === 'all') return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('owner', stored);
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  const selection = useMemo(() => parseOwnerParam(params.get('owner'), teamIds), [params, teamIds]);

  const write = (next: OwnerSelection) => {
    const value = serializeOwner(next);
    window.localStorage.setItem(STORAGE_KEY, value);
    setParams((prev) => {
      const paramsNext = new URLSearchParams(prev);
      if (value === 'all') paramsNext.delete('owner');
      else paramsNext.set('owner', value);
      return paramsNext;
    });
  };

  return {
    selection,
    setAll: () => write(allOwners()),
    toggle: (id: string) =>
      write(
        isAllOwners(selection) && id !== 'unassigned'
          ? { ids: [id], includeUnassigned: false }
          : id === 'unassigned' && isAllOwners(selection)
            ? { ids: [], includeUnassigned: true }
            : toggleOwner(selection, id),
      ),
    isAll: isAllOwners(selection),
  };
}

export function useScopedHref() {
  const [params] = useSearchParams();
  return (pathname: string, extra?: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const owner = params.get('owner');
    const scenario = params.get('scenario');
    if (owner) next.set('owner', owner);
    if (scenario) next.set('scenario', scenario);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value) next.set(key, value);
      }
    }
    const search = next.toString();
    return search ? `${pathname}?${search}` : pathname;
  };
}
