# Deploying the byNana Portfolio

Target: Cloudflare Pages static deployment
Production origin: `https://nanaabaackah.com`
Workspace: `@faako/bynana-portfolio`

No repository-owned Wrangler/Cloudflare project configuration is currently present. Cloudflare project settings remain an external deployment concern and should be compared with this document before each launch.

## Build contract

- Install from the repository root with the locked pnpm version.
- Build command: `pnpm --filter @faako/bynana-portfolio run build`
- Output directory: `apps/bynana-portfolio/dist`
- The build runs Astro static generation and then the repository image optimizer.
- Do not deploy output from `astro build` before the image optimization step completes.
- Cloudflare must serve extensionless routes from the generated route directories and return `404.html` with status 404.

## Browser-safe environment names

Optional build inputs:

- `VITE_CONTACT_SUBMIT_ENDPOINT`
- `VITE_TRUST_STATS_ENDPOINT`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_GA_ID`
- `VITE_ENABLE_GA_IN_DEV`
- `VITE_ENABLE_APP_UPDATE_NOTICE`

Audit-only/local names:

- `PORTFOLIO_AUDIT_URL`
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`

Only names are documented here. All `VITE_*` values are public after build and must never contain secrets. A contact provider secret, mail credential, signing key, or payment credential belongs in the receiving API/Railway service, not Cloudflare Pages.

## Static delivery controls

- `public/_headers` supplies CSP, clickjacking, MIME-sniffing, referrer, and permissions-policy controls.
- `public/robots.txt` allows the production site and names the generated sitemap.
- `@astrojs/sitemap` creates the sitemap index during build.
- The site intentionally has no SPA catch-all `_redirects` file.
- Fingerprinted `/_astro/` assets may receive long-lived immutable caching at the edge. HTML and sitemap files must remain revalidatable.

## Pre-deploy checks

Run from the repository root:

```sh
pnpm --filter @faako/bynana-portfolio run lint
pnpm --filter @faako/bynana-portfolio run typecheck
pnpm --filter @faako/bynana-portfolio run test
pnpm --filter @faako/bynana-portfolio run build
```

Then verify the built preview:

- home, about, resume, projects, one project detail, blog, one article, contact, privacy;
- a direct nested URL in a fresh browser context;
- unknown URL returns the not-found document;
- navigation and mobile menu;
- contact validation and configured-endpoint or mail fallback;
- consent preferences and analytics behaviour;
- sitemap, robots, security headers, local assets, and social preview image;
- desktop and mobile layouts with reduced motion.

## Release and rollback

1. Deploy a Cloudflare preview from the intended commit.
2. Run the direct-route and metadata smoke checks against that preview.
3. Confirm the production environment names are attached to the same Pages project.
4. Promote the verified immutable deployment.
5. If a route, metadata, form, or asset regression appears, roll back to the prior Cloudflare deployment and fix forward from a new commit. Do not hand-edit generated `dist` files.
