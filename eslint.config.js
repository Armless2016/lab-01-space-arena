import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/logs/**', 'server/bench/*.csv'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['client/**/*.ts', 'shared/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['server/**/*.ts', 'server/**/*.mjs', 'server/**/*.cjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
);
