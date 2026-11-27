# TWE software release versioning

Mandatory before the initial production cutover. This is a separate gate from content approval, publication and database readiness.

## Version contract

The web, portal and API package manifests share one product SemVer. Until the first candidate is explicitly selected, retain 0.0.0 (Pre-release in the portal). Use 1.0.0-rc.1, 1.0.0-rc.2, etc. for approved staging candidates; promote to 1.0.0 for the first production release. Subsequent patches fix bugs, minors add compatible features, and majors cover breaking changes. Changes to CMS content or images alone do not bump software versions.

A release preparation PR updates all three manifests in one commit and records the intended changes in release notes. The foundation test rejects divergent or unsupported versions. Review any workspace lockfile differences with the existing frozen-lockfile CI. Do not create separate infrastructure variables for version or Git identity.

## Deployment evidence

- Portal: version is embedded from its own manifest and displayed in the authenticated navigation, including the mobile menu. Existing asset-based update checks and the safe 02:00 UTC refresh remain unchanged. A same-version rebuild can still require a refresh.
- API: GET /api/public/release adds version alongside the existing environment and exact Railway source SHA. Worker coordination still requires SHA and environment parity, not merely version equality.
- Public site: /twe-version.json identifies the website build version. Verify it together with the existing /twe-publication.json (job ID, source SHA, digest) and verified Pages deployment. The holding page is not a released website. A content-only publication can retain the same software version while its publication marker changes.
- Track component versions and source identities actually deployed; do not assume that all components redeployed because a shared product release was registered. Keep the API and publication worker aligned on source as required by the publication contract.

## Release procedure

1. Prepare candidate PR and notes; confirm CI and staging acceptance on the exact source. Do not label staging as production.
2. Approve final synchronized version and source in a release PR. Run the established migration, backup, worker and publication gates. Reverify the final versioned build before cutover.
3. Promote only after explicit production authorization. Use existing Railway and Cloudflare publication processes. Record component deployment IDs, timestamps, source SHAs, public artifact marker and health evidence.
4. After verified production deployment and acceptance, register the immutable product-specific Git tag twe-v1.0.0 on the approved release commit and create its GitHub Release with reviewed notes. Never tag a failed or unverified deployment as released, move an existing release tag, or create a duplicate tag. Subsequent tags follow the same pattern.
5. Retain the previous verified artifact and source references. If rollback is necessary, verify the restored component identities and public marker. Database recovery remains a separate authorized operation; do not reset or downgrade shared databases blindly. Do not reuse a version for changed code.

## Remaining implementation gates

Automated release notes and tag registration, release history in authenticated System/Account views and the Faako System Health integration require follow-up implementation and CI/hosted verification. Registration automation must be explicitly production-approved and fail closed on missing deployment evidence. No production deployment or Git tag is authorized by this preparation change.
