# Security Policy

## Supported versions

Security fixes target the `1.0.x` release line. Pre-1.0 snapshots should be treated as unsupported unless explicitly noted otherwise.

## Reporting a vulnerability

Please do not open a public issue for a suspected security problem.

Use one of these routes instead:

- GitHub Security Advisories or private vulnerability reporting, if enabled for the repository
- Direct private contact with the maintainers through GitHub

When reporting, include:

- A short description of the issue and affected area
- Reproduction steps or a proof of concept
- Expected impact
- Browser, operating system, and version details when they matter
- Whether the issue depends on imported local archives, service-worker state, or browser storage behavior
- Any suggested mitigation, if you have one

NullKeys is a local-first application, so please avoid attaching personal local archives, secrets, or unnecessary sensitive data. If private reporting is not available, open a minimal public issue that requests a private contact path without disclosing exploit details.

## Dependency audit policy

CI runs `npm run check:audit`, which fails on critical advisories and on any high-severity advisory that is not explicitly documented in `scripts/check-dependency-audit.mjs`.

The current documented exceptions are the linked `next` and nested `postcss` findings reported for Next.js 15. NullKeys builds repository-owned CSS only and does not process user-supplied CSS or source maps at runtime. Moving to the fixed dependency path requires a separately verified Next.js 16 and Cloudflare adapter migration.

Those exceptions are limited to known package paths and should be removed as soon as upstream packages provide a verified upgrade path.
