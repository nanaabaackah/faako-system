# Repository audit

Date: 2026-07-25; quality-gate and build-determinism findings updated 2026-07-26
Scope: current-state inspection before framework or architecture changes

## Executive summary

Faako is a pnpm/Turborepo monorepo containing 10 active JavaScript application workspaces, one artifact-only application directory, 18 active shared-package workspaces, three placeholder package directories, and one Python service outside the pnpm workspace.

The dominant application architecture is React plus Vite with React Router and Express/Prisma backends where server behavior is required. The portfolio is already an Astro static site, but it hydrates a site-wide React Router island. Public Faako and REEBS sites are client-rendered Vite SPAs and are the strongest Astro migration candidates. The authenticated ERP and portal surfaces should remain React/Vite. No current application has a compelling, low-risk reason to move to Next.js.

The quality-gate orchestration and deterministic-build gaps identified by the audit have now been repaired for active pnpm workspaces. The remaining main blockers to framework migration are duplicated REEBS code, mixed public/private surfaces, app-local API and domain contracts, inconsistent authentication patterns, broad environment-variable surfaces, Prisma generation side effects, and incomplete public-site/E2E coverage.

No framework, application, package, route, or deployment architecture was changed. A follow-up quality-gate repair added scripts, check configuration, and one Dev ERP regression fix.

## Repository and workspace configuration

- Package manager: pnpm, pinned at `pnpm@10.33.0` in the root `package.json`.
- Lockfile: `pnpm-lock.yaml`; no npm, Yarn, or Bun lockfile was found.
- Workspace declarations: root `package.json` and `pnpm-workspace.yaml` both include `apps/*` and `packages/*`.
- `services/*` is not part of the pnpm workspace.
- Task runner: Turborepo 2 (`turbo@^2.0.0`; installed CLI reported 2.8.17).
- Root scripts now include `lint`, `typecheck`, `test`, `build`, sequential `check`, separate `test:e2e`, and isolated `test:python`, in addition to development, hosting/registry, security, and database commands.
- Root package name: `faako-new`.

### Current Turborepo behavior

| Task | Configuration | Consequence |
| --- | --- | --- |
| `dev` | cache disabled; persistent | Appropriate for development servers. |
| `build` | depends on `^build`; hashes `NODE_ENV`, `PUBLIC_*`, `VITE_*`, package `.env*` files, and shared root inputs; output `dist/**` | Safe frontend builds are cached. Dev ERP and Stroane override caching because Prisma generation writes outside `dist/**`; Faako API declares no artifact. |
| `lint` | no dependencies; no outputs | All 28 active pnpm workspaces expose lint. |
| `typecheck` | depends on `^typecheck`; no outputs | Runs in 13 currently applicable Astro/TypeScript/declaration workspaces. |
| `test` | no outputs; cache disabled | Runs all existing Node unit/integration suites and excludes E2E. |
| `test:e2e` | no outputs; cache disabled | Separate browser-test boundary. |

Root global dependencies cover the manifest, lockfile, workspace definition, and shared Vite helpers. Package-level Turbo configuration documents output and cache exceptions. Runtime-state-dependent tests remain uncached.

## Applications and services

| Application/service | Purpose | Current framework/runtime | Build tool | Routing | Authentication |
| --- | --- | --- | --- | --- | --- |
| `@faako/bynana-portfolio` | Public portfolio, resume, projects, and blog | Astro 7 static output with React 19 islands | Astro/Vite, then Sharp image optimization | Astro file routes emit HTML; a site-wide React Router 7 `StaticRouter`/`BrowserRouter` island repeats route resolution | No account auth; contact and trust endpoints use server-side secrets and origin/rate-limit controls |
| `@faako/dev-erp` | Internal multi-organization ERP and operations system | React 19/Vite frontend; Express 5 API; Prisma/PostgreSQL | Vite plus Prisma generate | React Router 7 SPA with lazy routes, boundaries, and role/module guards | JWT access and refresh sessions in HttpOnly cookies, CSRF cookie/header, bcrypt, server-authoritative role/module/org checks; bearer fallback |
| `@faako/faako-api` | Faako onboarding and activity API | Express 5; Prisma/PostgreSQL | No compilation; Prisma generate/migrate for deployment | Express routes | Public/rate-limited intake plus shared-secret bearer-style webhook/demo-access controls; no general user session |
| `@faako/faako-erp` | Publicly accessible ERP demonstration shell | React 18/Vite | Vite | React Router 6 SPA | Demo-access session persisted client-side after an API grant; not production user authentication |
| `@faako/faako-website` | Public Faako marketing, pricing, configuration, signup, and onboarding | Astro static site with bounded React islands (migrated after this audit) | Astro | File-based Astro routes; route-local React compatibility islands | Login/forgot-password remain no-index prototypes and do not establish a durable server session |
| `@faako/reebs-portal` | REEBS authenticated operations/admin portal and its API | React 19/Vite; Express/Netlify-style functions; Prisma/PostgreSQL | Vite plus Prisma scripts | React Router 7 SPA with protected admin routes | User session is an HttpOnly SameSite cookie; manager bearer tokens also exist; browser stores only a sanitized user shell in local/session storage and validates `/api/authSession` |
| `@faako/reebs-website` | Public REEBS commerce, rentals, cart, checkout, and customer access | React 19/Vite | Deterministic tracked sitemap generation, then Vite | React Router 7 SPA | Duplicated REEBS auth context; relies on the portal-owned cookie-session API |
| `@faako/stroane-web` | Stroane public catalogue/commerce plus private admin portal and API | React 19/Vite TypeScript; Express 5; Prisma/PostgreSQL | Vite plus Prisma generate | Runtime-selected storefront and portal React Router 7 trees in one bundle/workspace | Separate customer/admin HttpOnly cookie sessions with bearer compatibility; browser stores non-secret profile/session shells |
| `@faako/system-starter` | Reusable React application starter | React 19/Vite | Vite | React Router 7 shell | None |
| `@faako/ui-workbench` | Shared UI component workbench | React 19/Vite | Vite | React Router 7 shell | None |
| `apps/ttngh` | Intended Thriving Network Ghana public site | No source manifest or active framework; only ignored/generated Astro artifacts remain | None callable | No source routing | None |
| `reebs-analytics` | Read-only REEBS forecasting/analytics service | Python 3.11+, FastAPI, Pydantic, Uvicorn | Docker image/Python packaging | FastAPI routes (`/health`, `/v1/dashboard/insights`) | Optional constant-time bearer secret check |

