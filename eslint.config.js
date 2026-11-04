import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/logs/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'server/bench/*.csv',
      '**/node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Browser application files, including legacy JS modules kept from Labs 1–5.
  {
    files: ['client/**/*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': 'off' },
  },
  // A service worker has a different global scope from an ordinary browser page.
  {
    files: ['client/public/service-worker.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
  },
  // Node.js server files, including the older .js modules retained during migration.
  {
    files: ['server/**/*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  // Shared code runs in both the browser and Node.js; use only their shared globals.
  {
    files: ['shared/**/*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals['shared-node-browser'] },
    rules: { 'no-console': 'off' },
  },
  // Node-based scripts, tests, Playwright, and root configuration files.
  {
    files: [
      'scripts/**/*.{js,mjs,cjs,ts}',
      'e2e/**/*.{js,mjs,cjs,ts}',
      'server/examples/**/*.{js,mjs,cjs,ts}',
      'server/bench/**/*.{js,mjs,cjs,ts}',
      '*.config.{js,mjs,cjs,ts}',
      'playwright.config.{js,mjs,cjs,ts}',
      'vitest.config.{js,mjs,cjs,ts}',
    ],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
);
