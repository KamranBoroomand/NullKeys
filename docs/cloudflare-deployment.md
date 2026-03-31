# Cloudflare Deployment

NullKeys is configured for a standard Next.js deployment on Cloudflare Workers through the OpenNext Cloudflare adapter. It is not a static-export or GitHub Pages repository.

## Current public targets

- Hosted app: `https://nullkeys.kamranboroomand.ir`
- Source repository: `https://github.com/KamranBoroomand/NullKeys`

## Readiness summary

- Use Cloudflare Workers with OpenNext for the production runtime.
- Do not use `next export`, Cloudflare Pages static-export assumptions, or GitHub Pages assumptions for this repository.
- Keep the existing local Node.js flow for `npm run dev`, `npm run build`, and `npm run start`.
- The app stays local-first after deployment: preferences, progress, archives, and cached content remain in the browser.
- No Cloudflare KV, D1, R2, or other runtime bindings are required for the current `v0.1.x` release line.

## Commands

Install dependencies:

```bash
npm ci
```

Build the Worker-compatible bundle:

```bash
npm run build:cloudflare
```

Preview the Worker runtime locally:

```bash
npm run preview
```

Deploy from a local machine after Wrangler authentication is configured:

```bash
npm run deploy
```

Notes:

- `opennextjs-cloudflare build` invokes the normal `build` script, so Cloudflare builds still regenerate `public/content-packs` before running `next build`.
- `cf:typegen` is optional for this release because the Worker has no custom bindings yet.
- `public/content-packs/` is intentionally committed because the release payload includes browser-served content packs.

## Cloudflare Dashboard Settings

If the owner finishes setup through the Cloudflare dashboard with a connected GitHub repository, use these values:

- Root directory: repository root
- Install command: `npm ci`
- Build command: `npm run build:cloudflare`
- Deploy command: `npx opennextjs-cloudflare deploy`

If Cloudflare auto-detects these settings correctly, keep the detected values. The important part is that the build step runs the OpenNext Cloudflare build and the deploy step runs the OpenNext Cloudflare deploy.

## Required Owner Steps

1. In Cloudflare, create or import a Workers project from the GitHub repository `KamranBoroomand/NullKeys`.
2. Confirm the production branch in `Settings > Build > Branch control`.
3. Verify the install, build, and deploy commands above if the dashboard does not auto-fill them correctly.
4. Trigger the first production build so the Worker is created.
5. In the Worker settings, add the custom domain `nullkeys.kamranboroomand.ir` as a Custom Domain.
6. Make sure the `kamranboroomand.ir` zone is managed by Cloudflare. For Custom Domains on the same zone, Cloudflare will create the DNS record and certificate automatically.
7. After the certificate is active, verify the live deployment at:
   - `https://nullkeys.kamranboroomand.ir/`
   - `https://nullkeys.kamranboroomand.ir/manifest.webmanifest`
   - `https://nullkeys.kamranboroomand.ir/content-packs/manifest.json`
   - `https://nullkeys.kamranboroomand.ir/devtools` should return a 404

## Production Notes

- `wrangler.jsonc` intentionally does not hard-code routes or a custom domain, so the Worker can be created before domain attachment.
- Security headers remain defined in [next.config.ts](../next.config.ts) so the same posture applies in local Node previews and Cloudflare-hosted production.
- Browser-served content packs are committed in `public/content-packs` and are bundled into `.open-next/assets` during the Cloudflare build.
- The service worker is served from `/service-worker.js`, which keeps its scope at the site root on the deployed domain.
- `/devtools` is development-only and resolves to a 404 in production builds.
- Local Wrangler authentication is only needed for a local CLI deploy. It is not required just to use Cloudflare's Git-connected dashboard builds.
