# NullKeys

NullKeys is a local-first typing trainer for English, Persian, and Russian. It combines adaptive practice, controlled typing tests, keyboard layout analysis, and on-device progress history without accounts, remote sync, telemetry, or a product backend.

Hosted app: [https://nullkeys.kamranboroomand.ir](https://nullkeys.kamranboroomand.ir)

## What NullKeys is

NullKeys is for people who want more depth than a one-page speed test without tying their practice history to an account or cloud service. It treats offline-capable, on-device use as the default, not a fallback.

## Why it exists

Preferences, learner state, session history, and cached content stay in the browser on the device. The product is built around solo practice, repeatable local benchmarks, and manual data portability.

## Who it is for

- People practicing English, Persian, or Russian across supported keyboard layouts
- Learners who want adaptive drills and review surfaces, not just a speed test
- Privacy-conscious users who prefer browser storage over accounts and hosted profiles
- People who want manual archive export and import instead of automatic sync

## What makes it different

- Local-first by design: no accounts, remote sync, telemetry pipeline, or cloud-backed progress store
- First-class English, Persian, and Russian content packs, including RTL handling for Persian
- Adaptive practice that reacts to learner history instead of serving fixed drills
- Keyboard layout exploration and analysis alongside normal typing practice
- Manual local archive export and import for portability without changing the no-account model
- Grapheme-based typing and scoring so composed text, joined emoji, and RTL prompts use the same cursor model

## Current feature set

- Adaptive practice with density controls, keyboard coaching, and progression-aware prompts
- Standalone typing-test and benchmark flows with saved local reports and replayable sessions
- Profile and progress views with trends, histograms, heatmaps, comparisons, and recent history
- Keyboard layout explorer with language-aware analysis, row metrics, hand balance, and comparisons
- Onboarding, help, methodology, privacy, and settings pages that explain how the product works
- Browser install support and local archive tools for saving or moving on-device data

## Local-first and privacy model

NullKeys has no account system and no product backend. Local data lives in browser storage:

- IndexedDB for preferences, session history, analytics snapshots, learner state, and content caches
- `localStorage` only for one-time legacy-preference migration and a cross-tab change signal
- Small cookies for the onboarding and install-banner hints used by the application shell

There is no remote sync, hosted recovery path, or server-side copy of personal progress. If local browser data is deleted before export, NullKeys cannot recover it.

Archive export includes preferences, complete session history, and learner profiles, but excludes disposable content caches. The JSON payload has a canonical SHA-256 integrity digest for damage detection. Import enforces schema, graph-depth, record-count, and total-size limits before a single IndexedDB transaction replaces preferences and profile history. A failed transaction leaves the previous profile active.

## Benchmark integrity

Benchmark input events are checked against a monotonic deadline before prompt completion is considered. An event exactly at the deadline is late. Paste, drop, autofill, replacement, undo/redo, suspicious multi-character insertion, focus loss, visibility loss, and unusable event timing invalidate ranking eligibility. Adaptive practice instead pauses on focus or visibility loss, preserves the prompt and typed text, and excludes the pause from active timing. Timed-out, incomplete, interrupted, invalid, legacy-scoring, and unsupported-configuration records remain diagnostic history only; they cannot enter benchmark rankings or authoritative aggregates.

English, Persian, and Russian are the only selectable v1 languages and the only languages in the public content-pack manifest.

## Run locally

Requirements:

- Node.js 22.12 or newer in the 22.x line
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
- `npm run release:source` creates and independently verifies a source archive from the current commit's tracked files only

For a clean first run, visit `/onboarding`, choose language and keyboard preferences, and continue into practice.

## Test and validation

Recommended validation order:

```bash
npm run content:packs
npm run lint
npm run typecheck
npm run test:unit
npm run check:generated
npm run check:audit
npm run build
npm run check:bundle
npm run check:hygiene
npm run check:secrets
npm run check
```

Other useful commands:

- `npm run test:e2e`: Chromium desktop/mobile flows, accessibility coverage, and Firefox/WebKit smoke projects
- `npm test`: the full automated suite
- `npm run build`: production Next.js build
- `npm run start`: serve an existing production build locally
- `npm run check:hygiene`: tracked-file release hygiene check
- `npm run check:secrets`: lightweight secret-pattern scan
- `npm run check:bundle`: production static asset budget check after `npm run build`

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

The service worker uses a versioned cache, network-first navigation, and an explicit update action so an installed app is not trapped on an old shell or reloaded during an active lesson.

## Browser and offline support

NullKeys targets current Chromium, Firefox, and Safari releases with IndexedDB, service workers, Web Crypto, and modern Unicode segmentation. Chromium receives the full automated desktop and mobile flow suite; Firefox and WebKit receive route smoke coverage. Native input-method behavior still varies by browser and operating system, so each release should include a native Safari check in addition to the WebKit runner.

Offline use becomes available after a successful online load has installed the generated service worker and cached the current build. Navigations use a network-first strategy with a cached page or dedicated offline fallback. Updates wait for explicit activation, ask all open app tabs whether typing is active, and do not reload an active lesson or benchmark.

## Architecture notes

- Typing input, prompt rendering, scoring, and replay use shared grapheme segmentation helpers.
- Scoring semantics are documented in [docs/scoring.md](./docs/scoring.md).
- Content-pack provenance is tracked in [CONTENT_SOURCES.md](./CONTENT_SOURCES.md).
- IndexedDB schema version `4` includes preferences, sessions, analytics snapshots, progression profiles, content cache entries, and app metadata.

## Current limitations

- NullKeys is intentionally local-only: there is no account system, sync, or hosted backup
- Browser and operating-system input behavior can vary; composition events are handled without inventing per-character timing
- Archive import replaces local data instead of merging it, so exporting before experiments is strongly recommended
- Archive integrity detects accidental or malicious modification but is not an authenticity signature because archives are user-controlled local files
- Cross-device continuity is manual, not automatic, to preserve local ownership
- The source schema can represent additional languages, but the v1 build publishes only English, Persian, and Russian

## Current release status

NullKeys `v1.0.0` is the first stable public source release. Its release tree includes the application, nine browser-served content packs, generated service worker, validation policy, and source archive tooling.

`package.json` intentionally keeps `"private": true` to prevent accidental npm publication. NullKeys is distributed as source code from this repository, not as an npm package.

## Contributing, security, and license

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development expectations, [SECURITY.md](./SECURITY.md) for vulnerability reporting guidance, and [LICENSE](./LICENSE) for the project license.
