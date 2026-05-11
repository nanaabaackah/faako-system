# Dev ERP Module Consolidation Plan

## Purpose

Document a safe, app-specific consolidation path for Dev ERP modules before any implementation. Dev ERP is fully live with real operational data, so this plan is documentation-only and must not change routes, auth behavior, database schema, files, redirects, or business workflows.

## Current implementation status

Team consolidation is pending for Dev ERP. User Control and Profile remain unchanged because they have different access assumptions, and forcing a visible Team grouping could disrupt live restricted-module users.

Settings consolidation was reviewed and left unchanged. `/settings` is already the only current Settings/config route, while system health and audit logs remain Reports-owned until a separate live capability review says otherwise.

Bookings/Rentals/Schedule consolidation was reviewed and left unchanged. `/bookings` is already nested under Rent as Appointments, and no separate rentals or schedule route exists to safely group under a new Bookings module without a live capability review.

## 1. Current modules/routes

Current public/auth routes:

- Login: `/login`
- Setup account: `/setup-account`
- Public booking: `/book/:orgSlug?`
- Public invoice view: `/invoice/view/:token`
- Error page: `/error`

Current authenticated ERP routes:

- Home/dashboard: `/`, `/dashboard`
- Rent: `/rent`
- Appointments/bookings: `/bookings`
- Organizations/customers: `/organizations`
- Profile: `/profile`
- User control: `/user-control`, legacy `/users`
- System health: `/system-health`
- Reports: `/reports`
- Accounting: `/accounting`
- Invoicing: `/invoicing`
- Productivity legacy redirect: `/productivity`
- Settings: `/settings`
- Audit logs: `/audit-logs`

Current registry modules:

- Home: `/`, redirects/targets dashboard behavior.
- Dashboard: `/dashboard`
- Rent: `/rent`, with Appointments child `/bookings`
- Customers: `/organizations`
- Payments: `/accounting`, with Accounting child `/accounting` and Invoicing child `/invoicing`
- Reports: `/reports`, with System Health child `/system-health` and Audit Logs child `/audit-logs`
- Users: `/user-control`, with Profile child `/profile`
- Settings: `/settings`

## 2. Target module structure

Recommended conservative target structure:

- Dashboard
- Rent
- Organizations
- Finance
- Reports
- Team
- Settings

Public booking, public invoice view, login, setup account, and error routes should remain outside the authenticated ERP navigation model.

## 3. Modules to keep as top-level

- Dashboard: live operational overview and default signed-in landing route.
- Rent: rent management and rent-scoped operational workflows.
- Organizations: customer/client organization records.
- Finance: accounting, invoicing, payment-facing financial workflows, and invoice view context.
- Reports: reports, system health, and audit logs.
- Team: user control and profile/account areas.
- Settings: app/system configuration.

## 4. Modules to group under other modules

- Accounting and invoicing should group under Finance. The current registry uses `payments`; future naming should likely become Finance unless product language requires Payments.
- Appointments/bookings should remain under Rent for now because the current registry and rent-only user view already treat bookings as rent-adjacent.
- System health and audit logs should group under Reports.
- User control and profile should group under Team.
- `/productivity` should remain a legacy redirect for now and should not become a visible top-level module unless the route is restored intentionally.
- Public booking and public invoice view should not be grouped into authenticated navigation until a separate public-route review happens.

## 5. Legacy routes to preserve

Preserve every existing route during consolidation:

- `/` should continue reaching dashboard behavior.
- `/users` should continue redirecting to `/user-control`.
- `/productivity` should continue redirecting to `/dashboard` unless productivity is restored in a future feature task.
- `/invoice/view/:token` must remain available for public invoice access.
- `/book/:orgSlug?` must remain available for public appointment booking.
- `/login`, `/setup-account`, and `/error` must remain available outside the authenticated shell.
- `/dashboard`, `/rent`, `/bookings`, `/organizations`, `/profile`, `/user-control`, `/system-health`, `/reports`, `/accounting`, `/invoicing`, `/settings`, and `/audit-logs` must remain valid.

Do not implement new redirects until a separate implementation phase defines exact route behavior.

## 6. Risks

- Dev ERP contains real operational data, so navigation changes can disrupt live rent, accounting, invoicing, reporting, and user-control workflows even without data changes.
- Rent-only user navigation is intentionally narrow and could break if Dashboard/Rent/Profile assumptions change.
- API capability checks may not map one-to-one to visual module grouping.
- Grouping system health and audit logs under Reports could hide important operational monitoring surfaces.
- Renaming Payments to Finance may affect user expectations and documentation.
- Public invoice and booking routes must stay outside authenticated navigation assumptions.

## 7. Data impact

Planning-only: none.

Future implementation should start as registry/navigation metadata only. Any database schema, migration, seed, data import, backfill, or record transformation must be handled as a separate production-sensitive task.

## 8. Security impact

Planning-only: none.

Future implementation must not change auth, sessions, CSRF, API permissions, backend capabilities, organization scoping, public invoice access, or public booking access. Frontend grouping must remain separate from access enforcement.

## 9. Recommended implementation order

1. Confirm this plan against the live route list, registry, and capability matrix.
2. Rename the conceptual `payments` parent to Finance in documentation/registry metadata only if the product language is approved.
3. Keep existing route paths and page components unchanged.
4. Add grouped navigation metadata behind the current visible navigation behavior.
5. Verify normal authenticated users and rent-only users separately.
6. Group Accounting and Invoicing under Finance.
7. Group System Health and Audit Logs under Reports.
8. Group User Control and Profile under Team.
9. Keep Bookings under Rent until a live workflow review says otherwise. Current review found no safe Bookings/Rentals/Schedule grouping to implement beyond the existing Rent/Appointments structure.
10. Review whether Settings should own any future integration/configuration children. Current review found no safe Settings grouping to implement beyond the existing `/settings` route.
11. Only after repeated validation, consider consolidated module pages or redirects in a separate task.

## 10. Rollback notes

- Revert registry metadata and labels to the previous navigation structure.
- Restore previous `NAV_ITEM_ORDER`, mobile tab assumptions, and rent-only arrays if they are changed in a future task.
- Keep every route declaration in place.
- Do not roll back by removing public invoice, public booking, auth, or operational route files.
- If live users report workflow disruption, restore previous top-level visibility first and revisit grouping later.

## 11. Manual testing checklist

- Confirm unauthenticated `/login`, `/setup-account`, `/book/:orgSlug?`, `/invoice/view/:token`, and `/error` routes still work.
- Confirm `/` and `/dashboard` reach dashboard behavior.
- Confirm `/rent` works for standard and rent-only users.
- Confirm `/bookings` remains reachable for users with bookings access.
- Confirm `/organizations` remains reachable for organization/customer workflows.
- Confirm `/accounting` and `/invoicing` remain reachable for finance-capable users.
- Confirm `/reports`, `/system-health`, and `/audit-logs` remain reachable for permitted users.
- Confirm `/user-control`, `/users`, and `/profile` behavior remains intact.
- Confirm `/settings` remains reachable for settings-capable users.
- Confirm `/productivity` still redirects to `/dashboard`.
- Confirm rent-only users still see only intended rent/profile navigation.
- Confirm desktop sidebar and mobile tabs have no duplicate items.
- Confirm no backend capability, auth/session, CSRF, organization scoping, or API permission behavior changed.
