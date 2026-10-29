import { postRefresh } from '../lib/handlers';
import { adapt } from '../lib/nodeAdapter';
import { liveDeps } from '../lib/runtime';

export function POST(request: Request) {
  return postRefresh(request, liveDeps());
}

export default adapt(POST);
