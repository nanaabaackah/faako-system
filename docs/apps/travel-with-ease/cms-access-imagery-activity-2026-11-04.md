# CMS access, imagery, activity and navigation

> 2026-11-06: Demo routes, flags and simulated sessions described here are
> retired. Preserve this historical context, but use the current
> [cleanup and verification guide](./repository-cleanup-2026-11-06.md), not the old demo instructions.

## Scope and rollout

Focused branch: `feat/twe-cms-roles-imagery-activity`, based on develop
`358ad9732a4948ef5a8d35150e5f4fef570650c7`. This additive TWE extension does not
change authentication providers, infrastructure ownership, other clients,
typography, page structure or the approved five-mockup composition. No new
dependency is required.

Apply migration 013 through environment-scoped predeploy before its runtime.
Code/tests do not prove a hosted deployment. Staging acceptance, real account
handover and any separately approved main promotion remain explicit gates.

## Role matrix

| Capability | Superadmin (`platform_admin`) | Owner | Editor |
| --- | --- | --- | --- |
| Draft/preview and manage media | Yes | Yes | Yes |
| Publish content/templates | Yes | Yes | No |
| Invite/manage Editors | Yes | Yes | No |
| Invite Owners / change Owner–Editor roles | Yes | No | No |
| Workspace business activity | Yes | Yes | No |
| Security events / technical diagnostics | Yes | No | No |
| Assign Superadmin in the portal | No | No | No |

Existing enquiry permissions and expiring legacy support grants are retained.
The approved explicit Superadmin business permissions supersede older
technical-only/support-only descriptions. No role confers provider ownership,
direct credentials or access to another organisation.

`staff.roles.manage` is Superadmin-only. Change role requires expected current
role and an approval reference. Only Owner/Editor targets and destination roles
are accepted, never self/platform promotion. The server re-reads active actors
and tenant membership. Staff changes and invitation acceptance share an
organisation advisory lock. Multiple active Owners are supported; concurrent
demotion/deactivation cannot remove the last active Owner.

Changes revoke affected sessions/support grants, including approvals issued by
a demoted/deactivated user. Losing invitation authority also revokes their
pending invitations. Migration `013_staff_role_management.sql` adds invitation
purpose and an append-only role ledger, preserving staff IDs, content, revisions
and tutorials. Omitted invitation roles remain Editor. Initial Owner bootstrap
is distinct from ordinary Superadmin-issued Owner invitations; verified identity,
expiry, single use and initial-bootstrap restrictions remain authoritative.

## Reviewed developer handover

Run `pnpm --filter @faako/travel-with-ease-api staff:handover APPROVAL-REF --approved-handover`
only in a reviewed backend administration environment with its migration
connection and intended environment/organisation configured.

The command reads protected stdin JSON containing exactly `developerAssertion`
and `clientAssertion`. Use an approved secret-input mechanism, never arguments,
shell history, logs, chat or committed files. Both must be current real
Cloudflare app assertions obtained after the configured MFA policy. The command
verifies signatures, issuer, audience and stable subjects. Developer email must
additionally be `dev.nanaabaackah@gmail.com`; email matching alone grants nothing.

Both users must already be activated and active in this tenant. Developer must
be Owner; client must be Owner/Editor. Existing Superadmin presence blocks this
bootstrap path. The transaction establishes client Owner first, converts the
developer, retains IDs, revokes both users' sessions/approvals/pending invitations
and writes immutable history. Both sign in again. Failure rolls back; inspect
the ledger before retrying an uncertain result. Only synthetic isolated tests
have executed this handover, not real accounts.

## Images & layout

Choose Images & layout inside Content, or Shared website imagery for global
assets. Supported slots: homepage hero; About/story and page headers; individual
service entries; How It Works; package/article/tip covers; ordered package/article
galleries; continuous desktop/mobile enquiry/footer; five named CTA mockups.
Logos, boundaries, fonts and page structure remain code-managed.

