import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { URL } from 'node:url';
import { readJsonBody } from './request.js';

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.wav', 'audio/wav'],
  ['.svg', 'image/svg+xml'],
]);

function json(res, status, data) {
  const payload = Buffer.from(JSON.stringify(data));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', payload.length);
  res.end(payload);
}

function rejectTraversal(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  return decoded.split('/').some((segment) => segment === '..') || decoded.includes('\\..');
}

async function serveStatic(req, res, pathname, clientDistDir) {
  if (rejectTraversal(pathname)) return json(res, 400, { error: 'path traversal rejected' });
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(clientDistDir, relative);
  const root = path.resolve(clientDistDir);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return json(res, 400, { error: 'invalid path' });

  try {
    const stream = createReadStream(filePath);
    await new Promise((resolve, reject) => {
      stream.once('open', resolve);
      stream.once('error', reject);
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME.get(path.extname(filePath)) || 'application/octet-stream');
    await pipeline(stream, res);
  } catch {
    if (pathname !== '/') return json(res, 404, { error: 'not found' });
    return json(res, 404, { error: 'client build missing; run npm run build' });
  }
}

export function createHttpHandler({ config, rooms }) {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const { pathname } = url;

      if (pathname === '/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'space-arena-server', time: new Date().toISOString() });

      if (pathname === '/api/rooms' && req.method === 'GET') return json(res, 200, rooms.list());

      if (pathname === '/api/rooms' && req.method === 'POST') {
        const body = await readJsonBody(req, 8192);
        const created = await rooms.create(body);
        return json(res, 201, created);
      }

      const replayMatch = pathname.match(/^\/api\/rooms\/([-_a-zA-Z0-9]+)\/replay$/);
      if (replayMatch && req.method === 'GET') {
        const room = rooms.get(replayMatch[1]);
        let stream = room?.log?.replayStream();
        if (!stream) {
          const filePath = path.join(config.logDir, `${replayMatch[1]}.ndjson`);
          try { stream = createReadStream(filePath); } catch { return json(res, 404, { error: 'replay not found' }); }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        await pipeline(stream, res);
        return;
      }

      if (pathname === '/api/slow' && req.method === 'GET') {
        const ms = Math.min(Number(url.searchParams.get('ms') || 2500), 5000);
        await new Promise((resolve) => setTimeout(resolve, ms));
        return json(res, 200, { ok: true, delay: ms });
      }

      if (pathname === '/api/broken-json' && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end('{ invalid json ');
        return;
      }

      if (req.method === 'GET') return serveStatic(req, res, pathname, config.clientDistDir);
      json(res, 404, { error: 'not found' });
    } catch (error) {
      if (error.code === 'BODY_TOO_LARGE') return json(res, 413, { error: error.message });
      if (error.code === 'BAD_JSON') return json(res, 400, { error: error.message });
      if (error.message === 'Invalid or duplicate room id' || error.message === 'Room numeric configuration is invalid') return json(res, 400, { error: error.message });
      console.error('[http]', error);
      if (!res.headersSent) json(res, 500, { error: 'internal server error' });
      else res.destroy(error);
    }
  };
}
