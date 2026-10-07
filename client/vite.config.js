import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const serverPort = Number(env.SERVER_PORT || 3000);

  return {
    root: '.',
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