`apps/ttngh` is not an active workspace: it has no `package.json`, source tree, or Astro configuration. The root `dev:ttngh` filter therefore has no matching package. Its `dist` and local `node_modules` content are build artifacts, not a recoverable scaffold.

## Shared packages

### Active package workspaces

| Package | Purpose | Implementation/build |
| --- | --- | --- |
| `@faako/api-client` | Framework-independent browser/server Fetch transport, errors, cancellation, request IDs, and opt-in domain clients | TypeScript source with Node tests |
| `@faako/api-contracts` | Framework-independent API response, error, pagination, request metadata, and compatibility contracts | JavaScript runtime plus TypeScript declarations and Node tests |
| `@faako/audit` | Audit action/status constants and display helpers | JavaScript source consumed directly; Node tests |
| `@faako/config` | App-system definitions, navigation, project registry, monitoring metadata | JavaScript/TypeScript source consumed directly |
| `@faako/core` | Organization/template configuration helpers | TypeScript/TSX source consumed directly |
| `@faako/email-kit` | Shared email formatting/templates | CommonJS source |
| `@faako/finance` | Currency and financial helpers | JavaScript source; Node tests |
| `@faako/layout` | Layout contracts/helpers | TypeScript source |
| `@faako/logger` | Pino logger factory | JavaScript source |
| `@faako/notifications` | Safe message templates and channel helpers | JavaScript source; Node tests |
| `@faako/offline-sync` | Queue, retry, draft, and sync helpers | JavaScript/React source; Node tests |
| `@faako/org-settings` | Organization defaults and safe settings helpers | JavaScript source; Node tests |
| `@faako/security` | Security profiles, CORS/default policy, and config validation | JavaScript source |
| `@faako/theme` | Shared tokens and ERP/system CSS | TypeScript and CSS source |
| `@faako/types` | Framework-independent business-domain, ERP shell, security, theme, and feedback contracts | TypeScript source with no framework imports |
| `@faako/ui` | Shared ERP shell, primitives, feedback, forms, React table/renderer types, update notice, and GA route tracker | TSX/CSS source |
| `@faako/utils` | Google Analytics, viewport/mobile, and element observers | TypeScript source |
| `@faako/validation` | Framework-independent Zod request schemas, inferred input types, primitives, and issue normalization | JavaScript runtime plus TypeScript declarations and Node tests |

Ten TypeScript or declaration-backed shared packages now expose package-local type-check scripts using the root package baseline. Applications still compile their source directly; shared packages do not emit build artifacts. Mixed-JavaScript packages remain linted but are not represented as fully type-safe.

### Placeholder directories

- `packages/config-eslint`
- `packages/config-typescript`
- `packages/shared-utils`

These directories have no `package.json` and are not workspace packages despite the workspace glob.

## Routing

- Every active frontend uses `react-router-dom`.
- Portfolio: Astro emits 18 static pages and a sitemap, but each page mounts the same React application and resolves the route again. This preserves pre-rendered metadata but retains a large client island and duplicate route ownership.
- Dev ERP: one guarded SPA route tree with lazy page imports, route error boundaries, and module/capability checks.
- Faako ERP and Faako Website: `BrowserRouter` SPA route trees with Cloudflare `_redirects` fallbacks.
- REEBS Portal: a large protected `/admin` route tree; the public website has its own SPA route tree and redirects `/admin` to the portal.
- Stroane: one workspace selects `StorefrontApp`, `PortalApp`, or a combined surface from environment configuration. Each surface owns a React Router route tree.
- Starter and workbench: small client-side route shells.
- All Vite sites depend on `/* /index.html 200` redirects. This is appropriate for authenticated SPAs but prevents route-specific server-rendered HTML on public marketing/storefront sites.

## API access and data fetching

No Axios, TanStack Query, SWR, Apollo, Redux Toolkit Query, or equivalent dependency was found. Native `fetch` is used throughout.

| Area | API approach |
| --- | --- |
| Portfolio | Direct `fetch` for contact submission and trust statistics |
| Dev ERP | Typed `src/api/client.ts` centralizes credentials, CSRF, error parsing, and optional validation, but several frontend/backend modules still fetch directly |
| Faako API | Server-side fetch for activity/onboarding integrations |
| Faako ERP | Direct demo-access request |
| Faako Website | Shared API client for onboarding; contact mail-client hand-off; Astro development proxy configuration |
| REEBS Portal | Extensive direct `fetch` across pages/functions plus small shared internal API helpers |
| REEBS Website | Direct public commerce/rental calls to the portal API |
| Stroane | Stronger app-local API modules for products, orders, customer accounts, and portal resources, all built on native `fetch` |
| Shared packages | `@faako/ui` update notice and `@faako/core` helpers can fetch at runtime |

Files containing `fetch` or Axios-like calls: portfolio 2, Dev ERP 9, Faako API 2, Faako ERP 1, Faako Website 2, REEBS Portal 47, REEBS Website 15, Stroane 18, shared core 1, and shared UI 1. These are file counts, not request counts.

