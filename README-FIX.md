# ESLint environment fix for Lab 8

Replace the repository-root `eslint.config.js` with the one in this folder.

This keeps ESLint enabled while assigning the correct globals by runtime:
- `client/**`: browser globals, including legacy `.js` files kept from earlier labs;
- `client/public/service-worker.js`: browser + service-worker globals;
- `server/**`: Node.js globals for `.js`, `.mjs`, `.cjs`, and `.ts`;
- `shared/**`: globals shared by browser and Node.js;
- scripts, Playwright, benchmarks, and config files: Node.js globals.

Then run from the repository root:

```powershell
npm run lint
```

This addresses `no-undef` reports caused by ESLint not knowing which runtime a file belongs to. It does not disable `no-undef` or other recommended rules. Any remaining unused-variable or genuine logic/style errors should be fixed individually.
