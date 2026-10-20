import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const CLIENT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CLIENT_ROOT, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, PROJECT_ROOT, '');
  const serverPort = Number(env.SERVER_PORT || env.PORT || 3000);

  return {
    root: CLIENT_ROOT,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
        '/ws': {
          target: `ws://localhost:${serverPort}`,
          ws: true,
        },
      },
    },
  };
});
