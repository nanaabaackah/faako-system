# TWE accessible visual release — 2026-10-28

## Scope

Branch: feat/twe-accessible-visual-release, based on origin/develop 6eaef1dbe.
Existing production baseline: e1ef20e28. Preserve this known deployment reference
for rollback; verify provider deployment identity before selecting a rollback.

Includes the pending TWE portal/website design, local demo, shared opt-in feedback
and Iconsax changes plus FAQ disclosure styling. Unrelated TTNGH/Dev ERP edits,
new unreviewed mockup assets, credentials and generated artifacts are excluded.
No schema migrations or authentication-provider replacements are introduced.

## FAQ disclosures

Native details/summary uses navy text, a trailing Iconsax Add indicator, dividers,
visible focus and at least 44px targets. Each question opens independently, works
without JavaScript and respects reduced motion. Published FAQ entries opt in;
ordinary content, form selects and navigation are not converted to accordions.

Hosted content retains the current approved publication snapshot and unpublished
navigation filtering. The bundled snapshot currently approves the homepage only.
Full sample offers and enquiry interactions remain local-only. Neutral footprint
maps do not imply verified activity totals. A future approved snapshot can publish
FAQs without another UI change.

## Verification

- TWE lint, type checks and builds passed.
- API unit/HTTP tests: 48 passed (local test ports require sandbox permission).
- Portal tests: 5 passed. Website tests: 15 passed, including production builds.
- Shared UI lint/typecheck and 8 tests passed.
- Monitoring and workspace manifests passed. Project registry reports the existing
  unrelated REEBS Water metadata warning.
- Browser regression and GitHub CI results are recorded in the release PR.
- Isolated PostgreSQL integration must pass in GitHub CI; no local Docker is
  available. No hosted database was used for destructive tests.

## Hosted gates (not completion claims)

Staging website responds over HTTPS; staging portal redirects signed-out traffic
to Cloudflare Access; staging API /readyz reports ready.
The intended production API hostname api.travelwitheasegh.com fails TLS hostname
validation. Do not bypass certificate checks. Correct its custom-domain/DNS
configuration and verify again before production promotion.

Authenticated staging sign-in/session persistence, permission checks, enquiry
detail and reversible draft verification require an authorised browser session.
Do not call these passed based on an unauthenticated redirect or local demo.
Confirm provider branch mapping and deployed SHAs before accepting staging.
Promote develop to main only after those gates and required CI pass.

If a release fails, stop promotion and use the preceding verified provider
deployment; no database reset is part of rollback.
