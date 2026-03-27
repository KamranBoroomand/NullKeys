# NullKeys

NullKeys is a local-first typing trainer built with Next.js, TypeScript, and Tailwind CSS. It combines adaptive lessons, standalone typing tests, keyboard layout analysis, and on-device progress history without accounts, remote sync, or cloud storage.

Public app domain: [https://nullkeys.kamranboroomand.ir](https://nullkeys.kamranboroomand.ir)

## Project overview

NullKeys is designed for people who want a deeper typing practice tool without giving up privacy or local ownership. The app runs entirely in the browser, keeps progress on the current device, and treats offline use as the default rather than a reduced mode.

## Why NullKeys exists

Most typing products ask users to trade control for convenience. NullKeys takes the opposite approach: training data, preferences, and history stay with the person using the app. The goal is to offer a richer practice environment, better multilingual support, and stronger self-review while preserving a local-first architecture.

## Current feature set

- Adaptive practice with multiple density modes, integrated keyboard coaching, and progression-aware prompts
- Standalone typing test and benchmark flows with saved local reports and replayable sessions
- Profile and progress views for trends, histograms, comparisons, heatmaps, and recent history
- Keyboard layout explorer with language-aware analysis and comparison tools
- Local archive export and import for moving browser data between devices
- Onboarding, help, methodology, privacy, and settings pages that explain how the product works
- Multilingual content packs with RTL handling and composition-aware input support for IME-heavy languages

## Local-first and privacy model

NullKeys does not require an account and does not ship with a backend. Local data lives in browser storage:

- `localStorage` for preferences, onboarding state, and UI settings
- IndexedDB for saved sessions, progress history, content caches, and learner state
- small cookies for lightweight install or onboarding hints

There is no remote sync, no telemetry pipeline, and no server-side recovery path if local browser data is deleted before export.

## Installation

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- A modern desktop browser

Install dependencies from the repository root:

```bash
npm ci
```

Generate content packs for a clean clone:

```bash
npm run content:packs
```

Release tags are expected to include the browser-served assets in `public/content-packs`. Regenerate them locally when source content changes or when you want to refresh the committed release payload.

## Development

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Helpful notes:

- `/devtools` is available only in development and is blocked in production builds
- `npm run content:packs` regenerates the browser-served content packs after source content changes
- `npm run handoff:package` creates a clean archive in `output/` without build artifacts or local runtime files

For a clean first-run path, visit `/onboarding`, choose language and keyboard preferences, and continue into practice.

## Test commands

```bash
npm run check
npm run test:unit
npm run test:e2e
npm test
```

What each command does:

- `npm run check`: content-pack generation, ESLint, Next.js type generation, TypeScript, and Vitest
- `npm run test:unit`: unit and integration coverage through Vitest
- `npm run test:e2e`: Playwright browser flows
- `npm test`: the full automated suite

## Production build

Create and preview a production build locally:

```bash
npm run build
npm run start
```

The start script checks for a production-ready `.next` bundle before launching.

## Cloudflare deployment

NullKeys is set up for a normal Next.js deployment on Cloudflare Workers, not a static-export or GitHub Pages setup. The local-first behavior stays the same: Cloudflare hosts the app shell, while preferences, progress, and content caches remain in the browser.

Cloudflare-specific commands:

```bash
npm run preview
npm run deploy
```

These commands use the OpenNext Cloudflare adapter and `wrangler` for a Workers-compatible deployment path. See [docs/cloudflare-deployment.md](./docs/cloudflare-deployment.md) for the planned domain, required GitHub/Cloudflare setup, and the small amount of configuration still owned by the deployer.

## Known limitations

- NullKeys is still pre-1.0 and intentionally local-only: there is no account system, sync, or hosted backup
- Multiplayer is intentionally offline for now and does not include matchmaking or cloud-backed sessions
- IME-heavy languages are composition-aware, but exact candidate-window behavior still depends on the browser and operating system
- Archive import replaces local data instead of merging it, so exporting before experiments is strongly recommended

## Current release status

NullKeys `v0.1.0` is the first public source release of the project. It is usable locally today, but it should still be treated as an early public release rather than a stable 1.0 contract.

`package.json` intentionally keeps `"private": true` to prevent accidental npm publication. NullKeys is distributed as source code from the repository, not as a published package.

## Contributing and security

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development expectations and [SECURITY.md](./SECURITY.md) for vulnerability reporting guidance.