The absence of a shared response envelope, generated client, query cache, and cross-app retry/cancellation policy raises migration risk. The highest-value seam is a small shared HTTP foundation, not a wholesale data-fetching-library adoption.

## Types and domain duplication

`@faako/types` now covers stable framework-independent business-domain and
system contracts, while `@faako/api-contracts` covers transport response
contracts. Most application-specific domain extensions remain local:

- Stroane defines product, customer, order, receipt, accounting, inventory, role, and session interfaces across API, page, context, and portal files.
- `ContactMethod`/`PreferredContactMethod`, checkout field errors, inventory shapes, product shapes, and admin session/role shapes repeat inside Stroane.
- Dev ERP has a typed HTTP client but most domain contracts are JavaScript objects or Prisma-derived assumptions.
- REEBS applications are JavaScript and repeat payload knowledge across the public app, portal, backend functions, SQL, and Prisma.
- Prisma schemas repeat the concepts `Organization`, `User`, `AuditLog`, `Product`, `Order`, `OrderItem`, `Booking`, accounting entries, inventory, and currency/status enums with different names and semantics.
- Faako API and Dev ERP both model organizations/users/status/currency; their
  stable boundary fields now have shared contracts, but neither persistence
  model was migrated.

These models should not be mechanically unified: their ownership and lifecycle
differ. Shared types are limited to explicit API/event boundaries and stable
primitives. Stroane's customer profile API is the first pilot adoption.

## Shared and duplicated UI

`@faako/ui` provides a substantial ERP shell and primitives, and the ERP apps consume portions of it. Adoption is incomplete; app-local sidebars, page headers, tables, feedback, auth forms, cookie banners, and mobile navigation remain.

The clearest duplication is between REEBS Portal and REEBS Website:

- 73 files have the same relative path in both `src` trees.
- 30 of those files are byte-for-byte identical.
- Exact duplicates include cart and currency contexts, contact form, search field, cookie-banner styles, template configuration, analytics, cart utilities, form drafts, offline queue helpers, organization helpers, login styles, and policy styles.
- Other same-path files are near-duplicates, including auth, navbar/footer, portal sidebar, home content, map, login/reset-password, and commerce components.
- `reebs-website` also carries backend/database/admin-oriented dependencies that belong to `reebs-portal`, even though the portal owns its backend.

Other repeated families include cookie consent, Google Analytics setup, app-update notices, login/forgot/reset-password UI, contact forms, legal-page layouts, and app-specific ERP navigation.

## Validation

- Dev ERP uses Zod for backend request schemas and also has multiple custom form validators.
- REEBS Analytics uses Pydantic models and field constraints.
- Portfolio, Faako, REEBS, and Stroane mostly use hand-written validation and normalization.
- Shared `@faako/security` and `@faako/config` expose configuration/registry validators, not request-domain schemas.
- No Yup, Joi, Ajv, Valibot, Superstruct, or class-validator dependency was found.

Duplicate schemas exist conceptually for contact details, authentication credentials, password requirements, customer/order fields, money/currency values, and organization identifiers. The duplication is especially risky where browser and server validation have drifted.

## Styling

- All active frontends use global or component CSS files.
- `@faako/theme` supplies shared ERP/system CSS tokens; `@faako/ui` supplies component and compatibility CSS.
- REEBS Portal, REEBS Website, and Stroane include Tailwind/PostCSS configuration, but much of their UI remains hand-authored CSS rather than utility-first markup.
- Portfolio declares Tailwind 4 but primarily uses component/global CSS.
- Dev ERP includes Bootstrap/React Bootstrap plus custom CSS and shared Faako UI styles.
- Faako Website and Faako ERP use extensive custom CSS and some inline style objects.
- CSS is imported through JavaScript/TSX, not CSS Modules or CSS-in-JS.
- Build output shows very large repeated REEBS route CSS chunks, indicating shared/global CSS is being duplicated into lazy chunks.

## State management

No Redux, Zustand, MobX, Recoil, Jotai, XState, or similar library is installed. State is managed with:

- React context and hooks for authentication, carts, currency, templates, portal state, and inventory workflows.
- `localStorage`/`sessionStorage` for non-secret profile shells, carts, demo access, drafts, and preferences.
- IndexedDB/offline queues through `@faako/offline-sync` and app-local wrappers.
- URL/query parameters through React Router.

This is workable, but large contexts in REEBS and Stroane create broad rerender and ownership boundaries that should be stabilized before framework migration.

## Logging, monitoring, and error handling

- `@faako/logger` wraps Pino and is used by Dev ERP server code.
- Most other backends, functions, scripts, and frontends use `console.log`, `console.warn`, and `console.error`.
- Route error boundaries exist in Dev ERP and error pages exist in public apps.
- Dev ERP contains site-status monitoring, alerting, and health diagnostics.
- REEBS has audit/event logging and the analytics sidecar, but not centralized application error monitoring.
- No Sentry, Datadog, New Relic, Honeycomb, Logtail, or equivalent error-monitoring integration was found.
- Logging is not consistently structured, request-correlated, or redacted outside the Pino path.

## Analytics

