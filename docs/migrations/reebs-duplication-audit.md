# REEBS duplication audit

Status: baseline audit completed on 2026-07-26 before extraction. The
subsequent implementation is documented in
`docs/migrations/reebs-shared-code-extraction.md`; the 73/30 figures below are
the pre-extraction baseline.

## Scope and method

This audit compares:

- `apps/reebs-portal/src`
- `apps/reebs-website/src`
- both application manifests, scripts, root utilities, and build
  configuration
- existing shared packages that could own stable cross-application behavior

Generated output, dependencies, environment files, and `.DS_Store` files were
excluded from the source comparison.

The original baseline is reproducible:

| Measure | Result |
| --- | ---: |
| Portal source files | 191 |
| Website source files | 104 |
| Matching relative paths | 73 |
| Byte-for-byte identical matches | 30 |
| Matching files used by both entry graphs | 32 |
| Matching files used only by Portal | 10 |
| Matching files used only by Website | 23 |
| Matching files not reached by either entry graph | 8 |

The reachability figures are supporting evidence, not a substitute for runtime
tests. They are based on static and dynamic literal imports from each
`src/main.jsx`. CSS `@import` relationships and test-only configuration were
reviewed separately.

## Classification rules

- **Shared package candidate**: stable behavior is used by both applications
  and can be made configurable without importing an application.
- **Portal-only**: authenticated operations, administration, or portal
  navigation belongs to REEBS Portal. Any Website copy should eventually be
  removed.
- **Website-only**: public content, discovery, contact, policy, or storefront
  presentation belongs to REEBS Website. Any Portal copy should eventually be
  removed.
- **Temporary duplication**: both applications currently need related
  behavior, but their routes or domain rules have diverged enough that an
  immediate extraction is unsafe.
- **Dead code**: no current application entry or source import owns the file.
  Deletion still requires build and route verification.
- **Backend concern incorrectly present in public app**: database, secret,
  password, email, server, or deployment tooling is present in REEBS Website
  even though REEBS Portal/API owns that responsibility.

Every one of the 73 matching `src` paths has one primary classification below.

| Primary classification | Matching paths | Exact matches |
| --- | ---: | ---: |
| Shared package candidate | 11 | 11 |
| Portal-only | 11 | 3 |
| Website-only | 24 | 11 |
| Temporary duplication | 24 | 3 |
| Dead code | 3 | 2 |
| **Total** | **73** | **30** |

Backend concerns found outside the two `src` trees are documented separately
and are not added to the 73-path total.

## Findings by duplicated area

| Area | Classification | Evidence | Intended ownership |
| --- | --- | --- | --- |
| Authentication contexts and pages | Temporary duplication | Both apps use auth, login, and reset-password paths, but Portal has role/access enforcement while Website has customer login and redirects `/login` and `/admin/*` to Portal. The contexts have already drifted. | Share session payloads, request contracts, and sanitisation only. Keep portal guards in Portal and public customer-session presentation in Website. |
| Organisation helper | Shared package candidate | Both local `utils/organization.js` files are identical re-export facades over `@faako/core`. Both are active. | `@faako/core` currently owns the implementation. Later consumers should import it directly or use an API-client organisation adapter. |
| Cart and currency state | Shared package candidate, with temporary domain-rule duplication | `CartContext.jsx` and `CurrencyContext.jsx` are exact and active in both apps. `utils/cart.js`, inventory filtering, caching, and media helpers have drifted. | A REEBS commerce package may own framework-independent cart/currency rules after pricing, stock, and rental semantics are reconciled. React providers may then wrap those rules. |
| Public navigation and shell | Temporary duplication | Navbar, Footer, CartOverlay, SiteLoader, and related CSS are active in both but differ. Portal still renders a public-style shell around unauthenticated routes. | Website owns public navigation. Portal owns its authenticated shell. Extract only small neutral UI primitives until login/reset route ownership is settled. |
| Portal navigation | Portal-only | AdminBottomNav, AdminBreadcrumb, PortalSidebar, admin quick-action data, role colours, and expense categories have no public-site responsibility. Website copies are unused. | REEBS Portal. Shared ERP primitives may live in `@faako/ui`, but navigation registry and permissions remain Portal-owned. |
| Analytics and consent adapter | Shared package candidate | `utils/analytics.js` is exact and active in both, on top of generic `@faako/utils` Google Analytics functions. | A configurable REEBS analytics/consent adapter; no direct `import.meta.env` in framework-independent code. |
| Contact form | Website-only | The exact ContactForm copy is used by Website and not Portal. Submission goes to the Portal-owned `/api/contact` endpoint. | Form presentation and drafts in Website; validation, rate limiting, persistence, CRM follow-up, and email in the API. |
| Offline queue | Portal-only | The identical `utils/offlineQueue.js` uses the key `reebs_admin_offline_queue_v1`. Portal AdminWorkspace and Settings consume it; Website does not. | Portal, with reusable storage/status primitives from `@faako/offline-sync`. Public checkout must not adopt the admin mutation queue implicitly. |
| Policies and legal layout | Website-only | Website policy routes consume LegalDocumentPage, `styles/Policy.css`, and public styles. The Portal Policy stylesheet is not consumed. | Website content. Policy text should remain content-owned and versioned rather than becoming generic UI package copy. |
| Template configuration | Shared package candidate | Both local context files are exact re-export facades over the existing `@faako/core` TemplateConfig implementation. | `@faako/core` already owns the implementation. Portal edits configuration; Website reads published configuration. The API remains authoritative. |
| Public home/content components | Website-only | Home sections and content/catalog files are reachable only from Website. Portal copies are legacy public-site residue. | Website. These become Astro components or React islands only in a later migration. |
| Root and application composition | Temporary duplication | `App.jsx` and `main.jsx` share ancestry but now represent different route trees. The one-line `index.css` and test setup remain identical. | Keep separate app entries. Share configuration factories or primitives, not application roots. |
| Password/database/server tooling in Website | Backend concern incorrectly present in public app | See the manifest and root-utility audit below. | Portal/API only. |

