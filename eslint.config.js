import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const browserSourceFiles = ['client/**/*.{js,mjs,cjs,ts,tsx}'];
const workerSourceFiles = ['client/src/workers/**/*.{js,mjs,cjs,ts}'];
const sharedSourceFiles = ['shared/**/*.{js,mjs,cjs,ts}'];
const serverSourceFiles = ['server/**/*.{js,mjs,cjs,ts}'];
const testFiles = [
  'client/tests/**/*.{js,mjs,cjs,ts}',
  'shared/tests/**/*.{js,mjs,cjs,ts}',
  'server/tests/**/*.{js,mjs,cjs,ts}',
  'e2e/**/*.{js,mjs,cjs,ts}',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/logs/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'server/bench/*.csv',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The repository still contains legacy .js modules from Labs 1–5.
    // They are browser modules too, so browser globals must apply to .js and .ts.
    files: browserSourceFiles,
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Shared simulation/protocol is intentionally isomorphic: browser + Node.
    files: sharedSourceFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Worker scripts run outside the regular Window global scope.
    files: workerSourceFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: serverSourceFiles,
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Test APIs are imported in TS tests; this also supports any legacy JS tests.
    files: testFiles,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.vitest,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Root tooling/configuration files execute in Node.js.
    files: [
      '*.config.{js,mjs,cjs,ts}',
      'scripts/**/*.{js,mjs,cjs,ts}',
      'server/bench/**/*.{js,mjs,cjs,ts}',
      'server/examples/**/*.{js,mjs,cjs,ts}',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
);
