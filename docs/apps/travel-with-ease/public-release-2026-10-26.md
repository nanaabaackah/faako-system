# Approved initial public release — 26 October 2026

The user approved existing website copy and selected photography for public use
in this conversation. Inspection found substantive homepage copy, but other
sections still contain editorial placeholders rather than business information.
The initial snapshot therefore publishes only the homepage introduction and
approved Kenya image. It does not invent services, contact details, package prices,
testimonials or legal policies. Unpublished routes retain their URLs and noindex
unavailable states; navigation omits them. This is not the completed multi-page MVP.
Hosted analytics remains disabled until a privacy page is published, including
for visitors who previously saved analytics consent.

Hosted builds without an explicit `TWE_CONTENT_SNAPSHOT` use the checked-in
`apps/travel-with-ease-web/content/approved-public-release.json`. An explicit
CMS snapshot always takes precedence, including null/unpublished pages; an invalid
or missing explicit file fails rather than reverting to the bundled release.
Local builds without a snapshot retain the separate design preview. The build
command stays `pnpm --filter @faako/travel-with-ease-web run build`.

Production still requires the approved canonical `PUBLIC_SITE_URL` and explicit
`PUBLIC_SITE_INDEXABLE` opt-in. Staging remains noindex. This implementation does
not complete hosted CMS publication workers or verify Railway configuration.
Rollback is a reviewed code revision; never substitute a dummy snapshot or set
the production environment to development to bypass checks.

## PostgreSQL runtime compatibility

At the user's request, hosted readiness no longer requires exactly PostgreSQL 17.
It reads and reports the actual major version. Database environment/tenant identity,
non-superuser/non-BYPASSRLS role, organisation and exact migration checksums remain
mandatory. PostgreSQL 17 remains the existing CI fixture, not a runtime pin.
Synthetic readiness tests cover reported versions 16, 17 and 18; this is not a
claim that full application integration has been tested on every server version.
Apply and validate migrations on the chosen server before promotion.

The latest supplied log only contains the generic preflight failure message;
it does not establish that version is the failing condition. Startup messages now
include the safe failure category without driver errors or credentials.
