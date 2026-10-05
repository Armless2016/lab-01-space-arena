import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const rooms = JSON.parse(readFileSync(new URL('./public/api/rooms.json', import.meta.url), 'utf8'));

function apiPlugin() {
  return {
    name: 'space-arena-api',
    configureServer(server) {
      server.middlewares.use('/api/rooms', (_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(rooms));
      });

      server.middlewares.use('/api/slow', async (req, res) => {
        const url = new URL(req.originalUrl ?? req.url, 'http://localhost');
        const delay = Math.min(Number(url.searchParams.get('ms') ?? 2500), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true, delay }));
      });

      server.middlewares.use('/api/broken-json', (_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end('{ this is not valid JSON ');
      });
    },
  };
}

export default defineConfig({ plugins: [apiPlugin()] });
