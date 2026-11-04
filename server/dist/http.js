import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { URL } from 'node:url';
import { ZodError } from 'zod';
import { readJsonBody, RequestBodyError } from "./request.js";
import { logger } from "./logger.js";
const MIME = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.wav', 'audio/wav'],
    ['.svg', 'image/svg+xml'],
    ['.webmanifest', 'application/manifest+json; charset=utf-8'],
    ['.ico', 'image/x-icon'],
]);
function json(res, status, data) {
    const payload = Buffer.from(JSON.stringify(data));
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', payload.length);
    res.end(payload);
}
function rejectTraversal(urlPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    }
    catch {
        return true;
    }
    return decoded.split('/').some((segment) => segment === '..') || decoded.includes('\\..');
}
async function serveStatic(res, pathname, clientDistDir) {
    if (rejectTraversal(pathname)) {
        json(res, 400, { error: 'path traversal rejected' });
        return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.resolve(clientDistDir, relative);
    const root = path.resolve(clientDistDir);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
        json(res, 400, { error: 'invalid path' });
        return;
    }
    try {
        const stream = createReadStream(filePath);
        await new Promise((resolve, reject) => {
            stream.once('open', () => resolve());
            stream.once('error', reject);
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', MIME.get(path.extname(filePath)) ?? 'application/octet-stream');
        if (path.basename(filePath) === 'service-worker.js' || path.basename(filePath) === 'index.html' || path.basename(filePath) === 'manifest.webmanifest') {
            res.setHeader('Cache-Control', 'no-cache');
        }
        await pipeline(stream, res);
    }
    catch {
        json(res, 404, { error: pathname === '/' ? 'client build missing; run npm run build' : 'not found' });
    }
}
export function createHttpHandler(options) {
    const { config, rooms, metrics, readiness, connectionCount } = options;
    return async function handler(req, res) {
        try {
            const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
            const { pathname } = url;
            if (pathname === '/health' && req.method === 'GET') {
                json(res, 200, { ok: true, service: 'space-arena-server', gitSha: config.buildSha, time: new Date().toISOString() });
                return;
            }
            if (pathname === '/ready' && req.method === 'GET') {
                const capacityAvailable = readiness.canAcceptPlayers?.() ?? true;
                const ready = readiness.ready && !readiness.shuttingDown && capacityAvailable;
                json(res, ready ? 200 : 503, { ready, shuttingDown: readiness.shuttingDown });
                return;
            }
            if (pathname === '/metrics' && req.method === 'GET') {
                const payload = metrics.toPrometheus(rooms, connectionCount());
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
                res.setHeader('Cache-Control', 'no-store');
                res.end(payload);
                return;
            }
            if (readiness.shuttingDown) {
                json(res, 503, { error: 'server is shutting down' });
                return;
            }
            if (pathname === '/api/metrics' && req.method === 'GET') {
                json(res, 200, metrics.snapshot(rooms, connectionCount()));
                return;
            }
            if (pathname === '/api/rooms' && req.method === 'GET') {
                json(res, 200, rooms.list());
                return;
            }
            if (pathname === '/api/rooms' && req.method === 'POST') {
                if (!readiness.ready || readiness.shuttingDown) {
                    json(res, 503, { error: 'server is not ready to accept new rooms' });
                    return;
                }
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
                    try {
                        stream = createReadStream(filePath);
                    }
                    catch {
                        json(res, 404, { error: 'replay not found' });
                        return;
                    }
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
                json(res, 200, { ok: true, delay: ms });
                return;
            }
            if (pathname === '/api/broken-json' && req.method === 'GET') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end('{ invalid json ');
                return;
            }
            if (req.method === 'GET') {
                await serveStatic(res, pathname, config.clientDistDir);
                return;
            }
            json(res, 404, { error: 'not found' });
        }
        catch (error) {
            if (error instanceof RequestBodyError && error.code === 'BODY_TOO_LARGE') {
                json(res, 413, { error: error.message });
                return;
            }
            if (error instanceof RequestBodyError && error.code === 'BAD_JSON') {
                json(res, 400, { error: error.message });
                return;
            }
            if (error instanceof ZodError) {
                json(res, 400, { error: 'invalid request', issues: error.issues });
                return;
            }
            if (error instanceof Error && error.message === 'Invalid or duplicate room id') {
                json(res, 400, { error: error.message });
                return;
            }
            logger.error({ err: error, method: req.method, path: req.url?.split('?')[0] }, 'http_request_failed');
            if (!res.headersSent)
                json(res, 500, { error: 'internal server error' });
            else
                res.destroy(error instanceof Error ? error : new Error('unknown response error'));
        }
    };
}
