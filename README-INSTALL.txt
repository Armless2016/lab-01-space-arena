Local Origin fix for Space Arena Lab 8

Copy the contents of this archive into the ROOT of the existing repository
(the folder containing package.json, client/, server/, shared/).
Allow replacing files.

This patch:
- creates/replaces root .env with safe local development values;
- updates server/package.json so dev launch forces NODE_ENV=development;
- updates server/src/config.ts so localhost origins are always allowed in development/test;
- keeps production origin validation strict.

Do not copy this .env to production. The .env file is local-only and should remain gitignored.
After copying, stop old processes (Ctrl+C), then start:
  npm run dev:server
  npm run dev:client
Open http://localhost:5173