- `@faako/utils` implements Google Analytics helpers.
- `@faako/ui` provides `GoogleAnalyticsRouteTracker`.
- Portfolio, Dev ERP, Faako ERP, Faako Website, REEBS Portal, REEBS Website, and Stroane mount route tracking.
- Vite/Astro configurations inject GA bootstrap behavior and use `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, and `VITE_ENABLE_GA_IN_DEV`.
- System Starter and UI Workbench carry the same GA environment contract.
- REEBS Analytics is business/operational analytics, not browser analytics.
- Cloudflare Web Analytics is allowed by several CSPs, but no explicit source integration was found.
- No consent-mode implementation is shared across all analytics-enabled sites.

## Environment variables

Names are documented below; no values are included. `DEV` and `PROD` are Vite/Astro built-ins found in source and are listed for completeness.

### Portfolio

`CONTACT_ALLOWED_ORIGINS`, `CONTACT_FORM_SITE_ORIGIN`, `CONTACT_NOTIFICATION_FROM`, `CONTACT_NOTIFICATION_SUBJECT_PREFIX`, `CONTACT_NOTIFICATION_TO`, `CONTACT_RATE_LIMIT_MAX_REQUESTS`, `CONTACT_RATE_LIMIT_WINDOW_MS`, `DEV`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `PORTFOLIO_AUDIT_URL`, `PROD`, `RESEND_API_KEY`, `TRUST_STATS_ALLOWED_ORIGINS`, `TRUST_STATS_CACHE_CONTROL`, `TRUST_STATS_UPSTREAM_TIMEOUT_MS`, `TRUST_STATS_UPSTREAM_TOKEN`, `TRUST_STATS_UPSTREAM_URL`, `VITE_CONTACT_SUBMIT_ENDPOINT`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_TRUST_STATS_ENDPOINT`.

### Dev ERP

