# Build & Run (battle process)

This folder contains TypeScript processes run by PM2. For stable production runs we prebuild TS into a JS bundle and let PM2 run the bundle. For local development you can continue to run with bun directly.

Quick commands:

# install dev deps (project root)
npm install

# build the battle bundle (project root)
npm run build:battle

# in childProcess/run-task-standalone you can then start PM2 to run the built artifact
# production (PM2 will run ./dist/runBattleProcess.js)
cd childProcess/run-task-standalone
npm run backend_prod

# for local development with bun (unchanged)
# pm2 uses the existing 'battle_local' app which still runs the TS entry via bun
npm run backend_local

Notes:
- The build script uses esbuild and outputs `dist/runBattleProcess.js`.
- Keep top-level module work light; heavy initialization is lazy-loaded inside main().