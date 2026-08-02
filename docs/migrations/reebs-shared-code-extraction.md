# REEBS shared-code extraction

Status: implemented on 2026-07-26 from the Task 8 duplication and boundary
findings. Both REEBS applications remain React/Vite.

## Outcome

The extraction reduced the REEBS same-path source baseline from 73 matching
paths and 30 exact matches to 31 matching paths and 10 exact matches.

| Measure | Before | After | Change |
| --- | ---: | ---: | ---: |
| Portal source files | 191 | 160 | -31 |
| Website source files | 104 | 87 | -17 |
| Matching relative source paths | 73 | 31 | -42 |
| Byte-for-byte identical matching paths | 30 | 10 | -20 |

No complete page, router-specific component, portal auth state, admin workflow,
or Astro route was extracted.

## Extraction principles

- Prefer an existing package with the correct responsibility.
- Move only framework-independent or clearly reusable behavior.
- Keep authoritative commerce, authentication, and permission decisions on the
  API/backend.
- Keep public presentation and policy content in REEBS Website.
- Keep admin navigation, offline operations, and role-aware workflows in REEBS
  Portal.
- Delete wrong-app copies only when import scans and both production builds
  show that the copy is not required.
- Preserve public payloads, endpoint paths, storage keys, environment-variable
  names, and user-visible validation requirements.

No new catch-all REEBS package was created. Existing packages were sufficient.

## Group 1: shared contracts, currency, formatting, and validation

### Product and category contracts

`@faako/types` already owns framework-independent `Product`, `Category`,
`Money`, `CurrencyCode`, and related domain contracts. No duplicate REEBS type
package or ORM-derived type was added.

The current REEBS applications are JavaScript and still accept legacy API field
aliases. Forcing those payloads into a new runtime shape would have changed
contracts, so type adoption remains an API-boundary follow-up rather than a
page rewrite.

### Currency constants and formatting

Added to `@faako/finance`:

- `SUPPORTED_CURRENCY_CODES`
- `DEFAULT_CURRENCY_RATES`

Both values are frozen. The two REEBS cart contexts and their remaining
currency display code now use:

- shared currency codes and fallback rates from `@faako/finance`;
- `formatCurrencyMajor` from `@faako/finance`.

The existing `SUPPORTED_CURRENCIES` and `FALLBACK_RATES` consumer behavior was
preserved during the transition and then the duplicate CurrencyContext files
were removed in Group 2.

### Shared validation

The active Website ContactForm now uses `emailSchema` and `phoneSchema` from
`@faako/validation`.

REEBS-specific rules remain local:

- name quality and 80-character limit;
- email 120-character UI limit;
- phone 25-character UI limit;
- required topic and event date;
- message minimum and 1,500-character limit;
- Website-specific error copy and honeypot behavior.

This preserves the form's accepted input contract while removing duplicate
email/phone regex ownership.

### Group 1 checkpoint

- `@faako/finance` tests: 5 passed.
- REEBS Portal production build: passed.
- REEBS Website production build and deterministic 24-URL sitemap: passed.

## Group 2: exact helpers and redundant package facades

### Expiring drafts

The identical `src/utils/formDrafts.js` files were replaced by
`@faako/utils` exports:

- `FORM_DRAFT_TTL_MS`
- `loadExpiringDraft`
- `saveExpiringDraft`
- `clearExpiringDraft`

The shared implementation preserves the five-minute default TTL and storage
shape. It additionally accepts injected storage and time providers, making the
logic testable without coupling it to a React component.

Website booking, checkout, home, contact, and footer consumers now import the
shared utility. The active Portal footer does the same.

### Organisation and template configuration

The two identical organisation files were only re-export facades over
`@faako/core`. Both applications now import organisation/session helpers
directly from `@faako/core`, and both facades were deleted.

The two identical TemplateConfig context files were also re-export facades over
`@faako/core`. Portal's editor and both application providers now use
`@faako/core` directly, and both facades were deleted.

This did not merge auth contexts. Portal auth state and route guards remain
Portal-owned; Website customer session behavior remains Website-owned.

### Duplicate CurrencyContext

Neither application mounted `CurrencyProvider`; active consumers used only its
constants while CartContext separately owned the live display preference and
rate cache. After moving the constants and formatter to `@faako/finance`, both
duplicate CurrencyContext files were removed.

### Package import boundaries

REEBS entry points and SEO helpers no longer import shared-package source by
relative filesystem path. They use the public `@faako/core` and `@faako/utils`
exports.

### Group 2 checkpoint

- `@faako/utils` type-check: passed.
- Removed-path reference scan: passed.
- REEBS Portal production build: passed.
- REEBS Website production build and deterministic sitemap: passed.

## Group 3: application ownership cleanup

### Removed from Portal

Public-site copies with no Portal entry/import ownership were removed:

- AddToCartButton;
- ContactForm;
- CookieBanner;
- LegalDocumentPage;
- Map;
- PopupModal;
- SideNav;
- public home-section components and content/catalogue data;
- ShopImageAsset;
- policy stylesheet;
- public cart-item adapter;
- public SEO helper.

Portal keeps:

