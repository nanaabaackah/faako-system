# REEBS Portal settings architecture

## Scope

The Settings screen owns personal profile details, personal portal appearance,
staff account entry points, shared commercial schedules, organization document
identity, and local diagnostic information. It does not own statutory tax
configuration, accounting policy, inventory templates, or storefront design.

Water remains a standalone business domain. Water staff can open the Settings
commercial tab to read the Water price schedule, but cannot see REEBS Core
commercial values or edit organization document identity. Water prices continue
to be stored in `waterProductPrice` and are not included in REEBS Core revenue.

## Authoritative persistence

| Setting | Authority | Scope | Write access |
| --- | --- | --- | --- |
| Profile and avatar | `/api/staffProfile`, `user`, `employeeProfile` | Authenticated user and organization | Current user |
| Theme and font size | `/api/v1/portal-settings`, `systemConfig` key `portal.preferences.user.<id>` | Authenticated user and organization | Current user |
| Document identity | `/api/v1/portal-settings`, `systemConfig` key `portal.documentIdentity` | Organization | Owner/admin |
| Core commercial rules | `/api/commercial-config`, `commercialConfiguration` | `REEBS_CORE`/`SHARED` | Owner/admin |
| Water prices | `/api/commercial-config`, `waterProductPrice` | `WATER` | Owner/admin; Water role read-only |
| Staff accounts | `/api/users` | Organization | Owner/admin for standard roles; system administrator for privileged roles |
| Advanced health cards | Browser offline queue and snapshots | Current device | Read-only diagnostic |

Browser storage is a compatibility cache for appearance and document rendering;
it is not the source of truth. Invoicing refreshes organization document identity
from the authenticated settings endpoint before using its cached copy.

## Theme application

`AppShell` owns the admin theme lifecycle. It loads the current user's cached
preferences immediately, refreshes them from the backend, applies
`data-admin-theme` and `data-admin-font-size` to the document root, and keeps the
`admin-theme` body class active across lazy admin-route transitions. Shared UI
tokens and Settings-specific dark-mode overrides consume those attributes.

## Security and integrity

- All settings reads and writes derive `organizationId` and `userId` from the
  authenticated session.
- Document identity writes are validated, transactional, and audited without
  recording contact values in audit metadata.
- Profile updates are transactional. A password change requires eight characters,
  revokes other sessions, and preserves the authenticated session performing the
  change.
- Internal `inventory-templates` website-content records require owner/admin
  authentication and use the authenticated organization; storefront content
  remains public only for the configured public organization.

## Deferred, non-live configuration

The legacy `/admin/website-template` URL remains only as a compatibility redirect
and is no longer advertised as a Settings feature. Inventory template drafts are
not shown in the active inventory menu because no outgoing message or document
consumer uses them yet. They must not be described as live templates until a
reviewed consumer, preview, and send/render test exist.
