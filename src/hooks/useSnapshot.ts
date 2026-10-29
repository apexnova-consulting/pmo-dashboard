import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { isDataFormatError } from '@/data/errors';
import { getDataClient } from '@/data/factory';
import type { Snapshot } from '@/data/schema';
import { parseScenario } from '@/data/mock/generate';
import { config } from '@/lib/config';

let lastGood: Snapshot | null = null;

export function useScenario() {
  const [params] = useSearchParams();
  return parseScenario(params.get('scenario') || config.scenario);
}

export function useSnapshot() {
  const scenario = useScenario();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['snapshot', scenario],
    queryFn: async () => {
      const result = await getDataClient(scenario).getSnapshot();
      if (result.kind === 'not-modified') {
        const cached = queryClient.getQueryData<Snapshot>(['snapshot', scenario]);
        if (cached) return cached;
        throw new Error('The server said nothing changed, but there is no snapshot yet.');
      }
      lastGood = result.snapshot;
      return result.snapshot;
    },
  });
  const snapshot = query.data ?? (query.isError ? lastGood : undefined) ?? undefined;
  return {
    ...query,
    scenario,
    snapshot: snapshot ?? null,
    showingStale: Boolean(query.isError && !query.data && snapshot),
    formatError: isDataFormatError(query.error),
  };
}

export function useRefreshHistory() {
  const scenario = useScenario();
  return useQuery({
    queryKey: ['refresh-history', scenario],
    queryFn: () => getDataClient(scenario).getRefreshHistory(10),
  });
}