Slots show affected pages, proportions, recommended width, thumbnails and known
dimensions. Choose tenant media or Import from Drive. Approved Drive images are
TWE-owned: no manual source/licence evidence, visible captions or credits.
Technical Drive identifiers remain internal for sync and duplicate control.

Desktop/mobile sources and bounded focal points are supported. Left/right
presets apply only to About/story and How It Works; mobile remains stacked.
Gallery Earlier/Later/Remove controls preserve explicit order. Stable entry IDs
prevent title edits from reassigning images.

Only tenant-owned, non-archived Media UUIDs are accepted. Arbitrary URLs, paths,
CSS/HTML, unknown slots and invalid crops are rejected. Existing WebP processing
strips metadata, retains transparency and does not upscale. Low-resolution
selections warn. Meaningful images retain alt text; footer/mockups are decorative.

Reset removes an override and restores the approved image without deleting
media. Legacy selected images remain supported. Assignments autosave as drafts,
enter revision/media references and survive restore/private preview/publication
and recovery artifacts. Drive sync/import never publishes automatically.
Editors draft/preview; Owners/Superadmins publish. Shared imagery is internal,
not a public `/site-appearance` page.

## Activity and diagnostics

`audit.business.read` grants Owners/Superadmins a tenant-scoped business endpoint
with category/date filters and bounded 50-row cursor pages. Categories cover
content/media/publication/staff/templates, excluding auth/support/system/bootstrap
events. Security Activity remains in System Administration under `security.read`.
Role events include affected account, before/after and approval reference.

Faako desktop tables and mobile event cards provide details, request-ID copy,
loading/empty/error states, refresh and pagination. Invitation, revision and
publication history share that presentation. Diagnostics show stored status
counts only. No raw provider logs, SQL errors, tokens/assertions, email bodies
or customer payloads are exposed. No audit editing, deletion or export.

## Responsive navigation and local demos

Mobile order: **Content · Enquiries · Overview · Media · Account**. Overview is
physically centred and larger. Unauthorised/disabled destinations are omitted;
side-only pages do not falsely select Overview. Actual logo plus Menu opens a
complete role-filtered left drawer with focus trap, inert background,
Escape/backdrop close and focus restoration. Safe-area spacing protects
controls, tutorials and sign-out.

Desktop retains a collapsible sidebar with labelled icons/tooltips. Only its
non-sensitive collapse preference is local. Mobile starts closed and closes
when identity/permissions change.

Run `pnpm run dev:twe` from the synchronised regular root. Demo:
`http://localhost:5188/?demo=1`; append `&demoRole=platform_admin` or
`&demoRole=editor`. These are synthetic frontend fixtures, not real identities
or an auth bypass. Hosted demos remain independently Access/build gated.

## Verification and recovery

```sh
pnpm --filter '@faako/travel-with-ease-*' lint
pnpm --filter '@faako/travel-with-ease-*' typecheck
pnpm --filter '@faako/travel-with-ease-*' build
pnpm --filter '@faako/travel-with-ease-*' test
pnpm --filter @faako/ui test
TWE_TEST_PG_BIN=/absolute/path/to/postgresql17/bin pnpm --filter @faako/travel-with-ease-api test:db:isolated
node apps/travel-with-ease-portal/scripts/check-cms-management-browser.mjs
```

Browser script uses local 127.0.0.1:5197 and existing Playwright; select Chrome
with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. It aborts real API requests and uses
synthetic fixtures. Foundation CI runs it alongside existing public, onboarding
and private-preview checks.

Retain the known-good SHA and verified environment backup before migration.
Migration 013 is additive; its insert trigger supports preceding invitation
inserts. Roll back the application with columns/ledger retained, never reset or
drop shared history. With an older runtime, suspend role/Owner invitation
administration until compatible code returns. Prefer fix-forward.

Before production, record staging MFA/session, role/last-Owner behaviour, real
media crops, private previews, explicit publication/recovery and activity
permissions against deployed SHAs. Review real account handover separately.
The previously observed production database predeployment failure remains a
separate provider/configuration issue; this branch does not claim to repair it.
