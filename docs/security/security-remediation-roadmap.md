# Security remediation roadmap

## P0 — completed in this phase

- Removed unused REEBS packages that introduced critical dependency chains.
- Upgraded jsPDF, `concurrently`, PostCSS, React Router SPA dependencies, Nodemailer, and narrow vulnerable transitive packages; verified zero critical advisories.
- Changed REEBS Analytics service authentication from fail-open to fail-closed.
- Moved manager-login rate limiting before PIN verification.
- Added persistent throttling before REEBS password-reset lookup/token creation.
- Removed query strings/fragments from analytics page-view payloads.
- Expanded CI from Stroane-only checks to affected Turbo gates, Python tests, security/registry checks, public browser smoke tests, and Dev ERP browser regressions.

## P1 — next release train

1. Redesign REEBS first-time personal-email setup so public reset responses never reveal account state. Use an administrator-issued, expiring setup challenge; preserve existing users during rollout.
2. Add session versions or a revocation store so password change, user disablement, and material role changes invalidate active sessions consistently.
3. Upgrade Astro/sharp together after verifying image output, build performance, and deployment binaries. Do not force `sharp@0.35` outside Astro's supported range.
4. Complete a write-route CSRF matrix for every cookie-authenticated backend and add focused negative tests.
5. Verify production database tenant policies and RLS in a staging database using two organisations; repository helper tests are not a substitute for deployment verification.

## P2 — platform hardening

- Move high-risk Express rate limits to a shared store before horizontal scaling.
- Disable REEBS Analytics docs/OpenAPI in production and configure trusted hosts/private networking.
- Replace remaining direct backend console logs with `@faako/logger` and central redaction.
- Add file-upload quarantine/scanning before expanding upload features.
- Split development and production CSP/connect-source policies; remove localhost allowances from production.
- Add webhook replay windows/idempotency tests for each external provider.
- Approve an error-monitoring provider only after privacy, source-map, release, ownership, and retention decisions.

## Release gates

- No critical dependency advisories.
- New high findings require a documented applicability decision and owner before release.
- Permission/tenant changes require representative denied and allowed route tests.
- Authentication changes require login, logout, expiry, invalidation, and protected-route tests.
- Payment/webhook changes require signature, replay/idempotency, and redaction tests.
