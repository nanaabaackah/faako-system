# Stroane Web Progress Log

## Purpose

Track meaningful changes to Stroane Web, the first paying client project in the Faako monorepo.

## Current app status

Client-sensitive commerce app. Changes should account for product browsing, purchasing flows, backend API behavior, database integrity, deployment, and client confidence.

## Reusable change entry template

Date:
Feature/change name:
What changed:
Why it changed:
Files changed:
Data impact:
Security impact:
Testing done:
Rollback notes:
Next step:

## Entries

### Documentation foundation added

Date: 2026-05-10
Feature/change name: Documentation foundation added
What changed: Added the standard app documentation set for progress tracking, system status, deploy readiness, and implementation notes.
Why it changed: Establish a consistent documentation baseline for Stroane Web as part of the Faako monorepo platform.
Files changed: docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/pre-deploy-checklist.md, docs/apps/stroane-web/implementation-notes.md
Data impact: None. Documentation-only change.
Security impact: None. No auth, permission, secret, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added Stroane Web documentation files if this documentation foundation needs to be reverted.
Next step: Keep this log updated for client-facing commerce changes, backend changes, deployments, and data-impacting work.

### Public-site redesign sweep and missing-page build-out

Date: 2026-05-14
Feature/change name: Public-site redesign sweep and missing-page build-out
What changed:
- Added a sitewide scroll-to-top button via the shared Layout so every page picks it up.
- Redesigned the Services page: sticky-scroll storytelling for the services list (each service gets an accent colour, icon, watermark number, and image background), and a tab-stepper for the How It Works steps.
- Redesigned the Shop page: hero brought in line with About/Services pattern; product cards reduced to category + name + price + availability with a 1px border; replaced the "Add to quote" button with quantity controls (+/qty/+, plus bin icon to remove).
- Added a Product Detail page with a split layout (sticky image gallery on the left; details, large quantity controls, features, specs, and related products on the right).
- Extracted shared modules to make the catalogue and basket cross-page: `src/data/products.ts` (products + helpers), `src/context/CartContext.tsx` (persistent cart state), and `src/components/QuantityControls.tsx` (reusable add/qty/trash widget). `CartProvider` wraps the app in `main.tsx`.
- Redesigned the Resources page: featured guide + list layout for guides, simple accordion (single-open) for FAQs. Hero, standards, and CTA untouched.
- Built the five footer-linked pages that didn't exist yet: Contact (image hero + mailto form + direct channels), Terms, Privacy, Cookies (all three using a new shared `LegalLayout` with breadcrumb, "on this page" TOC, numbered sections, and footer link to Contact), and Sitemap (auto-generated from `products` + `categoryOptions`, organised into Company / Store / Products / Legal groups).
- Redesigned the ErrorPage as a split layout — oversized rotated/outlined status digits on the left, eyebrow + heading + message + primary/ghost CTAs + helpful-link grid on the right.
- Header fix: pages without an image hero now get the dark/solid header variant from page load using a `HERO_ROUTES` allowlist in `Header.tsx`. Added a `page-header--static` modifier that suppresses the `slideDown` entry animation on those pages. Also fixed the hamburger menu button leaking onto desktop — it now hides at `min-width: 901px` while the inline nav is shown.
- Routes added in `App.tsx`: `/contact`, `/terms`, `/privacy`, `/cookies`, `/sitemap`.

Why it changed: First paying-client polish pass. The pre-existing storefront pages were card- and text-heavy and weren't visually consistent; the policy/contact/sitemap pages were referenced from the footer but didn't exist (broken links); the header text was invisible on no-hero pages once those were added.
Files changed:
- apps/stroane-web/src/App.tsx
- apps/stroane-web/src/main.tsx
- apps/stroane-web/src/components/Layout.tsx
- apps/stroane-web/src/components/Header.tsx
- apps/stroane-web/src/components/ScrollToTop.tsx (new)
- apps/stroane-web/src/components/QuantityControls.tsx (new)
- apps/stroane-web/src/components/LegalLayout.tsx (new)
- apps/stroane-web/src/context/CartContext.tsx (new)
- apps/stroane-web/src/data/products.ts (new)
- apps/stroane-web/src/pages/Services.tsx
- apps/stroane-web/src/pages/Shop.tsx
- apps/stroane-web/src/pages/ProductDetail.tsx
- apps/stroane-web/src/pages/Resources.tsx
- apps/stroane-web/src/pages/ErrorPage.tsx
- apps/stroane-web/src/pages/Contact.tsx (new)
- apps/stroane-web/src/pages/Terms.tsx (new)
- apps/stroane-web/src/pages/Privacy.tsx (new)
- apps/stroane-web/src/pages/Cookies.tsx (new)
- apps/stroane-web/src/pages/Sitemap.tsx (new)
- apps/stroane-web/src/styles/components/ScrollToTop.css (new)
- apps/stroane-web/src/styles/components/QuantityControls.css (new)
- apps/stroane-web/src/styles/components/LegalLayout.css (new)
- apps/stroane-web/src/styles/components/Header.css
- apps/stroane-web/src/styles/pages/Services.css
- apps/stroane-web/src/styles/pages/Shop.css
- apps/stroane-web/src/styles/pages/ProductDetail.css
- apps/stroane-web/src/styles/pages/Resources.css
- apps/stroane-web/src/styles/pages/ErrorPage.css
- apps/stroane-web/src/styles/pages/Contact.css (new)
- apps/stroane-web/src/styles/pages/Sitemap.css (new)

