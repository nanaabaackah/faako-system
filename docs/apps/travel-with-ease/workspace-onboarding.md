# TWE account activation and guided workspace onboarding

Date: 2026-10-29. Scope: the supplied activation brief (Phases 1–10) and Phase 11.
Branch: `feat/twe-workspace-onboarding`. No automatic merge or hosted configuration changes.

## Journey and trust boundaries

Google and MFA remain managed by the existing Cloudflare Access policy. The API
verifies the signed Access assertion against the configured issuer and application
audience, then checks a separately provisioned application identity. No email
header, tutorial state or frontend role can grant access.

Unprovisioned verified users see an activation screen, not a fabricated staff
session. They enter a privately delivered invitation code, review the workspace
and assigned role, explicitly confirm activation, and enter the workspace. The
existing Access-bound session exchange is unchanged. The welcome guide appears
for a new progress record. Skip persists a paused state; completion persists a
completed state. Returning users are not required to complete a tutorial.

Existing active staff continue using their existing sessions and receive the new
optional introduction once. Disabled staff cannot reactivate themselves with an
invitation. Missing Access verification still fails closed.

## One-time initial Owner setup

The inspected permission matrix has no initial-Owner issuance permission. An
existing Platform Admin role therefore does **not** automatically acquire it.

1. Faako independently verifies the installer's stable Access subject using the
   approved issuer and environment-specific audience. Record approval in the
   operational ticket; do not infer identity from an email header.
2. An authorised operator sets `TWE_SETUP_OPERATOR_SUBJECT` in that environment.
   No client needs SQL or shell access. Leaving it empty disables installer issuance.
3. The installer signs in through Access. With no Owner record present, the
   activation screen (or dashboard for an already provisioned installer) offers
   initial Owner invitation issuance. Enter the independently verified recipient
   subject and approval reference.
4. Deliver the newly displayed code over an approved private channel. It expires
   after one hour. The UI can revoke that invitation. Issuing another for the same
   subject revokes the earlier unclaimed invitation. Existing accepted codes are
   never retrievable.
5. The recipient reviews and claims it. Remove `TWE_SETUP_OPERATOR_SUBJECT` after
   successful setup. Any Owner record, including an inactive one, prevents another
   initial Owner invitation or claim. Recovery requires a separately reviewed process.

The reviewed `bootstrap-access-staff.mjs` fallback remains available to authorised
operators. It uses the same organisation-scoped advisory lock as invitation claim
and issuance, preventing concurrent initial Owner creation through those paths.
No automatic privileged repair, permanent support token or password was added.

## Staff invitations and audit

Owners issue Editors only. Editors cannot issue invitations. Platform Admins
retain their existing staging/revocation permissions, not business ownership.
Editor invitations expire after 24 hours, are bound to organisation, environment,
issuer, audience and subject, and are invalid if their issuing Owner is inactive.
The Owner can review/revoke invitations, manage existing Editors, revoke Editor
sessions and inspect staff-only audit events. Owners cannot revoke Platform Admin
sessions through this business-management path.

Codes contain 256 random bits and only SHA-256 hashes are stored. They are shown
once, never placed in URLs, localStorage or telemetry. Resend/email delivery is not
implicitly enabled: this phase uses approved private manual delivery. Resend enquiry
notifications are separate from invitation-code delivery. Approval references, issuing identity
hashes and immutable audit events provide traceability without recording codes.

Claim and preview requests are limited to ten attempts per verified identity per
15-minute window in PostgreSQL. The limit survives API restarts. Pre-session
mutations require a verified assertion, exact portal Origin and the custom
`X-TWE-Session-Init` header. Authenticated staff changes require the existing session
and CSRF token. Input schemas are strict and do not accept tenant IDs or chosen roles.
Claim, staff creation, onboarding record and acceptance audit commit atomically.
After an uncertain response, use Check account status instead of retrying blindly.

## Tutorial architecture

- `packages/ui/src/GuidedTour.tsx` is an opt-in presentation component. It owns
  highlighting, missing-target fallback, accessible controls and focus restoration.
  It has no API client, authorisation, business transactions or application strings.
- `apps/travel-with-ease-api/src/onboarding/catalogue.js` owns TWE definitions,
  permission filtering and pure progress transitions.
- `TutorialService` rechecks the active staff role in PostgreSQL on every read and
  write. Records use the composite organisation/staff key; client IDs are ignored.
- `TutorialWorkspace.jsx` connects the component to the real module navigation and
  authenticated progress API. Unsaved-change confirmation remains authoritative.
  Cancelling navigation hides the guide until explicitly resumed.
- `AccountSettings.jsx` exposes existing session/account information and session
  revocation, not invented infrastructure or workspace-ownership editing.

There are multiple steps for overview, content, media, enquiries, publishing,
staff and account settings. Publishing and staff tours are unavailable to Editors;
Platform Admins do not inherit business tours. Targets are code-owned `data-tour`
identifiers on actual controls or sections. A missing target never blocks the CMS.
The guide does not open private customer records automatically.

The footer persists across module navigation and offers Tutorial Mode, available
tutorials, resume, restart and explicit completion. Turning mode off pauses the
overlay without erasing completed steps. There is no tutorial localStorage state.
Progress-save errors remain visible; mutations are not automatically retried.