## Complete 73-path ownership inventory

Paths below are relative to each application's `src` directory.

### Shared package candidates — 11

All 11 are currently byte-for-byte identical:

- `components/BackToTop/BackToTop.jsx`
- `components/CartContext/CartContext.jsx`
- `components/CurrencyContext/CurrencyContext.jsx`
- `components/Icon/Icon.jsx`
- `components/PartyConfetti/PartyConfetti.jsx`
- `components/SearchField/SearchField.css`
- `components/SearchField/SearchField.jsx`
- `context/TemplateConfigContext.jsx`
- `utils/analytics.js`
- `utils/formDrafts.js`
- `utils/organization.js`

This label does not mean all 11 belong in one package. The intended destinations
are:

- `@faako/core`: organisation and template-configuration implementations
  already live here; remove only the local facades in a later tested change.
- `@faako/ui`: neutral visual components such as BackToTop, Icon, SearchField,
  and PartyConfetti, after accessibility and styling baselines.
- `@faako/utils` or a small REEBS-specific adapter: consent preference parsing
  around the existing generic analytics helpers.
- a future REEBS commerce package: cart/currency state and draft helpers only
  after their configuration and persistence contracts are explicit.

### Portal-only — 11

- `components/AdminBottomNav/AdminBottomNav.css`
- `components/AdminBottomNav/AdminBottomNav.jsx`
- `components/AdminBreadcrumb/AdminBreadcrumb.jsx`
- `components/PortalSidebar/PortalSidebar.css`
- `components/PortalSidebar/PortalSidebar.jsx`
- `data/expenseCategories.js`
- `styles/admin.css`
- `utils/adminQuickActions.js`
- `utils/offlineQueue.js`
- `utils/roleColors.js`
- `utils/website.js`

The corresponding Website files are copied portal residue. `utils/website.js`
is Portal-owned because it builds outbound links to the public site; Website
uses its separate `utils/portal.js` for the inverse direction.

### Website-only — 24

- `components/AddToCartButton/AddToCartButton.css`
- `components/AddToCartButton/AddToCartButton.jsx`
- `components/ContactForm/ContactForm.jsx`
- `components/CookieBanner/CookieBanner.css`
- `components/CookieBanner/CookieBanner.jsx`
- `components/LegalDocumentPage/LegalDocumentPage.jsx`
- `components/Map/Map.jsx`
- `components/PopupModal/PopupModal.css`
- `components/PopupModal/PopupModal.jsx`
- `components/SideNav/SideNav.jsx`
- `components/home/HomeFeaturedRentalsSection.jsx`
- `components/home/HomeHeroSection.jsx`
- `components/home/HomeMomentsSection.jsx`
- `components/home/HomeProcessSection.jsx`
- `components/home/HomeQuickAnswersSection.jsx`
- `components/home/HomeServicesSection.jsx`
- `components/home/HomeShopHighlightsSection.jsx`
- `components/home/HomeWhySection.jsx`
- `components/home/homeCatalog.js`
- `components/home/homeContent.js`
- `components/shop/ShopImageAsset.jsx`
- `styles/Policy.css`
- `utils/cartItems.js`
- `utils/seo.js`

The Portal copies should not be used as the source for a future Astro
migration. Website remains the source of truth for public behavior until that
migration is explicitly started.

### Temporary duplication — 24

