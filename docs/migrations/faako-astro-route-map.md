# Faako Website Astro route map

Status: implemented and locally validated on 2026-07-30.

## Scope boundary

This map covers only `apps/faako-website`, the public Faako marketing and intake site. It does not cover or change Faako ERP, Dev ERP, Faako API, or any authenticated operational module.

Before migration, the site was a React 18/Vite single-page application. `BrowserRouter` owned all routes, `public/_redirects` rewrote every request to `index.html`, page metadata was limited to the root document plus client-side title changes, and every route loaded the application shell. The Astro destination keeps the same public paths while producing one static HTML document per route.

## Route inventory and disposition

| Current path | Destination path | Migration status | Redirect required | Content source | Interactive dependencies |
| --- | --- | --- | --- | --- | --- |
| `/` | `/` | Complete | No | `src/views/Home.jsx` through `src/pages/index.astro` | React island at `client:idle`; billing toggle, carousel controls, hero/visual motion |
| `/solutions` | `/solutions` | Complete | No | `src/views/Solutions.jsx` | React island at `client:visible`; device merge animation |
| `/case-studies` | `/case-studies` | Complete | No | `src/views/CaseStudies.jsx` | React island at `client:visible`; industry/location filters |
| `/case-studies/:slug` | `/case-studies` | Redirected | Yes, 301 | The old router already redirected every slug and never rendered `CaseStudyDetail.jsx` | None; Cloudflare wildcard redirect |
| `/about` | `/about` | Complete | No | `src/views/About.jsx` | Server-rendered React compatibility view; no page hydration |
| `/pricing` | `/pricing` | Complete | No | `src/views/Pricing.jsx` | React island at `client:visible`; expandable example scopes |
| `/configure` | `/configure` | Complete | No | `src/views/ModuleConfig.jsx` | React island at `client:load`; module selection and local draft |
| `/modules/:moduleId` | Same path | Complete | No | `src/data/modules.js` and `src/views/ModuleDetail.jsx` | Six pre-rendered, non-hydrated documents |
| `/modules/website` | Same path | Complete | No | `src/data/modules.js` | None |
| `/modules/inventory` | Same path | Complete | No | `src/data/modules.js` | None |
| `/modules/crm` | Same path | Complete | No | `src/data/modules.js` | None |
| `/modules/reports` | Same path | Complete | No | `src/data/modules.js` | None |
| `/modules/delivery` | Same path | Complete | No | `src/data/modules.js` | None |
| `/modules/hr` | Same path | Complete | No | `src/data/modules.js` | None |
| `/dashboard` | `/dashboard` | Complete, no-index | No | `src/views/Dashboard.jsx` | React island at `client:load`; reads the configurator draft. This remains a public preview, not an authenticated ERP dashboard |
| `/signup` | `/signup` | Complete, no-index | No | `src/views/Signup.jsx` | React island at `client:load`; local draft, validation, API submission |
| `/client-setup` | `/client-setup` | Complete, no-index | No | `src/views/ClientSetup.jsx` | React island at `client:load`; conditional wizard, local draft, API submission |
| `/login` | `/login` | Complete, no-index | No | `src/views/Login.jsx` | React island at `client:load`; local validation only |
| `/forgot-password` | `/forgot-password` | Complete, no-index | No | `src/views/ForgotPassword.jsx` | React island at `client:load`; local validation only |
| `/contact` | `/contact` | Complete | No | `src/views/Contact.jsx` | React island at `client:load`; shared validation and mail-client hand-off |
| `/privacy` | `/privacy` | Complete | No | `src/views/Privacy.jsx` | Server-rendered React compatibility view; no page hydration |
| `/terms` | `/terms` | Complete | No | `src/views/Terms.jsx` | Server-rendered React compatibility view; no page hydration |
| Unmatched route | `/404.html` | Complete | No | `src/views/NotFound.jsx` through `src/pages/404.astro` | No page hydration; real HTTP 404 in Astro preview/static hosting |
| Server error document | `/500.html` | Added | No | `src/pages/500.astro` | Plain Astro |

The generated sitemap includes the marketing, contact, legal, configurator, and six module routes. It excludes 404/500 plus the no-index prototype and intake routes.

## Forms and API dependencies

| Route | Pre-migration behaviour | Astro behaviour | Dependency |
| --- | --- | --- | --- |
| `/contact` | Native `mailto:` hand-off | Preserved; now validates with `@faako/validation`, includes a honeypot and a short duplicate-submit lock, and retains clear info/success/error states | Visitor email client |
| `/signup` | `POST` to the configured signup endpoint | Payload and accepted fields preserved; request now goes through `@faako/api-client`, includes request ID support and the existing idempotency key | Faako API `/signup` |
| `/client-setup` | `POST` to the configured signup endpoint | Same compatibility and shared-client treatment as signup | Faako API `/signup` |
| `/login` | Local validation with no authentication request | Preserved and explicitly no-indexed | None |
| `/forgot-password` | Local validation with no recovery request | Preserved and explicitly no-indexed | None |

Signup email/PDF generation, rate limiting, storage, and provider credentials remain Faako API responsibilities. No server secret is imported by the Astro app.

## Analytics and external integrations

- Google Analytics remains optional, consent-aware, and driven by the existing shared tracker.
- Google Translate remains a deferred footer interaction.
- The homepage ERP demonstration link remains controlled by the existing public environment input.
- Contact email and telephone links are preserved.
- The prior floating WhatsApp component contained an unresolved placeholder number. It was removed from rendered pages rather than publishing an invalid or invented contact. A verified WhatsApp Business number is required before restoring it.

## Environment-variable audit

Consumed by the website build or browser islands:

- `VITE_API_BASE_URL`
- `VITE_ENABLE_APP_UPDATE_NOTICE`
- `VITE_ENABLE_GA_IN_DEV`
- `VITE_ERP_DEMO_URL`
- `VITE_GA_ID`
- `VITE_GA_MEASUREMENT_ID`

Local development only:

- `FAAKO_API_PROXY_TARGET`

Present historically but not consumed by the migrated website:

- `VITE_KPI_BASE_URL`

API-owned names that must not be configured on the static website include:

- `ADMIN_EMAIL`
- `ALLOW_PRODUCTION_DATABASE_IN_DEV`
- `ALLOWED_ORIGIN`
- `APP_ENV`
- `DATABASE_URL`
- `DATABASE_URL_DEVELOPMENT`
- `DATABASE_URL_LOCAL`
- `DATABASE_URL_PRODUCTION`
- `EMAIL_FORCE_TO`
- `EXPOSE_DEBUG_ERRORS`
- `FAAKO_ONBOARDING_ADMIN_EMAIL`
- `FAAKO_ONBOARDING_FROM_EMAIL`
- `FAAKO_ONBOARDING_FROM_NAME`
- `INTAKE_ADMIN_EMAIL`
- `RATE_LIMIT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

## Deployment audit

The old build produced `dist/` through Vite and required an SPA catch-all. The Astro build still produces `dist/`, but direct routes are actual files and the catch-all has been removed. `public/_headers`, `public/_redirects`, `robots.txt`, the manifest, generated sitemap, and post-build CSP hashes are deployment inputs. No production deployment was changed during implementation.