`ACCOUNTING_REMINDER_DAYS_BEFORE_DUE`, `ACCOUNTING_REMINDER_EMAIL_ENABLED`, `ACCOUNTING_REMINDER_EMAIL_HOUR_UTC`, `ACCOUNTING_REMINDER_EMAIL_MINUTE_UTC`, `ACCOUNTING_REMINDER_FROM_EMAIL`, `ACCOUNT_INVITE_FROM_EMAIL`, `ACCOUNT_SETUP_TOKEN_TTL_HOURS`, `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS`, `ALERT_COOLDOWN_MS`, `ALERT_EMAIL_ENABLED`, `ALERT_EMAIL_RECIPIENTS`, `ALERT_FROM_EMAIL`, `ALERT_NOTIFY_DEGRADED`, `ALERT_NOTIFY_OFFLINE`, `ALERT_SMS_ENABLED`, `ALERT_SMS_RECIPIENTS`, `ALLOW_START_WITHOUT_DATABASE`, `API_PORT`, `API_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MS`, `APP_ACTIVITY_WEBHOOK_SECRET`, `APP_BASE_URL`, `APP_ENV`, `ARBEITNOW_PAGE_LIMIT`, `AUTH_COOKIE_MAX_AGE_MS`, `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`, `AUTH_CSRF_COOKIE_NAME`, `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`, `BYNANA_PORTFOLIO_BASE_URL`, `BY_NANA_ORG_NAME`, `BY_NANA_ORG_SLUG`, `CAD_TO_GHS_RATE`, `CORS_ORIGINS`, `CURRENCY_API_KEY`, `CURRENCY_API_KEY_HEADER`, `CURRENCY_API_KEY_QUERY_PARAM`, `CURRENCY_API_TIMEOUT_MS`, `CURRENCY_API_URL`, `CURRENCY_RATE_CACHE_TTL_MS`, `DASHBOARD_VERSE_CACHE_TTL_MS`, `DASHBOARD_WEATHER_CACHE_TTL_MS`, `DATABASE_SSL_MODE`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_PRODUCTION`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_ORG_NAME`, `DEFAULT_ORG_SLUG`, `DEV_API_BASE_URL`, `DEV_ERP_API_BASE_URL`, `DEV_ERP_SKIP_SERVER_START`, `EMAIL_FORCE_TO`, `EMAIL_SENDER_NAME`, `ENFORCE_DATABASE_ISOLATION`, `FAAKO_API_BASE_URL`, `FAAKO_API_URL`, `FAAKO_CHILD_ORG_SLUGS`, `FAAKO_DATABASE_SSL_REJECT_UNAUTHORIZED`, `FAAKO_DATABASE_URL`, `FAAKO_ERP_BASE_URL`, `FAAKO_ORG_NAME`, `FAAKO_ORG_SLUG`, `FAAKO_WEBSITE_BASE_URL`, `GLOBAL_ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_NIGHTLY_SYNC_ENABLED`, `GOOGLE_NIGHTLY_SYNC_HOUR`, `GOOGLE_NIGHTLY_SYNC_MINUTE`, `GOOGLE_REDIRECT_URI`, `GOOGLE_WEATHER_API_KEY`, `GOOGLE_WEATHER_LANGUAGE_CODE`, `GOOGLE_WEATHER_UNITS_SYSTEM`, `GOOGLE_WEBHOOK_URL`, `INVOICE_EMAIL_CLOSING_NAME`, `INVOICE_EMAIL_DELIVERY_LEAD`, `INVOICE_EMAIL_HEADER_TAGLINE`, `INVOICE_EMAIL_INTRO_MESSAGE`, `INVOICE_EMAIL_SENDER_NAME`, `INVOICE_EMAIL_SUPPORT_MESSAGE`, `INVOICE_FROM_EMAIL`, `JOB_RECOMMENDATION_CACHE_TTL_MS`, `JWT_SECRET`, `NODE_ENV`, `OAUTH_TOKEN_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_CURRENCY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PAYSTACK_WEBHOOK_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `PORT`, `PRISMA_TRANSACTION_MAX_WAIT_MS`, `PRISMA_TRANSACTION_TIMEOUT_MS`, `PROD`, `PROPOSAL_PDF_MAX_BYTES`, `PROPOSAL_SHARE_TOKEN_TTL_MS`, `PROPOSAL_UPLOAD_STORAGE_ROOT`, `PUBLIC_BOOKING_RATE_LIMIT_MAX`, `PUBLIC_BOOKING_RATE_LIMIT_WINDOW_MS`, `RAILWAY_WEBHOOK_SECRET`, `RATE_LIMIT_BUCKET_LIMIT`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `REEBS_API_BASE_URL`, `REEBS_BACKEND_BASE_URL`, `REEBS_DATABASE_SSL_REJECT_UNAUTHORIZED`, `REEBS_DATABASE_URL`, `REEBS_ORG_NAME`, `REEBS_ORG_SLUG`, `REEBS_PORTAL_BASE_URL`, `REEBS_WEBSITE_BASE_URL`, `REFRESH_COOKIE_NAME`, `RENT_EMAIL_SENDER_NAME`, `RENT_MONTHLY_EMAIL_DAY_UTC`, `RENT_MONTHLY_EMAIL_ENABLED`, `RENT_MONTHLY_EMAIL_HOUR_UTC`, `RENT_MONTHLY_EMAIL_MINUTE_UTC`, `RENT_MONTHLY_FROM_EMAIL`, `RENT_QUARTERLY_EMAIL_DAY_UTC`, `RENT_QUARTERLY_EMAIL_ENABLED`, `RENT_QUARTERLY_EMAIL_HOUR_UTC`, `RENT_QUARTERLY_EMAIL_MINUTE_UTC`, `RENT_QUARTERLY_FROM_EMAIL`, `RENT_REPLY_TO_EMAIL`, `RESEND_API_KEY`, `SITE_STATUS_CACHE_TTL_MS`, `SITE_STATUS_CONCURRENCY`, `SITE_STATUS_TIMEOUT_MS`, `SITE_STATUS_USER_AGENT`, `SMS_ALLOW_NON_PRODUCTION`, `SMS_NOTIFICATIONS_AVAILABLE`, `STROANE_API_BASE_URL`, `STROANE_BACKEND_BASE_URL`, `STROANE_DATABASE_SSL_REJECT_UNAUTHORIZED`, `STROANE_DATABASE_URL`, `STROANE_ORG_NAME`, `STROANE_ORG_SLUG`, `STROANE_PORTAL_BASE_URL`, `STROANE_WEB_BASE_URL`, `SYSTEM_STARTER_BASE_URL`, `TRELLO_API_BASE_URL`, `TRELLO_API_KEY`, `TRELLO_EMAIL_BOARD_NAME`, `TRELLO_EMAIL_FROM_EMAIL`, `TRELLO_EMAIL_LIST_NAME`, `TRELLO_EMAIL_TO_BOARD_ADDRESS`, `TRELLO_WEBHOOK_BASE_URL`, `TRUST_PROXY_HOPS`, `TRUST_STATS_CACHE_TTL_MS`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `UI_WORKBENCH_BASE_URL`, `VITE_API_BASE`, `VITE_API_PROXY_TARGET`, `VITE_AUTH_CSRF_COOKIE_NAME`, `VITE_CAD_TO_GHS_RATE`, `VITE_DEFAULT_ORG_SLUG`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `WEEKLY_REPORT_DAY`, `WEEKLY_REPORT_DAY_UTC`, `WEEKLY_REPORT_EMAIL_ENABLED`, `WEEKLY_REPORT_EMAIL_RECIPIENTS`, `WEEKLY_REPORT_FROM_EMAIL`, `WEEKLY_REPORT_HOUR`, `WEEKLY_REPORT_HOUR_UTC`, `WEEKLY_REPORT_MINUTE`, `WEEKLY_REPORT_MINUTE_UTC`, `YOUVERSION_API_KEY`, `YOUVERSION_APP_ID`, `YOUVERSION_BEARER_TOKEN`, `YOUVERSION_TIMEOUT_MS`, `YOUVERSION_VERSE_ENDPOINT`.

### Faako API

`ADMIN_EMAIL`, `ALLOWED_ORIGIN`, `ALLOW_PRODUCTION_DATABASE_IN_DEV`, `APP_ACTIVITY_WEBHOOK_SECRET`, `APP_ACTIVITY_WEBHOOK_URL`, `APP_ENV`, `CONTEXT`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_LOCAL`, `DATABASE_URL_PRODUCTION`, `DEV_API_BASE_URL`, `DEV_ERP_ACTIVITY_WEBHOOK_SECRET`, `DEV_ERP_ACTIVITY_WEBHOOK_URL`, `DEV_ERP_API_BASE_URL`, `EMAIL_FORCE_TO`, `EXPOSE_DEBUG_ERRORS`, `FAAKO_ERP_DEMO_ACCESS_SECRET`, `FAAKO_ONBOARDING_ADMIN_EMAIL`, `FAAKO_ONBOARDING_FROM_EMAIL`, `FAAKO_ONBOARDING_FROM_NAME`, `INTAKE_ADMIN_EMAIL`, `NODE_ENV`, `PORT`, `RATE_LIMIT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`.

### Faako ERP

