# NullKeys

NullKeys is a local-first multilingual typing trainer built with Next.js, TypeScript, and Tailwind CSS. It combines adaptive practice, typing tests, keyboard layout analysis, and on-device progress history without accounts, remote sync, telemetry, or a backend.

Hosted app: [https://nullkeys.kamranboroomand.ir](https://nullkeys.kamranboroomand.ir)

## What NullKeys is

NullKeys is for people who want more depth than a one-page speed test without tying their practice history to an account or cloud service. It treats offline-capable, on-device use as the default, not a fallback.

## Why it exists

Many typing products trade privacy and local ownership for convenience. NullKeys takes the opposite approach: preferences, learner state, session history, and cached content stay in the browser on the device. The aim is a deeper typing tool with stronger multilingual support and review while staying local-first and privacy-first.

## Who it is for

- People practicing across multiple languages or keyboard layouts
- Learners who want adaptive drills and review surfaces, not just a speed test
- Privacy-conscious users who prefer browser storage over accounts and hosted profiles
- People who want manual archive export and import instead of automatic sync

## What makes it different

- Local-first by design: no accounts, remote sync, telemetry pipeline, or cloud-backed progress store
- Multilingual content packs with RTL handling and composition-aware support for IME-heavy languages
- Adaptive practice that reacts to learner history instead of serving fixed drills
- Keyboard layout exploration and analysis alongside normal typing practice
- Manual local archive export and import for portability without changing the no-account model

## Current feature set

- Adaptive practice with density controls, keyboard coaching, and progression-aware prompts
- Standalone typing-test and benchmark flows with saved local reports and replayable sessions
- Profile and progress views with trends, histograms, heatmaps, comparisons, and recent history
- Keyboard layout explorer with language-aware analysis, row metrics, hand balance, and comparisons
- Onboarding, help, methodology, privacy, and settings pages that explain how the product works
- Browser install support and local archive tools for saving or moving on-device data

## Local-first and privacy model

NullKeys has no account system and no product backend. Local data lives in browser storage:

- `localStorage` for preferences, onboarding state, and UI settings
- IndexedDB for session history, analytics snapshots, learner state, and content caches
- Small cookies for lightweight onboarding and install hints

There is no remote sync, hosted recovery path, or server-side copy of personal progress. If local browser data is deleted before export, NullKeys cannot recover it.

## Run locally

Requirements:

- Node.js 20 or newer
- npm 10 or newer
- A modern desktop browser

Install dependencies and generate the browser-served content packs:

```bash
npm ci
npm run content:packs
```

Start the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Notes:

- `/devtools` is available only in development and is blocked in production builds
- `public/content-packs/` is intentionally committed because release tags are expected to include the browser-served content payload
- `npm run handoff:package` creates a clean archive in `output/` without build artifacts or local runtime files

For a clean first run, visit `/onboarding`, choose language and keyboard preferences, and continue into practice.

## Test and validation

Recommended validation order:

```bash
npm run content:packs
npm run lint
npm run test:unit
npm run check
```

Other useful commands:

- `npm run test:e2e`: Playwright browser flows
- `npm test`: the full automated suite
- `npm run build`: production Next.js build
- `npm run start`: serve an existing production build locally

`npm run check` runs content-pack generation, ESLint, Next.js type generation, TypeScript validation, and Vitest.

## Build and deploy

Build and preview locally:

```bash
npm run build
npm run start
```

The start script checks for a production-ready `.next` bundle before launching.

For Cloudflare deployment:

```bash
npm run preview
npm run deploy
```

NullKeys deploys to Cloudflare Workers through the OpenNext Cloudflare adapter. It is not a static-export or GitHub Pages project. Cloudflare hosts the app shell; learner data stays in the browser. See [docs/cloudflare-deployment.md](./docs/cloudflare-deployment.md) for deployment details.

## Current limitations

- NullKeys is still pre-1.0 and intentionally local-only: there is no account system, sync, or hosted backup
- Multiplayer is intentionally offline for now and does not include matchmaking or cloud-backed sessions
- IME-heavy languages are composition-aware, but exact candidate-window behavior still depends on the browser and operating system
- Archive import replaces local data instead of merging it, so exporting before experiments is strongly recommended
- Cross-device continuity is manual, not automatic, to preserve local ownership

## Current release status

NullKeys `v0.1.0` is the first public source release. It is usable today, but it should still be treated as an early public release rather than a stable 1.0 contract.

`package.json` intentionally keeps `"private": true` to prevent accidental npm publication. NullKeys is distributed as source code from this repository, not as an npm package.

## Contributing, security, and license

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development expectations, [SECURITY.md](./SECURITY.md) for vulnerability reporting guidance, and [LICENSE](./LICENSE) for the project license.
