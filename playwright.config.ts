import { defineConfig } from '@playwright/test';

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Start the API/WebSocket server and Vite as two independent services.
  // This avoids treating an already-running Vite process as proof that the API is ready.
  webServer: [
    {
      command: 'npm run dev --workspace=./server',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev --workspace=./client',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