Data impact: None. Catalogue source-of-truth moved from inline arrays in `Shop.tsx` to `src/data/products.ts` with no schema or product changes. Cart state lives in client memory only (`CartContext`) — no persistence, no backend writes.
Security impact: None. No auth, permission, secrets, or backend endpoints touched. The Contact form submits via a pre-filled `mailto:` to `info@stroanesolutions.com` (no server-side handler added).
Testing done: Visual checks across pages on desktop and mobile breakpoints. Sticky-scroll storytelling and tab-stepper interactions verified for keyboard and pointer use. Cart state verified to persist across navigation between Shop and Product Detail. Header variant verified on hero pages (transparent → solid on scroll) and no-hero pages (solid from load, no entry animation). Hamburger menu confirmed hidden on desktop.
Rollback notes: Revert the commit. All work is additive or contained — restoring the previous Shop/Services/Resources/ErrorPage files and removing the new pages, components, contexts, and shared data module, plus the five new App routes and the `CartProvider` wrapper in `main.tsx`, returns to the pre-redesign state.
Next step: Drop in real `service_7.png` and `service_8.png` images for the last two services (currently reuse 1 and 2). Decide whether to back the Contact form with a real submission endpoint instead of `mailto:`. Consider persisting `CartContext` to `localStorage` so the basket survives reloads once the client confirms desired behavior.

### Auth gate and admin user-management removed

Date: 2026-05-14
Feature/change name: Auth gate and admin user-management removed
What changed: Removed the preview-access login gate, the `AuthContext`/`AuthProvider`/`AuthGate` components, the `/users` admin route, the `UserManagement` page, and the Netlify `/api/*` proxy that was pointing at a non-existent Railway backend service. Stripped `useAuth` calls and the conditional admin "Users" link from both `Header` and `FloatingHeader`. Public site is now open — anyone can browse without credentials.
Why it changed: No Express backend is deployed (only the Railway Postgres database), so the gate could never authenticate users. The client wants the site publicly accessible; admin user-management was only needed to manage gate credentials and has no remaining purpose.
Files changed:
- apps/stroane-web/src/main.tsx (drop AuthProvider/AuthGate wrappers)
- apps/stroane-web/src/App.tsx (drop UserManagement import and /users route)
- apps/stroane-web/src/components/Header.tsx (drop useAuth and admin link)
- apps/stroane-web/src/components/FloatingHeader.tsx (drop useAuth and three admin link blocks)
- apps/stroane-web/netlify.toml (drop /api/* proxy)
- Deleted: apps/stroane-web/src/context/AuthContext.tsx
- Deleted: apps/stroane-web/src/components/AuthGate.tsx
- Deleted: apps/stroane-web/src/styles/components/AuthGate.css
- Deleted: apps/stroane-web/src/pages/UserManagement.tsx
- Deleted: apps/stroane-web/src/styles/pages/UserManagement.css
- Deleted: apps/stroane-web/railway.json (no backend service to deploy)
Data impact: Stroane preview-access seeds in `apps/stroane-web/prisma/seeds/users.csv` are now orphaned (no consumer). They can remain in the repo for reference or be removed in a follow-up. No production data changes.
Security impact: The site is now publicly accessible — no credential gate. Acceptable: the public content is marketing/store-catalogue only, the Contact form submits via `mailto:`, and there is no client-side state worth protecting. The Express backend code in `backend/` and the `/api/auth/*` routes remain in the repo but are not deployed and not reachable from production.
Testing done: Verified no remaining `useAuth`/`AuthGate`/`AuthProvider`/`UserManagement` references via grep. Header and FloatingHeader render without the admin link.
Rollback notes: `git revert` restores the gate, the admin page, and the proxy. The deleted files come back via git history. If the gate is re-introduced later, an actual backend deployment is needed first or login will fail the same way it did before.
Next step: Decide whether to delete the unused backend (`backend/`, `prisma/`, auth routes, seeds) entirely, or keep it for a possible future admin area. Update `pre-deploy-checklist.md` and the Stroane README to reflect the public-site posture.