`ADMIN_EMAIL`, `ALLOWED_ORIGIN`, `FAAKO_ERP_DEMO_ACCESS_ALLOWED_ORIGINS`, `FAAKO_ERP_DEMO_ACCESS_SECRET`, `INTAKE_ADMIN_EMAIL`, `PROD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT`, `VITE_FAAKO_ERP_DEMO_ACCESS_MODE`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`.

### Faako Website

`ADMIN_EMAIL`, `ALLOWED_ORIGIN`, `ALLOW_PRODUCTION_DATABASE_IN_DEV`, `APP_ENV`, `CONTEXT`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_LOCAL`, `DATABASE_URL_PRODUCTION`, `EMAIL_FORCE_TO`, `EXPOSE_DEBUG_ERRORS`, `FAAKO_API_PROXY_TARGET`, `FAAKO_ONBOARDING_ADMIN_EMAIL`, `FAAKO_ONBOARDING_FROM_EMAIL`, `FAAKO_ONBOARDING_FROM_NAME`, `INTAKE_ADMIN_EMAIL`, `NODE_ENV`, `PROD`, `RATE_LIMIT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `VITE_API_BASE_URL`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_ERP_DEMO_URL`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_KPI_BASE_URL`.

### REEBS Portal

`ALLOWED_CHECKOUT_ORG_IDS`, `ALLOWED_ORIGINS`, `APP_ACTIVITY_WEBHOOK_SECRET`, `APP_ACTIVITY_WEBHOOK_URL`, `APP_BASE_URL`, `APP_ENV`, `APP_URL`, `ATTENDANT_RATE_CENTS`, `BREVO_API_KEY`, `CF_PAGES_URL`, `CORS_ORIGINS`, `DATABASE_SSL_MODE`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_PRODUCTION`, `DEBUG`, `DEFAULT_ADMIN_EMAIL`, `DEPLOY_PRIME_URL`, `DEV`, `DEV_API_BASE_URL`, `DEV_ERP_ACTIVITY_WEBHOOK_SECRET`, `DEV_ERP_ACTIVITY_WEBHOOK_URL`, `DEV_ERP_API_BASE_URL`, `DOTENV_CONFIG_DEBUG`, `DOTENV_KEY`, `EMAIL_CATCHALL_TO`, `EMAIL_FORCE_TO`, `EMAIL_FROM`, `EMAIL_NOTIFICATIONS_ENABLED`, `EMAIL_PAYMENT_BANK_DETAILS`, `EMAIL_PAYMENT_MOMO_ACCOUNT_NAME`, `EMAIL_PAYMENT_MOMO_AIRTELTIGO_NUMBER`, `EMAIL_PAYMENT_MOMO_DETAILS`, `EMAIL_PAYMENT_MOMO_GMONEY_NUMBER`, `EMAIL_PAYMENT_MOMO_MTN_NUMBER`, `EMAIL_PAYMENT_MOMO_TELECEL_NUMBER`, `EMAIL_REPLY_TO`, `ENFORCE_DATABASE_ISOLATION`, `GOOGLE_API_KEY`, `GOOGLE_GEOCODING_API_KEY`, `GOOGLE_MAPS_API_KEY`, `IMPORT_RESET`, `MANAGER_APP_ORIGIN`, `MANAGER_APP_SECRET`, `MANAGER_ORGANIZATION_ID`, `MANAGER_PIN_HASH`, `NODE_ENV`, `NO_COLOR`, `OPENAI_API_KEY`, `ORG_ID`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `PORT`, `PROD`, `RAILWAY_WEBHOOK_SECRET`, `REEBS_ANALYTICS_SERVICE_SECRET`, `REEBS_ANALYTICS_SERVICE_URL`, `REEBS_API_BODY_LIMIT`, `REEBS_API_CONCURRENCY_LIMIT`, `REEBS_API_PORT`, `REEBS_API_READ_RETRY_DELAY_MS`, `REEBS_API_READ_RETRY_LIMIT`, `REEBS_ATTENDANT_FEE_CENTS`, `REEBS_ATTENDANT_RATE_CENTS`, `REEBS_PORTAL_URL`, `REEBS_PUBLIC_ORGANIZATION_ID`, `REEBS_WEBSITE_URL`, `SITE_URL`, `STAGING_DATABASE_URL`, `SYSTEM_ADMIN_EMAIL`, `TEST_ENV`, `TRUST_PROXY_HOPS`, `URL`, `USER_APP_SECRET`, `USER_SESSION_COOKIE_DOMAIN`, `USER_SESSION_COOKIE_NAME`, `VITE_API_BASE_URL`, `VITE_BACKEND_BASE_URL`, `VITE_CURRENCY_API_KEY`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_EXCHANGE_API_KEY`, `VITE_FUNCTIONS_VIA_PROXY`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_GOOGLE_MAPS_KEY`, `VITE_REEBS_WEBSITE_URL`, `WATER_MOMO_WEBHOOK_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_MANAGER_PHONE`, `WHATSAPP_PHONE_NUMBER_ID`.

The generated Prisma client also refers to internal `PRISMA_*` variables; those are dependency implementation details rather than application configuration and are intentionally excluded.

### REEBS Website

`APP_ENV`, `BACKEND_BASE_URL`, `DATABASE_SSL_MODE`, `DATABASE_URL_DEVELOPMENT`, `DEV`, `EMAIL_FORCE_TO`, `EMAIL_PAYMENT_MOMO_ACCOUNT_NAME`, `EMAIL_PAYMENT_MOMO_AIRTELTIGO_NUMBER`, `EMAIL_PAYMENT_MOMO_GMONEY_NUMBER`, `EMAIL_PAYMENT_MOMO_MTN_NUMBER`, `EMAIL_PAYMENT_MOMO_TELECEL_NUMBER`, `ENFORCE_DATABASE_ISOLATION`, `NODE_ENV`, `PROD`, `REEBS_API_BASE_URL`, `VITE_API_BASE_URL`, `VITE_BACKEND_BASE_URL`, `VITE_CURRENCY_API_KEY`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_EXCHANGE_API_KEY`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_GOOGLE_MAPS_KEY`, `VITE_REEBS_PORTAL_URL`.

### Stroane