## Configuration and versions

Each definition declares `id`, `module`, `title`, an optional required permission,
and steps `[stepId, targetId, title, description]`. The server adds the catalogue
version and stable qualified step ID (`tour:version:step`). Example:

```js
{
  id: "media",
  module: "media",
  permission: "media.read",
  title: "Media library",
  steps: [["upload", "media-upload", "Upload responsibly", "Use approved assets."]]
}
```

Add the real component target first, then the server definition and permission
tests. Never put credentials, record content or customer names in explanations.
`allowedTutorials` supports a disabled-module list for future feature gating;
currently all implemented TWE modules remain enabled. Storage unavailable states
remain honest and uploads disabled by the existing media implementation.

For a substantive revision increment `tutorialVersion`; add new stable step IDs.
Previously completed versioned IDs are retained. New tours become available in the
list without changing a completed onboarding status or forcing a replay. Restart
starts the current catalogue but retains completion history. Current position is
reconciled against allowed definitions when resuming after removal or role changes.
Module completion is derived from its completed step IDs. `last_completed_version`
records the fully completed catalogue version.

## Reuse in other Faako applications

Import `@faako/ui/GuidedTour` and the opt-in `@faako/ui/guided-tour.css`. Supply a
step, position/total, busy state, and Next/Back/Skip callbacks. The host supplies its
own welcome messages, definitions, allowed modules, completion actions, navigation
and server-backed preferences. Namespace progress by that application's tenant
and staff identity; do not reuse TWE's table or grant TWE roles to another app.
Use CSS custom properties `--tour-accent`, `--tour-background`, `--tour-text` for
brand adaptation. No new packages or unrelated application changes are needed.
DEV ERP adoption must remain optional; it is not enabled by this change.

## Accessibility

The guide is a named, non-modal dialog: no backdrop, inert page or focus trap.
It receives focus on opening and step changes, restores focus on closing, and
supports Escape to pause. Buttons use native semantics and minimum 44px targets.
Highlights are supplementary to explanatory text. Motion is absent; scrolling is
instant, including reduced-motion mode. Mobile placement clears the bottom nav
and limits panel height with internal scrolling. Removing a target displays a
plain-language fallback with usable Next/Skip controls. Manual assistive-technology
review remains part of staging acceptance, not implied by automated tests.

## Database and deployment

Migration `007_tutorial_progress.sql` adds per-staff status, mode, position,
completed IDs, last completed version and optimistic revision. Migration
`008_staff_invitations.sql` adds invitations and persistent activation attempt
limits. Existing staff/content/session data is preserved. Runtime grants explicitly
cover the new tables without granting organisation-registry UPDATE or DDL rights.
The existing environment identity and checksum guards remain enabled.

Apply migrations using the existing reviewed pre-deploy workflow before the new
API. Do not reset a database or use a production database for tests. As the migration
runner rejects unknown migration history, a code rollback must retain the migration
inventory (007/008) and grants in a reviewed compatibility build. Prefer a forward
fix; do not drop progress, staff or audit tables to make an old build start.

## Verification and remaining acceptance

Local verification includes API unit/HTTP tests, portal tests, shared UI checks,
portal build/typecheck, and isolated PostgreSQL tests for real runtime-role grants,
concurrent claims, expiry/revocation, access denial, audit records and persistence.
The isolated runner also verifies database restart and logical backup/restore.

`scripts/check-onboarding-browser.mjs` uses the repository's existing Playwright
installation against a loopback portal, with intercepted synthetic API responses.
It checks 320/390/768/1440px, keyboard/touch, welcome, skip/resume, returning users,
mode persistence, completion, role filtering, missing targets and the activation
wizard. It asserts that tutorials send no business mutation requests. CI runs this
separately from database and signed-JWT tests. It does **not** prove a live Google,
Access policy, certificate or hosted user session works.

Before merge/release: review the installer identity configuration, migrations and
PR checks. Before declaring hosted acceptance: verify staging Google+MFA, first
Owner activation, Editor invitation, disabled-user rejection, normal module access,
sign-out/re-login progress, mobile and screen-reader operation using authorised
test staff. No production writes or deployments were performed for this phase.

### Local evidence (2026-10-29)

- API unit/HTTP regression: 58 passed; portal regression: 5 passed; public-site
  regression: 15 passed; existing shared UI regression: 8 passed.
- API and portal lint/type checks, shared UI lint/type checks, public-site build,
  standalone portal build and API-embedded portal build passed.
- Isolated PostgreSQL 17.11 suite passed with restricted-runtime invitation and
  progress operations, competing Owner invitations, restart and logical restore.
  No existing database was modified.
- Chrome synthetic browser acceptance passed at 320, 390, 768 and 1440px.
- Monitoring registry and workspace-manifest checks passed. Project-registry
  check passed with its existing REEBS Water missing-metadata warning; unrelated
  metadata was not changed.
- Embedded CMS build measured 345.04 kB JS (104.56 kB gzip) and 142.26 kB CSS
  (21.98 kB gzip), before the final focus/target-only correction. No runtime
  dependency was added. CI is the final branch verification gate.
