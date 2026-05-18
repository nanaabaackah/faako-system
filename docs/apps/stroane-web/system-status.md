# Stroane Web System Status

## App purpose

Stroane Web is a full-stack commerce app for the first paying client project. It pairs a React and TypeScript frontend with an Express backend and Prisma-managed PostgreSQL database for product browsing and purchasing flows.

## Current status

Client-sensitive active project. Treat public frontend, purchasing, backend API, database, deployment, and DNS/CORS changes as high visibility.

## Stable modules/features

- React storefront structure, pages, components, API client, and types.
- Express backend route and middleware structure.
- Prisma schema and migration workflow.
- Netlify frontend deployment pattern.
- Public marketing pages: Home, About, Services, Resources, Contact, Shop, Product Detail.
- Footer-linked policy pages: Terms, Privacy, Cookies, Sitemap (all rendering through the shared `LegalLayout` component where applicable).
- Error page with 404 / 500 variants and shared helpful-link grid.
- Sitewide scroll-to-top button (mounted in `Layout`).
- Shared catalogue source-of-truth in `src/data/products.ts` and reusable basket state via `CartContext` (wrapped in `main.tsx`).
- Reusable `QuantityControls` component (add → +/qty/+/trash) shared between Shop cards and Product Detail.
- Route-aware header: hero routes stay transparent until scrolled; non-hero routes get the solid variant from load and skip the entry animation. Hamburger menu now correctly hidden on desktop.
- Public-site posture (2026-05-14 onward): no auth gate, no `/users` admin page. The site is open to anyone.

## Removed / decommissioned

- Preview-access auth gate (`AuthContext`, `AuthProvider`, `AuthGate`).
- Admin user-management page (`/users`, `UserManagement.tsx`).
- Netlify `/api/*` proxy entry (no backend deployed; only Railway Postgres exists).
- Backend Express server (`backend/`) is still in the repo but not deployed and not referenced from any public flow.

## In-progress modules/features

- Product browsing and purchasing flow refinement.
- Client deployment readiness and operational polish.
- Final guide / service hero imagery — placeholders reuse existing images for services 7 and 8 and for the featured guide.
- Contact form delivery — currently submits via `mailto:`; if a real endpoint is wanted later, a backend (or Netlify Function) needs to be deployed.
- Cart persistence — `CartContext` is in-memory only; persistence to `localStorage` is a candidate future step.
- Front-end-only sign-in/sign-up and checkout pages have been added and pass core checks, but are not server-enforced account or payment flows yet.
- Decision on whether to delete the now-unused `backend/`, `prisma/`, and auth routes, or retain them for a possible future admin area.

## Experimental modules/features

- Any new purchasing, checkout, inventory, payment, or account features until validated with the client.
- New integrations or backend hosting changes until proven in a production-like environment.
- Client-side auth and Paystack checkout helpers until backend session validation, payment verification, and webhook handling exist.

## High-risk areas

- Purchasing, checkout, order capture, payment-adjacent, and customer-facing flows.
- Front-end-only account/session state in localStorage; it must not protect sensitive workflows without backend validation.
- Client-side Paystack callback flow; it must not be treated as verified settlement without backend verification.
- Database migrations and production product/order/customer data.
- API authentication, rate limiting, CORS, and trusted proxy configuration.
- DNS, Netlify, backend hosting, and environment-variable configuration.

## Production sensitivity

High for client-facing changes. Stroane is the first paying client project, so regressions can affect client trust, public customer experience, and transaction readiness.

## Before-every-deploy questions

- Does this change affect the client-visible storefront, product data, purchasing flow, or API behavior?
- Does this change require a migration or production data update?
- Are CORS origins, backend URLs, DNS, and proxy settings correct for the target environment?
- Are secrets kept out of `VITE_*` values?
- Has the affected flow been checked on the deployed frontend/backend pairing?
- Is the rollback plan clear for both frontend and backend changes?
- Are checkout/auth changes clearly marked preview-only unless backend validation is active?
