# Contributing

Thanks for helping improve NullKeys.

## Development setup

```bash
npm ci
npm run content:packs
npm run dev
```

Use Node.js 20+ and npm 10+.

## Checks before opening a pull request

```bash
npm run check
npm test
```

If you are working only on unit-level changes, `npm run test:unit` is a faster first pass.

If your change touches deployment metadata or headers, also run `npm run build`. For Cloudflare-specific deployment work, use `npm run preview` after dependencies are installed.

## Project expectations

- Preserve the local-first architecture: no accounts, remote sync, or backend dependencies unless they are explicitly planned
- Keep `/devtools` development-only
- Avoid committing generated runtime artifacts such as `.next/`, `output/`, `test-results/`, logs, or temp files
- Avoid committing Cloudflare runtime output such as `.open-next/` or local `.dev.vars` files
- Keep documentation and public copy clear, neutral, and free of machine-specific paths

## Pull request notes

- Summarize user-facing impact and any storage or migration implications
- Call out new scripts, generated assets, or follow-up work reviewers should know about
- Include screenshots only when the change affects visible UI
