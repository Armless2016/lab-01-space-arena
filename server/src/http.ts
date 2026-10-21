import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { URL } from 'node:url';
import { ZodError } from 'zod';
import type { ServerConfig } from './config.ts';
import { readJsonBody, RequestBodyError } from './request.ts';
import type { RoomManager } from './rooms.ts';

const MIME = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.wav', 'audio/wav'],
  ['.svg', 'image/svg+xml'],
]);

function json(res: ServerResponse, status: number, data: unknown): void {
  const payload = Buffer.from(JSON.stringify(data));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', payload.length);
  res.end(payload);
}

function rejectTraversal(urlPath: string): boolean {
  const decoded = decodeURIComponent(urlPath);
  return decoded.split('/').some((segment) => segment === '..') || decoded.includes('\\..');
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string, clientDistDir: string): Promise<void> {
  if (rejectTraversal(pathname)) { json(res, 400, { error: 'path traversal rejected' }); return; }
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(clientDistDir, relative);
  const root = path.resolve(clientDistDir);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) { json(res, 400, { error: 'invalid path' }); return; }

  try {
    const stream = createReadStream(filePath);
    await new Promise<void>((resolve, reject) => {
      stream.once('open', () => resolve());
      stream.once('error', reject);
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME.get(path.extname(filePath)) ?? 'application/octet-stream');
    await pipeline(stream, res);
  } catch {
    json(res, 404, { error: pathname === '/' ? 'client build missing; run npm run build' : 'not found' });
  }
}

export function createHttpHandler(options: { readonly config: ServerConfig; readonly rooms: RoomManager }) {
  const { config, rooms } = options;
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
      const { pathname } = url;
      if (pathname === '/health' && req.method === 'GET') {
        json(res, 200, { ok: true, service: 'space-arena-server', time: new Date().toISOString() });
        return;
      }
      if (pathname === '/api/rooms' && req.method === 'GET') { json(res, 200, rooms.list()); return; }
      if (pathname === '/api/rooms' && req.method === 'POST') {
        const body = await readJsonBody(req, 8192);
        const created = await rooms.create(body);
        json(res, 201, created);
        return;
      }

      const replayMatch = pathname.match(/^\/api\/rooms\/([-_a-zA-Z0-9]+)\/replay$/);
      const replayRoomId = replayMatch?.[1];
      if (replayRoomId && req.method === 'GET') {
        const room = rooms.get(replayRoomId);
        let stream = room?.log.replayStream?.();
        if (!stream) {
          const filePath = path.join(config.logDir, `${replayRoomId}.ndjson`);
          try { stream = createReadStream(filePath); } catch { json(res, 404, { error: 'replay not found' }); return; }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        await pipeline(stream, res);
        return;
      }

      if (pathname === '/api/slow' && req.method === 'GET') {
        const ms = Math.min(Number(url.searchParams.get('ms') || 2500), 5000);
        await new Promise<void>((resolve) => setTimeout(resolve, ms));
        json(res, 200, { ok: true, delay: ms });
        return;
      }
      if (pathname === '/api/broken-json' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end('{ invalid json ');
        return;
      }
      if (req.method === 'GET') { await serveStatic(req, res, pathname, config.clientDistDir); return; }
      json(res, 404, { error: 'not found' });
    } catch (error: unknown) {
      if (error instanceof RequestBodyError && error.code === 'BODY_TOO_LARGE') { json(res, 413, { error: error.message }); return; }
      if (error instanceof RequestBodyError && error.code === 'BAD_JSON') { json(res, 400, { error: error.message }); return; }
      if (error instanceof ZodError) { json(res, 400, { error: 'invalid request', issues: error.issues }); return; }
      if (error instanceof Error && error.message === 'Invalid or duplicate room id') { json(res, 400, { error: error.message }); return; }
      console.error('[http]', error);
      if (!res.headersSent) json(res, 500, { error: 'internal server error' });
      else res.destroy(error instanceof Error ? error : new Error('unknown response error'));
    }
  };
}
