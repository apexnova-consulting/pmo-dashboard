import { config } from '@/lib/config';
import type { DataClient } from '@/data/client';
import { httpClient } from '@/data/httpClient';
import { getMockClient } from '@/data/mockClient';
import { parseScenario, type Scenario } from '@/data/mock/generate';

export function scenarioFromLocation(
  search = typeof window === 'undefined' ? '' : window.location.search,
): Scenario {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return parseScenario(params.get('scenario') || config.scenario);
}

export function getDataClient(scenario: Scenario = scenarioFromLocation()): DataClient {
  if (config.dataSource === 'http') return httpClient;
  return getMockClient(scenario);
}