`ALLOWED_ORIGIN`, `APP_ACTIVITY_WEBHOOK_SECRET`, `APP_ACTIVITY_WEBHOOK_URL`, `APP_ALERT_COOLDOWN_MINUTES`, `APP_ALERT_CRON_SECRET`, `APP_ALERT_EMAILS`, `APP_ALERT_FROM`, `APP_ALERT_REPLY_TO`, `APP_ALERT_WHATSAPP_NUMBERS`, `APP_API_BASE_URL`, `APP_AUTH_SECRET`, `APP_BACKEND_BASE_URL`, `APP_ENV`, `APP_WEB_BASE_URL`, `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`, `CF_PAGES`, `CORS_ORIGINS`, `CUSTOMER_ACCOUNT_EMAIL_FROM`, `CUSTOMER_ACCOUNT_EMAIL_REPLY_TO`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DATABASE_URL`, `DATABASE_URL_DEVELOPMENT`, `DATABASE_URL_PRODUCTION`, `DEV_API_BASE_URL`, `DEV_ERP_ACTIVITY_WEBHOOK_SECRET`, `DEV_ERP_ACTIVITY_WEBHOOK_URL`, `DEV_ERP_API_BASE_URL`, `EMAIL_FORCE_TO`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY`, `INQUIRY_NOTIFICATION_EMAIL`, `JWT_SECRET`, `NODE_ENV`, `ORDER_NOTIFICATION_FROM`, `ORDER_NOTIFICATION_REPLY_TO`, `PAYSTACK_ALLOW_LIVE`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_CURRENCY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `PORT`, `PROD`, `PUBLIC_STOREFRONT_URL`, `RECEIPT_EMAIL_FROM`, `RECEIPT_EMAIL_REPLY_TO`, `REFRESH_TOKEN_SECRET`, `RESEND_API_KEY`, `SESSION_COOKIE_SAME_SITE`, `SESSION_COOKIE_SECURE`, `STOREFRONT_BASE_URL`, `STROANE_ADMIN_AUTH_COOKIE_DOMAIN`, `STROANE_ADMIN_AUTH_COOKIE_NAME`, `STROANE_ADMIN_AUTH_COOKIE_SAME_SITE`, `STROANE_ADMIN_AUTH_COOKIE_SECURE`, `STROANE_ALERT_COOLDOWN_MINUTES`, `STROANE_ALERT_CRON_SECRET`, `STROANE_ALERT_EMAILS`, `STROANE_ALERT_FROM`, `STROANE_ALERT_REPLY_TO`, `STROANE_ALERT_WHATSAPP_NUMBERS`, `STROANE_API_BASE_URL`, `STROANE_AUTH_SECRET`, `STROANE_CATALOGUE_ARCHIVE_STALE`, `STROANE_CATALOGUE_SEED_DRY_RUN`, `STROANE_CUSTOMER_AUTH_COOKIE_DOMAIN`, `STROANE_CUSTOMER_AUTH_COOKIE_NAME`, `STROANE_CUSTOMER_AUTH_COOKIE_SAME_SITE`, `STROANE_CUSTOMER_AUTH_COOKIE_SECURE`, `STROANE_GOOGLE_AUTOCOMPLETE_FIELD_MASK`, `STROANE_GOOGLE_MAPS_API_KEY`, `STROANE_GOOGLE_PLACES_AUTOCOMPLETE_URL`, `STROANE_GOOGLE_PLACE_DETAILS_FIELD_MASK`, `STROANE_GOOGLE_PLACE_DETAILS_URL`, `STROANE_INVENTORY_BOOTSTRAP_APPLY`, `STROANE_LOCATION_COUNTRY_CODES`, `STROANE_LOCATION_REGION_CODE`, `STROANE_LOCATION_SEARCH_ENABLED`, `STROANE_LOCATION_SEARCH_PROVIDER`, `STROANE_LOCATION_SEARCH_URL`, `STROANE_LOCATION_SEARCH_USER_AGENT`, `STROANE_STOREFRONT_BASE_URL`, `TRUST_PROXY_HOPS`, `VITE_ADMIN_PORTAL_URL`, `VITE_API_BASE_URL`, `VITE_APP_ENV`, `VITE_APP_SURFACE`, `VITE_BACKEND_BASE_URL`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_PORTAL_BASE_URL`, `VITE_PUBLIC_WEBSITE_URL`, `VITE_STOREFRONT_BASE_URL`.

### Starter, workbench, TTNGH, and analytics

- System Starter: `PROD`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`.
- UI Workbench: `PROD`, `VITE_ENABLE_APP_UPDATE_NOTICE`, `VITE_ENABLE_GA_IN_DEV`, `VITE_GA_ID`, `VITE_GA_MEASUREMENT_ID`.
- TTNGH: no active source environment contract.
- REEBS Analytics: `REEBS_ANALYTICS_SERVICE_SECRET`.
- Root deployment selector: `RAILWAY_WORKSPACE`, `RAILWAY_PACKAGE`, `FAAKO_RAILWAY_WORKSPACE`, `RAILWAY_BUILD_SCRIPT`, `RAILWAY_START_SCRIPT`.

Tracked environment files are examples only (`.env.example` in the active Vite/Express apps). No populated `.env` file is tracked.

## Deployment configuration

- Root `nixpacks.toml` installs pnpm 10.33.0 and delegates Railway build/start selection to `scripts/railway-service.mjs`.
- Railway selection is environment-driven and defaults to Dev ERP if no workspace selector is provided.
- Static apps use `public/_headers` and `public/_redirects` for Cloudflare Pages security headers and SPA fallback.
- Portfolio uses Astro static output, CSP headers, robots metadata, and an Astro sitemap; it intentionally does not need an SPA fallback.
- REEBS Website generates its sitemap from a committed, sorted route snapshot. Live inventory refresh is explicit and outside the ordinary build.
- REEBS Analytics has a Dockerfile and `.dockerignore`.
- Prisma deployment/migration scripts exist in Dev ERP, Faako API, REEBS Portal, and Stroane.
- `.github/workflows/monorepo-ci.yml` checks only Stroane/shared changes. It runs Prisma generation/validation, lint, backend tests, and separate storefront/portal builds.
- No app-specific `wrangler.toml`, `wrangler.json`, `railway.json`, `vercel.json`, or active Netlify configuration was found.
- The repository includes a custom `hosting:check` for Cloudflare/Railway readiness and legacy Netlify detection.

