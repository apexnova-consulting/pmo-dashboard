import { getSnapshot } from './lib/handlers';
import { adapt } from './lib/nodeAdapter';
import { liveDeps } from './lib/runtime';

export function GET(request: Request) {
  return getSnapshot(request, liveDeps());
}

export default adapt(GET);
