import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/logs/**', 'server/bench/*.csv'] },
  js.configs.recommended,
  {
    files: ['client/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['server/**/*.js', 'server/**/*.mjs', 'server/**/*.cjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
];