- `App.jsx`
- `components/AuthContext/AuthContext.jsx`
- `components/CartOverlay/CartOverlay.css`
- `components/CartOverlay/CartOverlay.jsx`
- `components/Footer/Footer.css`
- `components/Footer/Footer.jsx`
- `components/Navbar/Navbar.css`
- `components/Navbar/Navbar.jsx`
- `components/SiteLoader/SiteLoader.jsx`
- `hooks/useScrollReveal.js`
- `icons/iconSet.js`
- `index.css`
- `main.jsx`
- `pages/Login/Login.css`
- `pages/Login/Login.jsx`
- `pages/ResetPassword/ResetPassword.css`
- `pages/ResetPassword/ResetPassword.jsx`
- `setupTests.js`
- `styles/global.css`
- `styles/public.css`
- `utils/cart.js`
- `utils/frontendInventoryFilters.js`
- `utils/inventoryCache.js`
- `utils/itemMediaBackgrounds.js`

These files should be compared behaviorally before extraction. Important drift
already exists in rental bookability, price overrides, cart keys, stock limits,
authentication initialisation, navigation targets, and portal styling.

### Dead code — 3

- `components/AdminQuickActions/AdminQuickActions.css`
- `components/AdminQuickActions/AdminQuickActions.jsx`
- `components/InstagramFeed/InstagramFeed.jsx`

No current source import reaches these components in either application.
`utils/adminQuickActions.js` is separate and remains active in Portal. Removal
must be a dedicated cleanup change with both REEBS builds and route checks.

## Backend concerns incorrectly present in REEBS Website

The public application declares 34 runtime dependencies, and every one is also
declared by REEBS Portal. A source/script import scan finds only 10 used by the
Website. The following are clear backend or operational dependencies with no
Website import:

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

The Website also carries Prisma and server-oriented development tooling. Its
manifest defines seven `db:*` commands despite having no `prisma/` directory,
Prisma configuration, schema, migrations, or generated client. Its
`rehash:passwords` command points to a missing
`scripts/rehashPasswords.js`.

`apps/reebs-website/utils/passwords.js` is an exact copy of the Portal's Node
`crypto` password implementation. It is unused by Website, while the Portal
backend uses its copy for login, resets, manager PINs, users, staff profiles,
and import scripts. This file is a backend concern incorrectly present in the
public app.

The `dev:with-backend` command is different: it is local orchestration that
starts the Portal-owned backend. It does not transfer backend ownership to the
Website, though a root-level REEBS development command would express the
boundary more clearly.

## Additional duplication outside `src`

The 73-path baseline intentionally covers only `src`, but the following exact
root/configuration copies were also found:

- `.gitignore`
- `postcss.config.js`
- `tailwind.config.js`
- `vite.config.js`
- `utils/enhancements.js`
- `utils/passwords.js`

`utils/enhancements.js` has no current references and is a dead-code candidate.
`utils/passwords.js` belongs exclusively to the Portal backend. The identical
Vite/PostCSS/Tailwind configuration is temporary duplication: a shared config
factory may be useful, but Portal and Website build behavior must remain
independently configurable.

## Risks and constraints

- Exact copies can still be the wrong abstraction. ContactForm is exact but
  Website-only; the admin offline queue is exact but Portal-only.
- `CartContext` and `CurrencyContext` read Vite environment variables directly.
  They are not framework-independent in their current form.
- Both cart and currency layers fetch exchange rates and use different
  environment-variable names, storage keys, and fallback paths. Extraction
  should first define one rate/configuration contract.
- `patchOrganizationFetch` globally wraps native fetch. Replacing local
  organisation facades should be coordinated with `@faako/api-client`, not
  performed as a search-and-replace.
- Portal and Website cart rules already disagree about price overrides, variant
  keys, rental availability, and quantity limits.
- Portal still renders Navbar, Footer, cart, and public styles around some
  unauthenticated routes. Public-shell deletion requires login and
  reset-password route verification.
- Public checkout, booking, availability, and payment behavior must retain
  server-side validation. Shared browser code must never become authoritative.

## Recommended cleanup order

1. Add import-boundary lint rules and dependency assertions without moving
   files.
2. Remove Website backend dependencies, invalid database/password scripts, and
   the copied password utility in a dedicated PR.
3. Remove proven Website copies of Portal-only navigation and offline code,
   with both app builds and route tests.
4. Remove proven Portal copies of Website-only public components, with Portal
   login/reset and Store Mode regression checks.
5. Replace the exact local `@faako/core` re-export facades with direct imports.
6. Extract small neutral UI and analytics/draft helpers.
7. Define and test one REEBS cart, currency, pricing, rental, and availability
   contract before extracting commerce state.
8. Reassess the public-site Astro migration only after these boundaries are
   enforced.

## Non-goals

- No Astro migration.
- No application rename, move, or deletion.
- No dependency removal during this audit.
- No authentication, checkout, booking, or API behavior change.
- No assumption that matching filenames should remain matching.
