import process from 'node:process';

// Force the local development policy before config.ts is evaluated.
// This avoids a stale NODE_ENV=production in the shell or .env rejecting localhost origins.
process.env.NODE_ENV = 'development';
await import('./index.ts');
