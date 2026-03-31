# AGENTS.md

## Project identity

NullKeys is a local-first, privacy-first multilingual typing trainer. It runs in the browser, stores progress on-device, and does not currently use accounts, remote sync, telemetry, or a product backend.

## Non-negotiable constraints

- Preserve the local-first architecture unless a task explicitly changes product direction.
- Do not add accounts, hosted profiles, telemetry, remote sync, or backend dependencies as incidental improvements.
- Keep `package.json` private unless there is a strong repo-local reason to change it.
- Treat Cloudflare as a hosting target for the app shell, not as an excuse to move learner data off-device.

## Important commands

```bash
npm ci
npm run content:packs
npm run dev
npm run lint
npm run test:unit
npm run check
npm run test:e2e
npm run build
npm run preview
```

Preferred validation order for routine work:

```bash
npm run content:packs
npm run lint
npm run test:unit
npm run check
```

## Files and areas that deserve extra caution

- `src/lib/persistence/**` and `src/features/user-preferences/preferences-store.ts`
  These files define browser storage, learner history, preferences, archive export and import, and local data reset behavior.
- `src/features/content-packs/**`, `scripts/build-content-packs.mjs`, and `public/content-packs/**`
  Content packs are a core product surface. The generated browser payload under `public/content-packs/` is intentionally committed.
- `src/app/devtools/page.tsx` and `src/features/developer-tools/**`
  Developer tooling must remain development-only and unavailable in production.
- `next.config.ts`, `src/app/metadata.ts`, `src/lib/install/service-worker-registration.ts`, `wrangler.jsonc`, and `docs/cloudflare-deployment.md`
  These files shape production headers, metadata, service-worker behavior, and Cloudflare deployment expectations.

## Commit and patch hygiene

- Do not commit runtime artifacts such as `.next/`, `.open-next/`, `output/`, `test-results/`, `playwright-report/`, or machine-specific junk like `.DS_Store`.
- Do not commit deployer-local files such as `.dev.vars` unless a task explicitly requires a tracked example file.
- Commit generated `public/content-packs/**` only when source content or the pack-generation pipeline intentionally changed.
- Keep public-facing copy specific, credible, and aligned with the current release status: `v0.1.0`, early public release, source-first distribution.
