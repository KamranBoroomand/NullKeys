# Contributing

Thanks for helping improve NullKeys.

## Before you start

- Preserve the local-first, privacy-first architecture: no accounts, remote sync, telemetry, or backend dependencies unless that direction is explicitly being changed
- Keep `package.json` private; NullKeys is distributed as source from the repository, not as a published npm package
- Keep `/devtools` development-only
- If you are using a coding agent, have it read [AGENTS.md](./AGENTS.md) before making changes

## Development setup

Use Node.js 20+ and npm 10+.

```bash
npm ci
npm run content:packs
npm run dev
```

Open `http://localhost:3000` after the dev server starts.

## Validation before opening a pull request

Prefer this sequence:

```bash
npm run content:packs
npm run lint
npm run test:unit
npm run check
```

Additional validation:

- Run `npm run test:e2e` for changes that affect onboarding, practice flows, browser storage, or visible UI behavior
- Run `npm run build` if your change touches deployment metadata, production-only routes, or security headers
- Run `npm run preview` for Cloudflare-specific deployment work after dependencies are installed

## Generated files and repo hygiene

- `public/content-packs/` is intentionally committed because release tags include the browser-served content payload
- If you change content sources or the pack-generation pipeline, rerun `npm run content:packs` and include the resulting pack changes intentionally
- Do not commit generated runtime artifacts such as `.next/`, `.open-next/`, `output/`, `test-results/`, `playwright-report/`, logs, or temp files
- Do not commit local environment or deployer-specific files such as `.dev.vars` or machine-specific junk like `.DS_Store`
- Keep documentation and public copy clear, specific, and free of machine-specific paths

## Pull request notes

- Summarize user-facing impact and any storage, migration, or deployment implications
- Call out new scripts, generated assets, or follow-up work reviewers should know about
- Include screenshots only when the change affects visible UI
- Keep public-facing copy credible and specific; avoid overstating privacy guarantees, language coverage, or roadmap certainty