- its complete route tree;
- Navbar/Footer behavior still required by unauthenticated routes;
- PortalSidebar, AdminBottomNav, role colours, expense categories, quick-action
  data, and admin styles;
- Store Mode and all admin workflows;
- admin offline queues.

### Removed from Website

Portal/admin copies with no Website entry/import ownership were removed:

- AdminBottomNav;
- AdminBreadcrumb;
- PortalSidebar;
- expense categories;
- admin stylesheet;
- admin quick-action data;
- admin offline queue;
- role colours;
- the Portal-to-Website URL helper.

Website keeps:

- public pages and policy content;
- public navigation and footer;
- public cart/checkout/booking behavior;
- contact form;
- SEO and sitemap behavior;
- the Website-to-Portal URL helper.

### Removed from both

Three dead component families were removed after confirming no owning imports:

- AdminQuickActions component and stylesheet;
- InstagramFeed component;
- root `utils/enhancements.js`.

Portal's active `utils/adminQuickActions.js` remains because AdminSettings and
AdminWorkspace consume it.

### Group 3 checkpoint

- REEBS Website production build: passed.
- REEBS Portal production build: passed.

## Group 4: remove backend/database ownership from Website

Removed Website scripts:

- seven `db:*` Prisma commands;
- `rehash:passwords`, which referenced a missing script.

Removed Website backend/database runtime dependencies:

- `@prisma/adapter-pg`
- `@prisma/client`
- `cors`
- `csv-parse`
- `express`
- `fs`
- `nodemailer`
- `openai`
- `pg`
- `psql`
- `railway`

Removed Website server-oriented development dependencies:

- `dotenv`
- `dotenv-cli`
- `prisma`

The unused Website copy of the Node `crypto` password utility was deleted and
the ESLint Node-file override was narrowed to `vite.config.js`.

`dev:with-backend` remains as local orchestration. It invokes the
Portal-owned database predeploy and backend; it does not give Website database
or server ownership.

### Group 4 checkpoint

- workspace install and lockfile update: passed;
- forbidden Website backend/database source and manifest scan: passed;
- REEBS Website production build: passed;
- REEBS Portal production build: passed.

A clean offline reinstall is not currently portable because the local pnpm
store does not contain the `react-helmet@6.1.0` tarball. The normal workspace
install completed without changing the resolved lockfile. This is a local
package-store limitation, not a source or lockfile failure.

## Deliberately not extracted

The following matching files remain local:

- `App.jsx`, `main.jsx`, Login, ResetPassword, and each route tree;
- both AuthContext implementations;
- CartContext and CartOverlay;
- Navbar, Footer, and SiteLoader;
- global/public application styles;
- cart, inventory filtering, inventory caching, and media-background rules;
- the REEBS analytics wrapper;
- small visual components pending screenshot-backed UI extraction.

Reasons:

- Portal and Website route/auth responsibilities differ.
- cart and rental rules still disagree about price overrides, variants,
  availability, and quantity limits;
- several components read application environment or storage directly;
- extracting complete shell components would create router coupling;
- visual components require responsive and accessibility regression coverage;
- analytics configuration still reads Vite environment values and REEBS
  consent storage.

Policy constants were not extracted because the policy content is Website-only.
The duplicated Portal policy stylesheet was deleted instead. Policy content is
not a business-neutral shared contract.

## Current remaining duplication

The post-extraction matching source paths are 31, of which 10 are exact.

The exact matches are:

- BackToTop;
- CartContext;
- Icon;
- PartyConfetti;
- SearchField component and stylesheet;
- `index.css`;
- Login stylesheet;
- `setupTests.js`;
- REEBS analytics adapter.

Exact does not automatically mean safe to share. CartContext and analytics
remain configuration-coupled. SearchField already has a different shared UI
implementation, so replacement needs an API and visual comparison rather than
copying the REEBS component into `@faako/ui`.

## Next safe tasks

1. Add automated restricted-import and forbidden-dependency checks from
   `reebs-boundaries.md`.
2. Add tests for `@faako/utils` expiring drafts with injected storage/time.
3. Define a compatible REEBS product/category API adapter using
   `@faako/types`.
4. Reconcile cart-line, variant, rental availability, and pricing semantics
   before extracting cart logic.
5. Capture Website and Portal responsive screenshots before replacing local
   UI primitives.
6. Pilot `@faako/api-client` on one public read endpoint.
7. Reassess Astro only after these boundaries and behavior baselines are
   stable.

## Non-goals preserved

- No Astro migration.
- No complete page extraction.
- No router extraction.
- No portal auth-state extraction.
- No admin-workflow extraction.
- No endpoint or API response migration.
- No public checkout, booking, payment, or inventory authority moved into a
  browser package.

## Final verification

- REEBS Portal unit tests: 82 passed, 0 failed.
- `@faako/finance` tests: 5 passed, 0 failed.
- `@faako/validation` tests: 10 passed, 0 failed.
- `@faako/utils` type-check: passed.
- REEBS Portal lint: passed with pre-existing warnings only.
- REEBS Website lint: passed with pre-existing warnings only.
- Both production builds: passed after every extraction group.
- REEBS Website sitemap check: passed with 24 URLs.
- Git whitespace validation: passed.
