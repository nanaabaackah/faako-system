# Stroane Web Implementation Notes

## Purpose

Capture technical notes, open questions, cleanup targets, and risks for Stroane Web without changing application behavior.

## Known technical notes

- The app uses a React and TypeScript frontend, Express backend, and Prisma-managed PostgreSQL database.
- Netlify is recommended for the frontend while the backend may run separately.
- Hostinger can remain the DNS host while the domain points to Netlify.
- `VITE_BACKEND_BASE_URL` controls whether the frontend calls an external backend origin.
- `TRUST_PROXY_HOPS` should match trusted reverse proxy topology when rate limiting relies on client IPs.
- `docs/platform/codebase-cleanup-audit.md` flags Stroane cleanup opportunities around repeated card/button/header/page styles, API fetch wrapper duplication, and component extraction candidates such as Shop, Product/User Management, and header surfaces.

## Open questions

- What is the final production backend host and ownership model?
- Which purchasing or payment features are in scope for the initial client release?
- What client-facing acceptance checklist should block production deploys?

## Future cleanup

- Document production hosting and DNS once finalized.
- Add client-specific release notes once the deployment cadence is established.
- Keep API, CORS, and proxy configuration notes current as hosting changes.
- Use the platform cleanup audit before consolidating client-facing CSS, extracting shared UI pieces, or adding an app API client wrapper. Keep environment examples descriptive and never copy live secret values into docs.

## Risks to monitor

- Frontend/backend URL mismatches after deploy.
- CORS or trusted proxy misconfiguration affecting customers.
- Product, order, customer, or payment-adjacent data regressions.
- Public polish regressions that affect first paying client confidence.
- Exposed or misplaced environment values can affect production safety; rotate exposed credentials outside cleanup work and keep `.env` files out of documentation examples.
