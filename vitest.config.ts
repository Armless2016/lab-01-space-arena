import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'shared/tests/**/*.test.ts',
      'client/tests/**/*.test.ts',
      'server/tests/**/*.test.ts',
    ],
    environment: 'node',
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: [
        'shared/types.ts',
        'shared/vector2.ts',
        'shared/collision.ts',
        'shared/object-pool.ts',
        'shared/netcode.ts',
        'shared/simulation.ts',
        'shared/protocol.ts',
        'shared/schemas.ts',
      ],
      exclude: ['shared/index.ts'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 80,
        branches: 70,
      },
      reporter: ['text', 'html'],
    },
  },
});
