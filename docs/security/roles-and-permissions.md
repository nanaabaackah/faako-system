# Roles and permissions

Status: adopted for new work and incremental migration as of 2026-07-26.

This standard extends the completed authentication and authorisation audit. It
does not replace an authentication provider and does not introduce Auth0.
Authentication remains owned by each application. Backend authorisation remains
the source of truth.

## Access model

Access is evaluated from the outside in:

1. **Application access** — may the principal use the authenticated application?
2. **Module access** — may the principal enter the business capability?
3. **Action permission** — may the principal perform this operation?
4. **Organisation assignment** — may the principal act in this tenant?
5. **Resource rule** — does ownership, state, or another domain invariant allow it?

Passing one level never implies the next. A frontend route, hidden button, role
name, client-supplied organisation ID, or database record ID is not proof of
access.

`@faako/security` owns framework-independent identifiers and evaluation helpers.
`@faako/types` owns the portable `Permission`, `PermissionGrant`, `Role`, and
`ApplicationAccess` shapes. Neither package imports React, Express, Prisma,
Astro, or Vite.

## Shared identifiers

Application identifiers:

| Application | Identifier |
| --- | --- |
| Dev ERP | `dev-erp` |
| Faako ERP demo | `faako-erp` |
| REEBS Portal | `reebs-portal` |
| Stroane staff/admin | `stroane-admin` |

The shared action vocabulary includes `access`, `read`, `view`, `create`,
`write`, `edit`, `delete`, `archive`, `approve`, `export`, and `manage`.
Actions are not silently aliased: `read` is not assumed to mean `view`, and
`write` is not assumed to mean `edit`. An application may declare an explicit
compatibility alias in a `PermissionDefinition`.

Existing database identifiers remain valid:

- REEBS keeps strings such as `users:write` and `inventory:approve`.
- Stroane keeps its module/action matrix, such as `orders.view`.
- Dev ERP keeps role permission module keys, such as `rent` and `invoicing`.

`definePermission` records the application, module, action, current ID, and any
explicit legacy IDs without requiring a database migration.

## Organisation rules

`isOrganisationAssignmentAllowed` permits:

- the authenticated organisation;
- an organisation explicitly present in the principal's server-owned
  assignments; or
- a deliberately unrestricted platform principal.

It never grants cross-tenant access from a role label alone. Organisation IDs
from query strings, headers, bodies, browser storage, or URLs are selectors
that must be resolved against server-owned assignments.

## Application mappings

| Application | Application access | Module/action model | Organisation rule | Backend authority |
| --- | --- | --- | --- | --- |
| Dev ERP | Authenticated active user | Existing module capability routes; Admin remains unrestricted | Session organisation; existing global-admin exception | Auth, capability, and organisation-scope middleware |
| REEBS Portal | Active database session | Existing role map and `resource:action` strings | Session organisation; explicit assignments or system admin only | API function access helpers and scoped queries |
| Stroane admin | Active site user in a portal role | Existing module/action matrix | Single Stroane dataset; no tenant selector | `requireSiteUser` plus `requireAdminRole` |
| Faako ERP | Public demo descriptor only | No privileged backend modules | Not applicable | Demo gate is explicitly not a security boundary |
| Faako API | Public API endpoints | No application roles in current scope | Not applicable | Endpoint validation and abuse controls |

## Intentional access corrections in this change

These are security corrections from the completed audit, not silent role
changes:

1. REEBS `POST` and `PUT` user operations now require `users:write`. Existing
   Owner, Admin, and configured system-admin access remains. Manager, Staff,
   Warehouse, Driver, and Water roles can no longer create or modify users.
2. REEBS user-directory reads now require `users:read`, with the existing
   limited Driver read behavior preserved. Owner, Admin, and Manager retain
   directory reads. Staff, Warehouse, and Water no longer receive a user
   directory merely because they have a valid session.
3. REEBS Owner/Admin role names no longer grant arbitrary cross-organisation
   access. A server-owned assignment is required; the configured system
   administrator exception remains.
4. Stroane order list/detail reads now enforce `orders.view` on the backend.
   Admin, Owner, and Viewer behavior is unchanged; a Custom role explicitly
   denied that action now receives `403`.

No role or permission row was renamed, rewritten, broadened, or bulk migrated.

## Frontend behavior

Frontend checks mirror server rules for navigation and affordances only.

- Dev ERP and Stroane now consume the same shared module/action identifier
  lists as their backends.
- HTTP `401` maps to session-expired/sign-in behavior.
- HTTP `403` maps to permission denied.
- A client must not retry a `403` until access changes.
- Confidential data must not be rendered behind an empty-state placeholder.

## Testing requirements

Every new protected endpoint needs:

- allowed role/permission coverage;
- denied role/permission coverage;
- unauthenticated coverage;
- organisation mismatch coverage when multi-tenant;
- resource ownership/state coverage where relevant; and
- a test that the protected domain operation is not called after denial.

Current focused coverage includes shared permission helpers, Dev ERP module
capabilities, REEBS user mutation policy and tenant selection, and Stroane
custom-role order reads.

## Incremental adoption

Future endpoint work should declare its required application, module, action,
organisation rule, and resource rule in the routing/service code. Migrate one
bounded module at a time. Do not translate all legacy permissions in a single
release, and do not infer new grants while adapting old records.
