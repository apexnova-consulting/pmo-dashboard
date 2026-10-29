import type { IncomingMessage, ServerResponse } from 'node:http';
import { jsonError } from './env';

type NodeResponse = ServerResponse & {
  status: (code: number) => NodeResponse;
  json: (body: unknown) => void;
  send: (body?: string) => void;
};

function isRequest(value: unknown): value is Request {
  return typeof Request !== 'undefined' && value instanceof Request;
}

async function fromNode(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host || 'localhost';
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'https';
  const url = new URL(req.url || '/', `${proto}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }
  const method = req.method || 'GET';
  if (method === 'GET' || method === 'HEAD') return new Request(url, { method, headers });
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

async function writeNode(res: ServerResponse, response: Response) {
  const node = res as NodeResponse;
  if (typeof node.status === 'function') node.status(response.status);
  else res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie' && typeof res.appendHeader === 'function') {
      res.appendHeader(key, value);
    } else {
      res.setHeader(key, value);
    }
  });
  const text = await response.text();
  if (typeof node.send === 'function') node.send(text);
  else res.end(text);
}

export function adapt(handle: (request: Request) => Promise<Response>) {
  return async (req: Request | IncomingMessage, res?: ServerResponse) => {
    try {
      if (!res || isRequest(req)) return handle(req as Request);
      const request = await fromNode(req);
      await writeNode(res, await handle(request));
      return undefined;
    } catch (error) {
      const code = error instanceof Error ? error.name : 'ERROR';
      console.error(code);
      const response = jsonError(500, 'INTERNAL', 'The request could not be completed.');
      if (!res || isRequest(req)) return response;
      await writeNode(res, response);
      return undefined;
    }
  };
}
