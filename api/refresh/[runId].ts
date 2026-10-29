import { getRefresh } from '../lib/handlers';
import { adapt } from '../lib/nodeAdapter';
import { liveDeps } from '../lib/runtime';

export function GET(request: Request) {
  const runId = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) || '';
  return getRefresh(decodeURIComponent(runId), request, liveDeps());
}

export default adapt(GET);
