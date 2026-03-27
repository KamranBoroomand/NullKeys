# Cloudflare Deployment

NullKeys is set up for a normal Next.js deployment on Cloudflare Workers through the OpenNext Cloudflare adapter.

## Public endpoints

- App domain: `https://nullkeys.kamranboroomand.ir`
- GitHub repository metadata placeholders live only in [package.json](../package.json) until the public repo URL is final.

## Deployment model

- Use Cloudflare Workers for the deployed Next.js app runtime.
- Do not use `next export` or GitHub Pages assumptions for this repository.
- Keep the existing local Node.js developer flow for `npm run dev`, `npm run build`, and `npm run start`.
- The app remains local-first after deployment: progress, preferences, and archives stay in the browser.

## Commands

Install dependencies:

```bash
npm ci
```

Preview the Cloudflare runtime locally:

```bash
npm run preview
```

Deploy after Cloudflare authentication is configured:

```bash
npm run deploy
```

## Required owner setup

1. Create the public GitHub repository and replace the placeholder repository URLs.
2. Authenticate Wrangler with `npx wrangler login` or provide `CLOUDFLARE_API_TOKEN`.
3. Deploy once to create the Worker-backed app.
4. Attach the custom domain `nullkeys.kamranboroomand.ir` in Cloudflare.

## Notes

- `wrangler.jsonc` intentionally avoids hard-coding a route binding so the first deploy can be created before the custom domain is attached.
- Security headers remain defined in [next.config.ts](../next.config.ts) so the same posture applies in local Node previews and Cloudflare-hosted production.
- No Cloudflare data bindings are required for v1 because the product is intentionally local-first.
