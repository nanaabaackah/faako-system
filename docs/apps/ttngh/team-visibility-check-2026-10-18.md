# Team visibility check — 18 October 2026

The current CMS-connected local site renders zero leadership profiles at both
mobile and desktop widths. The founder is separate repository content. This is
an empty published CMS collection, not a mobile CSS rule hiding profile text.

The user confirmed Sanity remains the source of truth. No automatic repository
fallback, CMS writes, publication, or environment changes were made. TeamGrid
now displays an explanatory empty state and contact link instead of a blank grid.

Checked current CMS-empty and isolated repository-populated builds at 320, 390,
768 and 1440px: no horizontal overflow; all eight repository names and roles
are visible in the populated test. Build and four editorial regression tests pass.
The populated build is local-only under `/private/tmp/ttngh-team-layout-check`.

To populate the real site, create/review Team Member documents in Sanity with
name, role, approved biography, photo and alt text, and approved publication
consent. Set the document publication state to published and publish the Sanity
document itself (drafts are excluded). Public links require separate approval.
Then rebuild the website; locally restart the server to clear its CMS cache.
Do not invent biographies to satisfy validation. No hosted CMS records were
modified or independently inspected for draft content during this check.
