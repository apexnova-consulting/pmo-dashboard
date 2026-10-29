import { getHistory } from '../lib/handlers';
import { adapt } from '../lib/nodeAdapter';
import { liveDeps } from '../lib/runtime';

export function GET(request: Request) {
  return getHistory(request, liveDeps());
}

export default adapt(GET);
