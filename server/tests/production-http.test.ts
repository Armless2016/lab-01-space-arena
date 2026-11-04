import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHttpHandler } from '../src/http.ts';
import type { ServerConfig } from '../src/config.ts';
import { MatchLogger } from '../src/match-log.ts';
import { RoomManager } from '../src/rooms.ts';
import { RuntimeMetrics } from '../src/runtime-metrics.ts';

type Readiness = { ready: boolean; shuttingDown: boolean; canAcceptPlayers: () => boolean };

const config: ServerConfig = {
  nodeEnv: 'test',
  port: 0,
  wsMaxPayload: 16 * 1024,
  maxMessagesPerSecond: 120,
  maxConnectionsPerIp: 32,
  maxRooms: 100,
  maxPlayersPerRoom: 16,
  allowedOrigins: ['http://localhost:5173'],
  allowMissingOrigin: true,
  trustProxy: false,
  logLevel: 'silent',
  buildSha: 'lab08-test-sha',
  logDir: '/tmp/space-arena-http-test-logs',
  clientDistDir: '/tmp/space-arena-http-test-client',
};

describe('production HTTP health and observability endpoints', () => {
  let server: Server;
  let metrics: RuntimeMetrics;
  let rooms: RoomManager;
  let readiness: Readiness;
  let baseUrl: string;

  beforeEach(async () => {
    metrics = new RuntimeMetrics();
    rooms = new RoomManager(async (roomId) => new MatchLogger(config.logDir, roomId));
    readiness = { ready: true, shuttingDown: false, canAcceptPlayers: () => true };
    server = createServer(createHttpHandler({
      config,
      rooms,
      metrics,
      readiness,
      connectionCount: () => 0,
    }));
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test HTTP server did not bind a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    metrics.close();
    await new Promise<void>((resolve) => {
      if (!server.listening) { resolve(); return; }
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  it('keeps /health green and exposes the release SHA while readiness is disabled', async () => {
    readiness.ready = false;
    readiness.shuttingDown = true;

    const health = await fetch(`${baseUrl}/health`, { headers: { connection: 'close' } });
    const body: unknown = await health.json();

    expect(health.status).toBe(200);
    expect(body).toMatchObject({ ok: true, service: 'space-arena-server', gitSha: 'lab08-test-sha' });
  });

  it('returns 200 from /ready only while the process can accept players', async () => {
    const ready = await fetch(`${baseUrl}/ready`, { headers: { connection: 'close' } });
    expect(ready.status).toBe(200);

    readiness.canAcceptPlayers = () => false;
    const full = await fetch(`${baseUrl}/ready`, { headers: { connection: 'close' } });
    expect(full.status).toBe(503);

    readiness.canAcceptPlayers = () => true;
    readiness.shuttingDown = true;
    const shuttingDown = await fetch(`${baseUrl}/ready`, { headers: { connection: 'close' } });
    expect(shuttingDown.status).toBe(503);
  });

  it('rejects new application requests after shutdown starts', async () => {
    readiness.shuttingDown = true;
    readiness.ready = false;

    const rooms = await fetch(`${baseUrl}/api/rooms`, { headers: { connection: 'close' } });
    const health = await fetch(`${baseUrl}/health`, { headers: { connection: 'close' } });
    const ready = await fetch(`${baseUrl}/ready`, { headers: { connection: 'close' } });

    expect(rooms.status).toBe(503);
    expect(health.status).toBe(200);
    expect(ready.status).toBe(503);
  });

  it('exposes Prometheus metrics without caching them', async () => {
    const response = await fetch(`${baseUrl}/metrics`, { headers: { connection: 'close' } });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain; version=0.0.4');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toContain('space_arena_rooms 0');
    expect(body).toContain('process_resident_memory_bytes');
    expect(body).toContain('space_arena_event_loop_utilization');
  });
});
