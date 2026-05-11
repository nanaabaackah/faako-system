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

## In-progress modules/features

- Product browsing and purchasing flow refinement.
- Backend hosting, CORS, reverse proxy, and production API configuration.
- Client deployment readiness and operational polish.

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