## Testing and checks

### Libraries and test assets

- Node built-in test runner: portfolio, Dev ERP, Faako API, REEBS Portal, Stroane, and six shared packages.
- Playwright: Dev ERP, REEBS Portal, REEBS Website, and Stroane configurations/dependencies.
- Jest and Testing Library dependencies/setup: REEBS Portal and REEBS Website.
- `axe-playwright`: REEBS Portal and REEBS Website.
- Pytest/httpx: REEBS Analytics optional development dependencies.
- Test file counts found: portfolio 2, Dev ERP 48, Faako API 1, Faako ERP 2, REEBS Portal 14, Stroane 15, REEBS Analytics 1, and nine shared packages with one test file each.
- No test files were found in Faako Website, REEBS Website, System Starter, UI Workbench, or TTNGH, despite REEBS Website carrying test dependencies and Playwright scripts.

### Quality-gate repair results

| Command | Result |
| --- | --- |
| `CI=true pnpm install --frozen-lockfile --ignore-scripts` | Passed against the updated lockfile. An offline-only attempt could not complete because the local pnpm store did not contain the `react-helmet@6.1.0` tarball. |
| `pnpm lint` | Passed in all 28 active workspaces. Existing React hooks and fast-refresh warnings remain non-fatal and documented. |
| `pnpm typecheck` | Passed in all 13 applicable Astro/TypeScript/declaration workspaces. |
| `pnpm test` | Passed in all 15 test-bearing workspaces with normal loopback permission. In the managed sandbox only, four Dev ERP HTTP assertions fail to bind `127.0.0.1`; the assertions are unchanged. |
| Dev ERP onboarding targeted regression | Passed 7/7, including conversion response and audit metadata for the resolved project. |
| `pnpm build` | Passed in all 10 build-capable workspaces. Vite environment-file and portfolio chunk-size warnings remain; the former REEBS live-sitemap warning is resolved. |
| `pnpm check` | Passed end to end with ordinary loopback permission. |
| `pnpm test:python` | Could not start because the available system Python reports `No module named pytest`; isolated setup is documented. |
| `pnpm run hosting:check` | Passed the repository's Cloudflare/Railway and legacy-hosting checks. |
| `pnpm run monitoring:check` and `pnpm run project-registry:check` | Passed. Both register all 11 app directories, including the artifact-only TTNGH directory; they do not verify that each directory has a runnable workspace manifest. |
| `git diff --check` | Passed before documentation changes. |

The root Node test gate now includes Faako API, REEBS Portal, Stroane, Dev ERP, Portfolio, and all test-bearing shared packages. Browser tests and the Python service are explicit separate commands.

## Migration blockers and risks

1. TTNGH is an artifact-only directory while root scripts imply an active workspace.
2. REEBS analytics cannot run locally until its isolated Python dev dependencies are installed.
3. Several JavaScript applications and packages have no type-checkable contract or tests.
4. REEBS public and portal code are heavily duplicated, and the website depends operationally on the portal API.
5. Stroane combines public storefront, authenticated portal, and API/database responsibilities in one workspace and one environment-selected Vite build.
6. Faako Website combines public SEO pages with signup/configuration/dashboard/auth-like UI, so a direct “convert everything to Astro” migration would cross trust and routing boundaries.
7. Public Vite SPAs rely on client routing and generic `index.html`, limiting SEO/AEO and route-specific metadata.
8. Domain/API types are app-local or implicit; response contract drift would be hard to detect during migration.
9. Hand-written validation is duplicated between browser and server.
10. Environment naming still has aliases and legacy variants, although current build-time inputs are now hashed by Turbo.
11. Dev ERP and Stroane builds generate Prisma clients outside `dist/**`, so their build tasks remain intentionally uncached.
12. Authentication differs materially across apps; copying routes between frameworks could weaken cookie, CSRF, origin, and role boundaries.
13. No centralized error monitoring exists to compare pre/post-migration behavior.
14. React 18/19, React Router 6/7, Vite 5/6, and package manifest version ranges are inconsistent with the resolved lockfile versions.
15. Shared packages compile from source; TypeScript packages now have independent type checks, but JavaScript package boundaries remain less strongly checked.

## Recommended pull request order

1. Quality-gate truthfulness: completed locally; wire the root Node gates and isolated Python suite into CI.
2. Environment/build determinism: completed locally for Turbo hashing, outputs, package dependency invalidation, and REEBS sitemap generation; remove remaining Vite `NODE_ENV` misuse and validate deployment selectors in a focused follow-up.
3. API contract foundation: define stable request/response/error contracts for Faako onboarding, REEBS public commerce, and Stroane commerce without changing frameworks.
4. REEBS ownership cleanup: move genuinely shared public components/utilities into a narrowly scoped shared package and remove backend-only dependencies from the public website.
5. Public-site regression baselines: add route HTML/SEO/AEO/accessibility/performance and critical-form tests for Faako Website and REEBS Website.
6. Faako Website Astro migration: migrate public marketing/legal/case-study pages first; retain interactive onboarding/configuration as React islands or a separately bounded SPA.
7. REEBS Website Astro migration: migrate public/static shells and content routes, then commerce/rental islands after API contracts and sitemap behavior are stable.
8. Stroane boundary decision: separate deployment/build ownership of storefront and portal before considering a storefront-only Astro migration.
9. TTNGH scaffold: recreate an auditable Astro workspace only after the shared public-site conventions are proven.

## Recommended first implementation task

Wire the repaired root quality gates and `sitemap:check` into repository-wide CI, using the documented deterministic build contract and keeping browser/database jobs isolated. This gives later contract and framework work a trustworthy merge boundary.
