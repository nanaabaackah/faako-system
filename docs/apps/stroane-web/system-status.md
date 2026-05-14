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

## In-progress modules/features

- Product browsing and purchasing flow refinement.
- Backend hosting, CORS, reverse proxy, and production API configuration.
- Client deployment readiness and operational polish.
- Final guide / service hero imagery — placeholders reuse existing images for services 7 and 8 and for the featured guide.
- Contact form delivery — currently submits via `mailto:`; backend handler decision pending.
- Cart persistence — `CartContext` is in-memory only; persistence to `localStorage` is a candidate future step.

## Experimental modules/features

- Any new purchasing, checkout, inventory, payment, or account features until validated with the client.
- New integrations or backend hosting changes until proven in a production-like environment.

## High-risk areas

- Purchasing, checkout, order capture, payment-adjacent, and customer-facing flows.
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
