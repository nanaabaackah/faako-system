# Stroane Web Progress Log

## Purpose

Track meaningful changes to Stroane Web, the first paying client project in the Faako monorepo.

## Current app status

Client-sensitive commerce app. Changes should account for product browsing, purchasing flows, backend API behavior, database integrity, deployment, and client confidence.

## Reusable change entry template

Date:
Feature/change name:
What changed:
Why it changed:
Files changed:
Data impact:
Security impact:
Testing done:
Rollback notes:
Next step:

## Entries

### Security hardening foundation batch

Date: 2026-07-18
Feature/change name: Exact CORS allowlist and safe JSON-LD serialization
What changed: Removed broad `.pages.dev` suffix trust from the credentialed Stroane API CORS validator. Hosted production and staging now accept only exact `CORS_ORIGINS` values, development retains known localhost defaults, missing-Origin server requests remain supported, and an owned Pages preview works only when its exact origin is configured. Added a lightweight JSON-LD serializer that escapes `<`, `>`, `&`, U+2028, and U+2029 before `StructuredData` writes the script body while preserving the parsed schema value.
Why it changed: An arbitrary attacker-controlled Pages hostname could previously pass CORS validation, and raw `JSON.stringify` output could allow a schema string containing `</script>` to terminate the JSON-LD element.
Files changed: apps/stroane-web/backend/security.js, apps/stroane-web/backend/security.test.js, apps/stroane-web/backend/server.js, apps/stroane-web/src/components/StructuredData.tsx, apps/stroane-web/src/components/serializeJsonLd.js, apps/stroane-web/src/components/serializeJsonLd.test.js, apps/stroane-web/.env.example, apps/stroane-web/package.json, apps/stroane-web/README.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md, docs/platform/security-status.md.
Data impact: None. No schema, migration, seed, catalogue, order, payment, customer, or inventory data changed.
Security impact: Positive. Credentialed CORS uses exact allowlist membership with preview trust disabled by default, and inline JSON-LD no longer contains literal HTML-significant or script-closing sequences.
Testing done: Focused CORS and JSON-LD tests passed with 16 tests. Full Stroane backend tests passed with 76 tests. TypeScript check, full lint, production build, `pnpm run security:scan`, and `pnpm run security:gate` passed. The build retained the pre-existing Vite warning about `NODE_ENV=production` in the local env file.
Rollback notes: Revert the exact-origin helper/server wiring and serializer/component wiring together. Restoring broad `.pages.dev` trust or raw JSON-LD serialization is not recommended.
Next step: Redeploy the API only after confirming hosted `CORS_ORIGINS` contains every exact storefront and portal origin, then browser-smoke the storefront, portal, and one product detail page.

### Accounting expense hub

Date: 2026-07-04
Feature/change name: Accounting expense hub
What changed:
- Added `/admin/expenses` as an accounting-permission module for recording paid expenses and unpaid expense liabilities by class, category, payee/supplier, date, due date, reference, and notes.
- Added `GET /api/admin/accounting/expenses` and `POST /api/admin/accounting/expenses` over the existing accounting ledger.
- Extended `AccountingLedgerEntry` with optional expense metadata fields: `expenseClass`, `counterparty`, `dueDate`, and `paymentStatus`.
- Updated `/admin/accounting` to show expense exposure, unpaid expense liabilities, and an Expenses shortcut, while keeping paid expenses and unpaid liabilities connected to existing net-profit/net-position calculations.
- Added backend regression coverage for unpaid expense creation and accounting overview totals.
Why it changed: The client needs a clear place to record sales, operational, supplier, delivery, tax, payroll, rent, and other expenses, and needs unpaid expense obligations surfaced as liabilities in accounting.
Files changed: apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260704000000_add_expense_metadata_to_ledger/migration.sql, apps/stroane-web/backend/src/accounting/routes.js, apps/stroane-web/backend/accounting.test.js, apps/stroane-web/src/portal/api/adminAccounting.ts, apps/stroane-web/src/portal/pages/AccountingManagement.tsx, apps/stroane-web/src/portal/pages/ExpenseManagement.tsx, apps/stroane-web/src/portal/PortalApp.tsx, apps/stroane-web/src/portal/components/AdminPortalLayout.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md.
Data impact: Additive Prisma migration. Existing ledger rows remain valid; new expense rows use the same `AccountingLedgerEntry` table and add optional metadata only where available.
Security impact: Neutral/positive. Expense reads stay behind `accounting.view`; expense creation requires `accounting.create`; `ADMIN` and `OWNER` remain elevated. Audit Logs remain `ADMIN`-only.
Testing done: `node --check` passed for the accounting route and new accounting test. `pnpm --filter @faako/stroane-web exec node --test backend/accounting.test.js` passed with 2 tests. `pnpm --filter @faako/stroane-web run test:backend` passed with 65 tests. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning. `git diff --check` passed.
Rollback notes: Revert the expense page/route/API changes, accounting summary additions, migration/schema additions, tests, and docs. If deployed data exists, preserve or export `AccountingLedgerEntry` rows with `source = manual_expense` before rollback.
Next step: Deploy the migration before enabling `/admin/expenses` in staging/production, then browser-smoke paid and unpaid expense creation and confirm the accounting summary updates.

### Custom role inventory request guards

Date: 2026-07-04
Feature/change name: Custom role inventory request guards
What changed:
- Changed portal session permission fallback so `CUSTOM` sessions without explicit permission payloads start from no module permissions instead of inheriting viewer inventory visibility.
- Added defensive `inventory.view` guards to the inventory provider, cached snapshot load, server refresh, and order product loader.
- Limited automatic queued inventory sync to roles with inventory write/manage permissions.
- Kept background manual-order product loading failures out of the global `Orders action` banner; those failures now show beside the manual-order product picker.
- Added backend regression coverage proving an `OWNER` can pass the `orders.edit` action middleware.
Why it changed: Some custom-role or stale browser sessions could still trigger private product, supplier, inventory, movement, and alert requests even though the backend correctly returned `403 Forbidden`. The orders page also surfaced background product-loading failures as `Orders action` failures, which made an inventory/product denial look like the owner was blocked from the whole orders module.
Files changed: apps/stroane-web/backend/auth.test.js, apps/stroane-web/src/portal/api/adminSession.ts, apps/stroane-web/src/portal/context/InventoryManagementContext.tsx, apps/stroane-web/src/portal/pages/OrderManagement.tsx, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md.
Data impact: No schema or data migration.
Security impact: Positive. Custom roles no longer get frontend fallback access to inventory data, and backend `inventory.view` enforcement remains the source of truth.
Testing done: `pnpm --filter @faako/stroane-web exec node --test backend/auth.test.js` passed with 10 tests. `pnpm --filter @faako/stroane-web run test:backend` passed with 63 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning. `git diff --check` passed.
Rollback notes: Revert the custom-role fallback change and inventory/order loader guards. No data rollback is required.
Next step: Browser-smoke `/admin`, `/admin/orders`, and `/admin/inventory` with a custom role that does not have `inventory.view`; those pages should not emit product/supplier/inventory/movement/alert 403s unless the user directly opens a protected inventory route.

### Owner and admin team role editing

Date: 2026-07-04
Feature/change name: Owner and admin team role editing
What changed:
- Added custom-role editing to the `/admin/team` module so admins and owners can update a custom role's name, description, permissions, and active status.
- Added `PATCH /api/auth/roles/:id` for custom role edits, while keeping system roles immutable.
- Restricted team user/role management APIs and the team route/sidebar item to elevated `ADMIN`/`OWNER` roles only.
- Added backend regression coverage proving owners can use team-management APIs, custom roles cannot, and admins can update sanitized custom role permissions.
- Updated current API, architecture, implementation, security, and system-status docs so owner/admin parity applies across all portal modules and data, with Audit Logs called out as the exception.
Why it changed: The team module needed a way to maintain existing custom roles after creation. Owners should have the same portal privileges as admins except for the Audit Logs module.
Files changed: apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/backend/auth.test.js, apps/stroane-web/src/portal/api/adminSession.ts, apps/stroane-web/src/portal/components/AdminPortalLayout.tsx, apps/stroane-web/src/portal/PortalApp.tsx, apps/stroane-web/src/portal/pages/TeamManagement.tsx, apps/stroane-web/src/portal/styles/AdminPortal.css, docs/apps/stroane-web/api.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/portal-architecture.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md.
Data impact: No schema or migration. Custom role edits update existing `PortalRole` rows only.
Security impact: Positive. Team management remains limited to elevated system roles, custom roles still cannot grant team permissions, system role definitions cannot be edited, and Audit Logs remain `ADMIN`-only.
Testing done: `git diff --check` passed. `pnpm --filter @faako/stroane-web exec node --test backend/auth.test.js` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 62 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Revert the role update route/API method, Team page role editing controls, elevated route/sidebar guard changes, auth tests, and docs. No data rollback is required.
Next step: Browser-smoke `/admin/team` with an admin account and an owner account, then confirm Audit Logs remain hidden from owners.

### Portal role-aware dashboard loading

Date: 2026-07-04
Feature/change name: Portal role-aware dashboard loading
What changed:
- Updated the portal dashboard so it only fetches inventory, product, supplier, movement, and alert data when the current staff session has `inventory.view`.
- Updated dashboard order requests and order analytics so they only run when the session has `orders.view`.
- Added `inventory.view` checks to private product, supplier, inventory, movement, and inventory-alert read routes, while leaving writes on their stronger `inventory.create`/`inventory.edit` permissions.
- Added backend regression coverage for custom roles with and without `inventory.view`.
Why it changed: Custom staff roles that did not have inventory access were landing on `/admin` and the dashboard was still firing private inventory/product/supplier/alert/movement API requests, causing repeated 403 console errors and partially loaded content.
Files changed: apps/stroane-web/backend/auth.test.js, apps/stroane-web/backend/src/inventory/routes.js, apps/stroane-web/backend/src/inventoryAlerts/routes.js, apps/stroane-web/backend/src/products/routes.js, apps/stroane-web/src/portal/pages/AdminPortalHome.tsx, docs/apps/stroane-web/api.md, docs/apps/stroane-web/progress-log.md.
Data impact: No schema or data migration.
Security impact: Positive. Backend read APIs now enforce module permissions for custom roles, and the dashboard avoids calling APIs the user cannot view.
Testing done: `git diff --check` passed. `pnpm --filter @faako/stroane-web exec node --test backend/auth.test.js` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 59 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Revert the dashboard permission gates, route read-permission middleware changes, auth regression test, and docs. No data rollback is required.
Next step: Smoke-test `/admin` with a custom role that has only dashboard/profile access, then with a custom role that includes `inventory.view`.

### Portal profile password change

Date: 2026-07-04
Feature/change name: Portal profile password change
What changed:
- Added new/confirm password fields to the staff portal profile module.
- Extended `PATCH /api/auth/me` so the authenticated staff user can optionally update their own password from profile; the backend validates the new password length, hashes it server-side, and keeps password fields out of the response/session payload.
- Added backend regression coverage for a non-admin portal user changing only their own password.
Why it changed: Staff users created with temporary/invited passwords need a self-service way to set their own password after signing in, without needing an admin to rotate it manually.
Files changed: apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/backend/auth.test.js, apps/stroane-web/src/portal/api/adminSession.ts, apps/stroane-web/src/portal/pages/AdminPortalProfile.tsx, docs/apps/stroane-web/api.md, docs/apps/stroane-web/progress-log.md.
Data impact: No schema migration. Successful password changes update only the current user's `SiteUser.passwordHash`.
Security impact: Positive/neutral. Password changes require an authenticated staff session, hash the new password server-side, and do not expose password data in browser session storage or API responses. Existing HttpOnly staff cookie behavior remains unchanged.
Testing done: `git diff --check` passed. `pnpm --filter @faako/stroane-web exec node --test backend/auth.test.js` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 58 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Revert the profile password fields, optional `newPassword` backend handling/test, and docs. Existing password hashes remain valid.
Next step: Browser-smoke `/admin/profile` with a temporary-password user and confirm the new password works on the next login.

### Customer profile password reset action

Date: 2026-07-04
Feature/change name: Customer profile password reset action
What changed:
- Added a password reset action to the signed-in customer profile card. It uses the authenticated customer's email and calls the existing secure password-reset request flow.
- Added account-profile styling for the password row so the action fits the current profile form on desktop and mobile.
- Added backend regression coverage proving each new reset request replaces the previous token, expired links are rejected, and successful resets clear reset metadata.
- Replaced the password-reset email wrapper with a compact table-based email so the rendered email includes the visible reset action body, fallback reset URL, expiry copy, account-safety note, and local-test redirect notice in the message body.
Why it changed: Signed-in customers should be able to request a reset-token email from their profile without signing out or finding the forgot-password page.
Files changed: apps/stroane-web/src/frontend/pages/CustomerAccountPlaceholder.tsx, apps/stroane-web/src/frontend/styles/AccountPlaceholder.css, apps/stroane-web/backend/src/customerAccountNotifications.js, apps/stroane-web/backend/customer-account-notifications.test.js, apps/stroane-web/backend/customer-accounts.test.js, docs/apps/stroane-web/api.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/progress-log.md.
Data impact: No schema or data migration.
Security impact: Positive. The flow reuses the backend `POST /api/customer/password/forgot` endpoint, which returns a generic response, sends the raw reset token only by email, stores only a SHA-256 hash, gives the link a one-hour expiry, and replaces older reset-token hashes whenever a new link is requested. The email now also makes the expiry/replacement behavior visible to the customer without exposing reset-token hashes in browser state or logs.
Testing done: `git diff --check` passed. `pnpm --filter @faako/stroane-web exec node --test backend/customer-account-notifications.test.js` passed. `pnpm --filter @faako/stroane-web exec node --test backend/customer-accounts.test.js` passed. `pnpm --filter @faako/stroane-web run test:backend` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Revert the customer profile button/styling, customer password-reset email template/test, and this log entry. No database rollback is required.
Next step: Smoke-test `/account` with a signed-in staging customer and confirm the reset email is delivered to the current account email.

### Staging docs and API rate-limit tuning

Date: 2026-07-03
Feature/change name: Staging docs and API rate-limit tuning
What changed:
- Documented the Stroane staging environment split: `stage.stroanesolutions.com`, `portal-stage.stroanesolutions.com`, and `api-staging.stroanesolutions.com`.
- Aligned the backend server env loading with Prisma so `APP_ENV=staging` can load `.env.staging` during local API checks.
- Added method-scoped API rate-limit middleware support, split the global API limiter into read/write buckets, separated narrow staff/customer auth limits from roomier authenticated staff/customer session traffic, and mounted the admin limiter once before the admin router stack so a single protected request does not consume multiple admin hits while passing unmatched routers.
- Kept protected admin, inquiry, checkout, Paystack initialize, Paystack verify, Paystack webhook, and inventory-alert limits route-specific.
- Fixed a responsive audit-table CSS selector typo that surfaced during the staging-readiness build.
- Updated Stroane and platform security docs with the cross-app rate-limit audit summary.
Why it changed: Staging needed a clear runbook, and normal Stroane portal/customer activity could exhaust broad low auth/global buckets or consume several admin hits per request before the intended route-specific admin limit was reached.
Files changed: apps/stroane-web/backend/security.js, apps/stroane-web/backend/security.test.js, apps/stroane-web/backend/server.js, apps/stroane-web/src/portal/styles/AdminPortal.css, apps/stroane-web/README.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md, docs/platform/security-status.md.
Data impact: No schema or data migration.
Security impact: Positive. Login/signup/password/payment/write routes remain separately limited, while routine authenticated portal/customer reads no longer consume the narrow auth buckets. Limits are still in-memory per Node process; Railway/provider-level controls remain the production layer for deployed abuse protection.
Testing done: `node --check apps/stroane-web/backend/security.js` passed. `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 54 tests. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with only the existing Vite `NODE_ENV=production` env warning. `git diff --check` passed. Staging curl smoke passed for API health, catalogue products, storefront headers, portal login headers, and unauthenticated admin API rejection. Headless Chrome smoke passed for staging homepage, shop, and portal login with no captured page or console errors; the portal login page displayed the shared update-ready banner immediately.
Rollback notes: Revert the security middleware/server wiring and documentation updates. No database rollback is required.
Next step: Deploy the tuned API to staging, redeploy both Cloudflare Pages staging surfaces, then repeat the portal action flow that previously reached 429 after roughly 10 actions.

### Portal product creation and bulk table controls

Date: 2026-06-18
Feature/change name: Portal product creation and bulk table controls
What changed:
- Added admin-only product creation to the protected product API and inventory module. Creating a product now creates the catalogue row and its base inventory item together.
- Added admin-only bulk product publishing actions for selected inventory rows: activate, draft, archive, and delete listing. Delete listing is implemented as safe archive/unpublish rather than hard-delete.
- Added numbered rows and selection checkboxes to the active inventory, orders, and CRM/directory portal tables.
- Added inventory bulk action controls for selected products and selected-count/clear-selection bars for orders and CRM.
- Added shared Stroane table checkbox/row-number styling so table selection does not break ellipsis or fixed table layout.
Why it changed: Staff should be able to create and manage products from the portal instead of editing source files, JSON seeds, or code. Portal tables also need a consistent bulk-selection foundation before broader operational bulk workflows are added.
Files changed: apps/stroane-web/backend/src/products/controllers.js, apps/stroane-web/backend/src/products/routes.js, apps/stroane-web/backend/src/products/services.js, apps/stroane-web/backend/src/products/validation.js, apps/stroane-web/src/portal/api/adminProducts.ts, apps/stroane-web/src/portal/context/InventoryManagementContext.tsx, apps/stroane-web/src/portal/types/inventory.ts, apps/stroane-web/src/portal/pages/InventoryManagement.tsx, apps/stroane-web/src/portal/components/inventory/InventoryStockTable.tsx, apps/stroane-web/src/portal/pages/OrderManagement.tsx, apps/stroane-web/src/portal/pages/CustomerDirectory.tsx, apps/stroane-web/src/portal/styles/inventory-management.css, apps/stroane-web/src/portal/styles/order-management.css, apps/stroane-web/src/portal/styles/customer-directory.css, apps/stroane-web/src/styles/globals.css, docs/apps/stroane-web/api.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md.
Data impact: No schema migration. New admin product creation writes `CatalogueProduct`, a linked base `InventoryItem`, and product audit entries. Bulk delete/archive actions update publishing fields only and preserve rows/history.
Security impact: Positive/neutral. Product creation and bulk publishing routes require staff `SiteUser` auth and `ADMIN` role. Public catalogue output still exposes only active published products and continues to omit supplier/internal data.
Testing done: `node --check apps/stroane-web/backend/src/products/validation.js`, `node --check apps/stroane-web/backend/src/products/services.js`, `node --check apps/stroane-web/backend/src/products/controllers.js`, and `node --check apps/stroane-web/backend/src/products/routes.js` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Revert the product create/bulk API methods, inventory context/page/table changes, portal table selection changes, styling, and docs. No schema rollback is needed. Products created through the new UI should be archived/unpublished rather than deleted if they were created during testing.
Next step: Browser-smoke `/admin/inventory` with an admin account: create a draft product, select multiple rows, archive/delete-list selected rows, and confirm active storefront catalogue output excludes archived products.

### Portal orders action column polish

Date: 2026-06-17
Feature/change name: Portal orders action column polish
What changed:
- Reworked the orders table actions column to use shared `ERPIconAction` controls instead of an empty secondary button.
- Kept the row-level action focused on Paystack status refresh only where an order has a payment reference, with a smaller sync icon and tighter action column.
- Fixed the orders table actions column sizing, corrected the Created/Total colgroup order, and repaired the ellipsis selector so action cells are not clipped.
- Updated the orders fulfillment column to show the delivery/pickup method from `deliveryMethod` as the primary value, with fulfillment state underneath, and mirrored that method in the order detail status strip.
- Updated the shared ERP table pagination used by orders/CRM from visible Previous/Next text buttons to compact left/right arrow buttons with accessible labels.
- Cleaned the order detail lightbox so payment status appears once in the payment section, delivery method uses a shared dropdown, and Paystack actions are disabled while another payment action is running.
- Raised shared dropdown/date popovers above ERP modal backdrops so order-modal selects, date pickers, and time pickers remain visible and clickable.
- Added previous/next order navigation and debounced autosave to the order detail lightbox so staff can flip through orders without losing fulfillment edits.
- Clarified order modal wording so `deliveryMethod` is presented as the customer order type while fulfillment status remains the internal operations progress field.
- Added backend-proxied location search for checkout delivery addresses, persisted selected delivery-location metadata on orders, and rendered a staff-only delivery map in the order modal.
- Removed stale signup state hooks that were blocking TypeScript/lint validation or no longer needed setters.
Why it changed: The actions column needed to feel intentional, stay aligned across rows, and avoid table-layout quirks caused by empty button content or oversized row actions. The fulfillment column also needed to expose whether an order is for delivery or pickup instead of only showing the internal fulfillment state.
Files changed: packages/ui/src/components/ERPTable.tsx, packages/ui/src/ui.css, packages/ui/README.md, apps/stroane-web/.env.example, apps/stroane-web/public/_headers, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260618000000_add_order_delivery_location/migration.sql, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/locationSearch.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/ordersAdmin/routes.js, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/portal/api/adminOrders.ts, apps/stroane-web/src/portal/pages/OrderManagement.tsx, apps/stroane-web/src/portal/styles/order-management.css, apps/stroane-web/src/frontend/pages/Checkout.tsx, apps/stroane-web/src/frontend/components/checkout/CheckoutDetailsForm.tsx, apps/stroane-web/src/frontend/styles/Checkout.css, apps/stroane-web/src/frontend/pages/SignUp.tsx, docs/apps/stroane-web/api.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md.
Data impact: Adds nullable delivery-location metadata fields to `CommerceOrder`; existing orders remain valid with null values. UI and frontend state cleanup otherwise.
Security impact: Positive/neutral. Location search is rate-limited and proxied through the backend so provider config stays server-side. CSP frame sources now allow Google Maps frames for the staff order-location map. No payment secrets, provider keys, or cross-customer data are exposed.
Testing done: `node --check apps/stroane-web/backend/src/locationSearch.js`, `node --check apps/stroane-web/backend/src/orders.js`, `node --check apps/stroane-web/backend/server.js`, and `node --check apps/stroane-web/backend/src/ordersAdmin/routes.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. Local Vite preview served `http://127.0.0.1:4175/`; a headless mobile smoke of `/checkout` rendered the checkout page with no horizontal overflow. `git diff --check` passed.
Rollback notes: Revert the orders table/modal changes, checkout delivery-location search, location-search backend route, delivery-location migration/schema fields, CSP map frame allowance, and signup state cleanup. If the migration has already been applied, rollback requires a forward migration that drops the added nullable order-location columns and index after confirming no saved delivery map metadata must be retained.
Next step: Run Prisma validate, Stroane typecheck/lint/build, and browser-smoke `/admin/orders` with delivery and pickup rows.

### Customer portal signup and password reset

Date: 2026-06-17
Feature/change name: Customer portal signup and password reset
What changed:
- Kept the storefront customer auth pages on the two-column video/form layout and added matching forgot-password and reset-password pages.
- Removed the customer-facing signup note that implied account creation must come from Paystack return/invite context.
- Changed customer signup so customers can create an account directly, while optional invite and checkout references still link existing CRM/order context when provided.
- Added customer password-reset API endpoints, hashed reset-token storage, reset-link email delivery, and reset completion that stores only a server-side password hash and signs the customer in with the HttpOnly customer cookie.
- Added strong password requirements with live checkmarks on signup/reset forms and matching backend enforcement.
- Confirmed email is the customer account identifier: submitted emails are normalized to lowercase, customer lookup is case-insensitive, duplicate activated signup returns a clear sign-in response, and the CRM create flow updates the existing customer record instead of creating another account for the same email.
Why it changed: Stroane customer accounts should be available before a first order, and password recovery needs a secure customer-owned flow without displaying generated passwords on the frontend.
Files changed: apps/stroane-web/.env.example, apps/stroane-web/README.md, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260617000001_add_customer_password_reset/migration.sql, apps/stroane-web/backend/src/customerAccounts/routes.js, apps/stroane-web/backend/src/customerAccountNotifications.js, apps/stroane-web/src/api/customerAccount.ts, apps/stroane-web/src/context/AuthContext.tsx, apps/stroane-web/src/utils/passwordRequirements.ts, apps/stroane-web/src/frontend/components/auth/PasswordRequirementList.tsx, apps/stroane-web/src/frontend/StorefrontApp.tsx, apps/stroane-web/src/frontend/pages/SignIn.tsx, apps/stroane-web/src/frontend/pages/SignUp.tsx, apps/stroane-web/src/frontend/pages/ForgotPassword.tsx, apps/stroane-web/src/frontend/pages/ResetPassword.tsx, apps/stroane-web/src/frontend/styles/Auth.css, Stroane docs.
Data impact: Adds nullable password reset token hash/expiry/request timestamp fields to `CustomerAccount`. Existing customer/order rows are preserved.
Security impact: Positive. Password reset stores only SHA-256 token hashes, reset request responses are generic, new passwords are entered through password fields and never displayed or emailed, password hashes stay server-side, strong password requirements are enforced server-side, email remains the unique customer identifier, and reset tokens are cleared after use.
Testing done: `node --check apps/stroane-web/backend/src/customerAccounts/routes.js` passed. `node --check apps/stroane-web/backend/src/customerAccountNotifications.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Revert the customer reset migration/schema fields, customer reset routes/email helper, frontend reset pages/routes, and docs. If the migration has already been applied, rollback requires a forward migration that drops the reset-token columns and indexes after confirming no active reset links are needed.
Next step: Run the additive migration in the intended development database and smoke-test open signup, forgot-password email delivery, and reset-password completion.

### Production API, CSP, update notice, and portal auth refresh

Date: 2026-06-17
Feature/change name: Production API, CSP, update notice, and portal auth refresh
What changed:
- Updated the browser-facing Stroane API origin to `https://api.stroanesolutions.com` in runtime fallback logic and deployment documentation while keeping Railway as the backend host behind the custom domain.
- Updated Cloudflare Pages CSP headers to allow `api.stroanesolutions.com`, Cloudflare Insights script/connect hosts, and trusted inline script elements while keeping inline script attributes blocked.
- Tightened `AppUpdateNotice` so it polls the root app shell by default, compares only same-origin app build assets, and ignores cross-origin analytics/provider scripts in update signatures.
- Wired Stroane's mounted update notice to check `/` explicitly.
- Added portal auth bootstrapping so stored staff profile metadata is validated against the HttpOnly staff cookie before protected modules mount. A 401 from `/api/auth/me` now clears stale portal session metadata instead of letting dashboard/inventory/order requests fan out into repeated 401s.
Why it changed: Production was using the custom API domain, Cloudflare Insights was blocked by CSP, update prompts were not reliably detecting new deployed bundles, and expired/missing staff cookies could leave stale session shells that triggered repeated protected API 401s.
Files changed: apps/stroane-web/public/_headers, apps/stroane-web/src/api/config.ts, apps/stroane-web/src/App.tsx, packages/ui/src/components/AppUpdateNotice.tsx, apps/stroane-web/src/portal/api/adminSession.ts, apps/stroane-web/src/portal/context/AdminPortalContext.tsx, apps/stroane-web/src/portal/components/RequireAdminAuth.tsx, apps/stroane-web/src/portal/components/RequirePortalAccess.tsx, apps/stroane-web/README.md, packages/ui/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/portal-architecture.md, docs/apps/stroane-web/pre-deploy-checklist.md.
Data impact: None. No schema, seed, customer, order, inventory, payment, or portal data changes.
Security impact: Positive/neutral. API calls now target the intended custom API origin. CSP allows Cloudflare Insights and trusted script elements needed by deployed hosting/structured data while continuing to block inline script attributes. Stale staff profile shells are cleared on authenticated 401s rather than being treated as valid portal access.
Testing done: `git diff --check` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. Generated `dist/_headers` includes the updated CSP.
Rollback notes: Revert the CSP/API/update-notice/auth-bootstrap changes. If reverting only the API domain change, ensure Cloudflare Pages `VITE_API_BASE_URL` and `_headers` agree with the chosen API origin.
Next step: Redeploy Cloudflare Pages so `_headers` and the new bundle are live, then confirm `/login` no longer shows CSP errors and that an expired portal session redirects cleanly to login.

### Customer accounts and CRM directory

Date: 2026-06-17
Feature/change name: Customer accounts and CRM directory
What changed:
- Added the server-backed Stroane customer account foundation with `CustomerAccount`, invite/account status, customer-to-order linking, and a nullable `CommerceOrder.customerId`.
- Added customer signup/login/logout/profile/order APIs under `/api/customer` using a separate HttpOnly customer auth cookie and server-side customer scoping.
- Added checkout-return profile creation CTA so customers can create a profile from the Paystack return reference after checkout.
- Replaced the old storefront account placeholder flow with real customer sign-in/profile/order-history pages and a dedicated `/signin` customer login page.
- Added the portal CRM/directory module at `/admin/crm` and `/admin/directory`, including customer KPIs, search/status filters, paginated table, customer creation, and one-time account invite link copy/regeneration.
- Wired order creation/manual-order creation to link orders to existing customer records by verified email when available.
Why it changed: Stroane needs secure customer self-service plus a private staff CRM hub for managing client records, account status, and profile-creation links without exposing customer data across accounts.
Files changed: apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260617000000_add_customer_accounts_and_crm/migration.sql, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/auth.js, apps/stroane-web/backend/src/customerAccounts/routes.js, apps/stroane-web/backend/src/ordersAdmin/routes.js, apps/stroane-web/src/api/customerAccount.ts, apps/stroane-web/src/context/AuthContext.tsx, apps/stroane-web/src/frontend/StorefrontApp.tsx, apps/stroane-web/src/frontend/pages/CheckoutReturn.tsx, apps/stroane-web/src/frontend/pages/CustomerAccountPlaceholder.tsx, apps/stroane-web/src/frontend/pages/SignIn.tsx, apps/stroane-web/src/frontend/pages/SignUp.tsx, apps/stroane-web/src/frontend/styles/AccountPlaceholder.css, apps/stroane-web/src/frontend/styles/Auth.css, apps/stroane-web/src/components/Header.tsx, apps/stroane-web/src/components/FloatingHeader.tsx, apps/stroane-web/src/portal/PortalApp.tsx, apps/stroane-web/src/portal/components/AdminPortalLayout.tsx, apps/stroane-web/src/portal/api/adminCustomers.ts, apps/stroane-web/src/portal/pages/CustomerDirectory.tsx, apps/stroane-web/src/portal/styles/customer-directory.css, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/portal-architecture.md, docs/apps/stroane-web/implementation-notes.md.
Data impact: Adds an additive migration for customer accounts and optional order links. Existing orders remain valid with `customerId=null` until a matching customer profile is created or linked.
Security impact: Positive. Customer sessions use a distinct HttpOnly cookie and customer-token audience, customer profile/order endpoints read only the authenticated customer context, invite tokens are stored only as SHA-256 hashes, and customer auth endpoints are rate-limited. This entry was superseded on 2026-06-17 by open storefront signup with optional invite/checkout linking and hashed password-reset tokens. Staff CRM reads require `ADMIN`/`VIEWER`; CRM writes/invite generation require `ADMIN`.
Testing done: `node --check apps/stroane-web/backend/src/customerAccounts/routes.js`, `node --check apps/stroane-web/backend/server.js`, and `node --check apps/stroane-web/backend/src/ordersAdmin/routes.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. `git diff --check` passed.
Rollback notes: Revert the customer account migration/schema, backend customer/admin customer routers, storefront auth/account pages, portal CRM module, and docs. If the migration has already been applied, rollback requires a database migration that drops `CustomerAccount`, the enum, and the nullable order relation only after confirming no customer data must be retained.
Next step: Run the additive migration in the intended development database, smoke-test Paystack return profile creation and authenticated `/account` order history, then add a staff-facing customer detail/edit lightbox if CRM workflows need deeper editing.

### Portal table ellipsis polish

Date: 2026-06-17
Feature/change name: Portal table ellipsis polish
What changed:
- Added fixed table column definitions to the inventory stock table and portal orders table.
- Added ellipsis truncation for long table header/cell content while leaving action cells, empty states, and footer summaries unclipped.
- Corrected inventory table empty-state column spans and aligned the stock-value footer total under the Stock value column.
Why it changed: Long product, SKU, category, supplier, customer, source, and date content could stretch portal tables or make rows feel uneven.
Files changed: apps/stroane-web/src/portal/components/inventory/InventoryStockTable.tsx, apps/stroane-web/src/portal/pages/OrderManagement.tsx, apps/stroane-web/src/portal/styles/inventory-management.css, apps/stroane-web/src/portal/styles/order-management.css, docs/apps/stroane-web/progress-log.md.
Data impact: None. Styling and table markup only.
Security impact: None.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `git diff --check` passed for touched files.
Rollback notes: Revert the table `colgroup` additions and related CSS ellipsis rules.
Next step: Browser-smoke inventory and orders tables with deliberately long product/customer/supplier text.

### Shared field styling and contact validation cleanup

Date: 2026-06-17
Feature/change name: Shared field styling and contact validation cleanup
What changed:
- Replaced the remaining native storefront checkout select/date/time/datalist controls with shared `@faako/ui` `SelectField`, `DateField`, `TimeField`, `TextField`, and `TextareaField` controls.
- Added custom storefront delivery-area suggestion buttons so checkout keeps selectable address help without using native browser datalist styling.
- Adjusted inventory and orders portal grid alignment so KPI/analytics cards keep their natural height instead of stretching vertically to match neighboring content.
- Added shared frontend email/phone validation helpers and applied phone/email checks to checkout, contact enquiries, manual portal orders, and portal profile saves.
- Added matching backend phone validation to checkout/manual order preparation, catalogue/contact enquiries, profile updates, and inventory supplier/contact validation.
Why it changed: Stroane needs consistent shared UI styling across browsers and stronger data-quality checks before customer/admin contact data reaches order, profile, supplier, or inquiry records.
Files changed: apps/stroane-web/src/utils/contactValidation.ts, apps/stroane-web/src/frontend/components/checkout/CheckoutDetailsForm.tsx, apps/stroane-web/src/frontend/pages/Checkout.tsx, apps/stroane-web/src/frontend/pages/Contact.tsx, apps/stroane-web/src/frontend/styles/Checkout.css, apps/stroane-web/src/frontend/styles/Shop.css, apps/stroane-web/src/portal/pages/OrderManagement.tsx, apps/stroane-web/src/portal/pages/AdminPortalProfile.tsx, apps/stroane-web/src/portal/styles/inventory-management.css, apps/stroane-web/src/portal/styles/order-management.css, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/backend/src/inventory/validation.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/system-status.md.
Data impact: Existing data is not migrated. New/updated checkout, inquiry, profile, manual order, and supplier phone values must pass the stricter phone format validation.
Security impact: Positive. The backend now rejects malformed contact details on customer-facing and staff-facing write paths instead of relying on browser validation alone.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. `node --check` passed for `backend/src/orders.js`, `backend/src/catalogue.js`, `backend/src/routes/auth.js`, and `backend/src/inventory/validation.js`. `git diff --check` passed for the touched files. Static sweep found no remaining native `select`, `date`, `time`, or `datalist` controls in Stroane storefront/portal source.
Rollback notes: Revert the shared contact validation helper, checkout form shared-field conversion, portal card-alignment CSS edits, and backend phone validation updates. Existing persisted data is unaffected.
Next step: Browser-smoke checkout delivery/pickup and `/admin/orders`/`/admin/inventory` on Safari and Chrome to confirm the shared dropdown/date popovers render naturally in real devices.

### Portal analytics, orders module, and checkout fulfillment

Date: 2026-06-17
Feature/change name: Portal analytics, orders module, and checkout fulfillment
What changed:
- Added the private `/admin/orders` module with Reebs-style admin table pagination, order KPIs, manual order creation from priced catalogue products, order detail editing, fulfillment notes, and Paystack initialize/status-refresh actions.
- Added protected admin order API routes for listing, creating manual orders, updating order/fulfillment metadata, initializing Paystack, and refreshing Paystack status.
- Expanded the portal dashboard analytics to include order revenue/receivables, payment collection rate, average order value, stock value at risk, pricing coverage, and KPI drilldown modals.
- Made dashboard and inventory KPI/analytics cards open focused modal lists. Inventory drilldowns can open the selected product lightbox directly, including support for `/admin/inventory?item=<id>` deep links from the dashboard.
- Moved the profile module onto shared ERP field/action components and restored profile bio editing.
- Updated storefront checkout so customers choose delivery or pickup. Delivery uses a searchable/selectable address input, while pickup captures a selected pickup spot plus pickup date and time.
- Extended checkout/order preparation to store `deliveryMethod` and `expectedDeliveryDate` on commerce orders, preserving pickup/delivery metadata for the portal order workflow.
Why it changed: Stroane needs the portal to act as a business-management hub, not only a stock-management dashboard, and checkout needs clear fulfillment details before orders reach the operations team.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/ordersAdmin/routes.js, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/frontend/pages/Checkout.tsx, apps/stroane-web/src/frontend/components/checkout/CheckoutDetailsForm.tsx, apps/stroane-web/src/frontend/styles/Checkout.css, apps/stroane-web/src/portal/PortalApp.tsx, apps/stroane-web/src/portal/components/AdminPortalLayout.tsx, apps/stroane-web/src/portal/api/adminOrders.ts, apps/stroane-web/src/portal/pages/OrderManagement.tsx, apps/stroane-web/src/portal/pages/AdminPortalHome.tsx, apps/stroane-web/src/portal/pages/InventoryManagement.tsx, apps/stroane-web/src/portal/pages/AdminPortalProfile.tsx, apps/stroane-web/src/portal/components/dashboard/BusinessAnalyticsSection.tsx, apps/stroane-web/src/portal/styles/AdminPortal.css, apps/stroane-web/src/portal/styles/inventory-management.css, apps/stroane-web/src/portal/styles/order-management.css, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md.
Data impact: No migration was added. Existing additive `CommerceOrder` fields are now used by checkout and the admin order module. Manual order creation writes new commerce orders only when staff intentionally submit the protected form.
Security impact: Protected order APIs require `SiteUser` auth and admin role for writes. Storefront checkout still recalculates prices server-side and uses Paystack server-side initialization; Paystack paid state remains webhook-confirmed. No secrets are exposed to `VITE_*`.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. `node --check apps/stroane-web/backend/src/orders.js`, `node --check apps/stroane-web/backend/src/ordersAdmin/routes.js`, and `node --check apps/stroane-web/backend/server.js` passed. Local Vite preview checkout smoke passed for desktop and mobile: delivery address input renders, pickup shows three pickup spots plus date/time controls, and no horizontal overflow was detected.
Rollback notes: Revert the admin order router/client/page/styles, dashboard/inventory/profile drilldown changes, and checkout fulfillment edits. Existing orders remain intact; manually created orders should be reviewed rather than deleted automatically.
Next step: Browser-smoke checkout delivery and pickup paths plus authenticated `/admin/orders` Paystack actions against the intended development Paystack/Railway setup.

### Stroane page componentization pass

Date: 2026-06-16
Feature/change name: Stroane page componentization pass
What changed:
- Extracted the full-width inventory stock table and pagination into `src/portal/components/inventory/InventoryStockTable.tsx`.
- Extracted portal dashboard business analytics cards into `src/portal/components/dashboard/BusinessAnalyticsSection.tsx`.
- Extracted Checkout confirmation, customer details form, and order summary into `src/frontend/components/checkout/`.
- Reduced Checkout page orchestration from 449 lines to 253 lines while preserving the Paystack/order submission flow.
- Reduced InventoryManagement page weight by moving the large table/action-menu rendering into a dedicated component.
Why it changed: Long page modules were becoming hard to maintain and review. The new component boundaries keep page files focused on data flow and page-level orchestration while moving bulky UI rendering into named components.
Files changed: apps/stroane-web/src/portal/pages/InventoryManagement.tsx, apps/stroane-web/src/portal/components/inventory/InventoryStockTable.tsx, apps/stroane-web/src/portal/pages/AdminPortalHome.tsx, apps/stroane-web/src/portal/components/dashboard/BusinessAnalyticsSection.tsx, apps/stroane-web/src/frontend/pages/Checkout.tsx, apps/stroane-web/src/frontend/components/checkout/CheckoutConfirmation.tsx, apps/stroane-web/src/frontend/components/checkout/CheckoutDetailsForm.tsx, apps/stroane-web/src/frontend/components/checkout/CheckoutOrderSummary.tsx, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/implementation-notes.md.
Data impact: None. No API, database, order, payment, catalogue, inventory, or cart storage behavior changed.
Security impact: Neutral. Checkout still sends order/payment work through the existing backend APIs; extracted components do not store customer/payment data.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed after extraction. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning.
Rollback notes: Inline the extracted components back into their pages or revert the component files and page imports. No data rollback is required.
Next step: Continue extracting Search, Services, Shop, Product Detail, and the remaining inventory modal sections in later focused passes.

### Portal dashboard analytics and inventory table modal

Date: 2026-06-16
Feature/change name: Portal dashboard analytics and inventory table modal
What changed:
- Added dashboard business analytics for stock retail value, revenue-ready stock value, priced catalogue coverage, and supplier coverage.
- Added inventory stock-value calculations to the inventory hub KPI cards, table rows, selected-product summary, and table footer.
- Made Stock depth span the full analytics grid and open selected products in the management lightbox.
- Replaced the inventory workspace table with a full-width Reebs-style admin table including category, price, stock value, status, pagination, footer totals, and per-row actions.
- Moved selected product stock controls, catalogue management, and movement recording into a lightbox modal with previous/next product navigation.
- Added silent autosave support for inventory and catalogue edits while preserving explicit save buttons and existing offline queue behavior.
- Added row actions for managing, archiving, reactivating archived products, and safe "delete listing" removal through archived publishing status.
Why it changed: The portal dashboard should represent wider business management, not only stock counts, and the inventory module needed a full-width operations table with selected-product editing in a modal rather than a side panel.
Files changed: apps/stroane-web/src/portal/pages/AdminPortalHome.tsx, apps/stroane-web/src/portal/pages/InventoryManagement.tsx, apps/stroane-web/src/portal/context/InventoryManagementContext.tsx, apps/stroane-web/src/portal/styles/AdminPortal.css, apps/stroane-web/src/portal/styles/inventory-management.css, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/implementation-notes.md.
Data impact: None. No database writes, schema changes, inventory movements, catalogue seed updates, or order/payment data changes were made. Product "delete listing" is implemented as safe archive/unpublish behavior through the existing publishing API.
Security impact: Neutral/positive. Portal edits remain admin-gated, reuse existing HttpOnly cookie admin APIs, and silent autosave does not expose client/customer data.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed twice. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. `git diff --check -- apps/stroane-web/src/portal/pages/AdminPortalHome.tsx apps/stroane-web/src/portal/pages/InventoryManagement.tsx apps/stroane-web/src/portal/context/InventoryManagementContext.tsx apps/stroane-web/src/portal/styles/AdminPortal.css apps/stroane-web/src/portal/styles/inventory-management.css docs/apps/stroane-web/progress-log.md docs/apps/stroane-web/implementation-notes.md` passed.
Rollback notes: Revert the portal dashboard/inventory page/style/context changes. No data rollback is required because the actions use existing API semantics and no migration was added.
Next step: Smoke-test the authenticated portal table/modal in-browser after lint/build, then decide whether true hard-delete should exist as a separate audited backend operation.

### Storefront page flow and navigation pass

Date: 2026-06-16
Feature/change name: Storefront page flow and navigation pass
What changed:
- Replaced Resources placeholder guide links with real in-page guide summaries and deep-link targets for guides, FAQ, and referenced standards.
- Updated Search resource results to deep-link to the matching Resources section and restored the Search header to `100dvh`.
- Made route changes scroll to the top consistently while preserving hash-anchor scrolling.
- Changed scroll reveal behavior to a one-time opacity/translate animation without blur filters, backed by a visible-state CSS fallback, to avoid Safari/filter or fast-scroll hidden-state issues.
- Pruned stale/unpriced cart entries from the visible shop and checkout flows once catalogue data has loaded.
- Restored the four confirmed thermometer price-list products to the public catalogue source and Prisma seed so the storefront has a working priced-product cart/checkout path while newer unpriced products remain hidden from commerce.
- Gated direct unpriced product detail URLs behind a "not available online" state instead of showing inquiry-first product pages.
- Clarified customer profile actions versus the admin portal in the storefront account/sign-up/header copy.
- Cleaned footer store category links and replaced the placeholder WhatsApp link with the catalogue alternate phone number.
Why it changed: The storefront page-by-page pass needed broken/placeholder links removed, public navigation clarified, browser animation behavior stabilized, and stale cart state kept out of priced-product purchasing.
Files changed: apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/prisma/data/stroaneCatalogueSeed.json, apps/stroane-web/src/frontend/pages/Resources.tsx, apps/stroane-web/src/frontend/pages/Search.tsx, apps/stroane-web/src/frontend/pages/Shop.tsx, apps/stroane-web/src/frontend/pages/Checkout.tsx, apps/stroane-web/src/frontend/pages/ProductDetail.tsx, apps/stroane-web/src/frontend/pages/CustomerAccountPlaceholder.tsx, apps/stroane-web/src/frontend/pages/SignUp.tsx, apps/stroane-web/src/frontend/styles/Resources.css, apps/stroane-web/src/frontend/styles/Search.css, apps/stroane-web/src/frontend/styles/Shop.css, apps/stroane-web/src/frontend/styles/ProductDetail.css, apps/stroane-web/src/components/Header.tsx, apps/stroane-web/src/components/FloatingHeader.tsx, apps/stroane-web/src/components/Footer.tsx, apps/stroane-web/src/components/ScrollToTop.tsx, apps/stroane-web/src/hooks/useScrollAnimations.ts, apps/stroane-web/src/index.css.
Data impact: Source catalogue JSON and Prisma catalogue seed changed to restore four confirmed price-list products as priced/purchasable storefront items. No database writes, migrations, seed/reconcile runs, order, payment, inquiry, customer, or inventory data changed. Browser cart cleanup removes only stale client-side cart entries for products that are no longer priced in the loaded catalogue.
Security impact: Positive/neutral. Admin portal links are labelled as admin portal links, temporary storefront customer profile state remains non-sensitive, and no new customer data collection was added.
Testing done: `git diff --check` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite `NODE_ENV=production` env warning. Local Playwright smoke against `vite preview` passed across desktop pages, resource anchors, header search, Search `100dvh`, shop/cart/checkout flow, priced/unpriced product detail states, mobile overflow, and broken-image checks.
Rollback notes: Revert the page/component/style changes from this entry. No server or database rollback is required.
Next step: Enter confirmed physical stock counts for the restored priced products, then continue page-by-page polish only where smoke testing reveals issues.

### Admin cookie auth and customer placeholder hardening

Date: 2026-06-16
Feature/change name: Admin cookie auth and customer placeholder hardening
What changed:
- Moved Stroane portal admin authentication off JS-readable session tokens. Login and profile updates now set an HttpOnly admin cookie, logout clears it, and protected backend APIs accept the cookie with legacy bearer fallback during transition.
- Updated the portal API client to call protected admin routes with `credentials: "include"` and to store only staff profile metadata in `sessionStorage`.
- Removed browser-side storefront customer account/password-hash storage. The public signup page now saves only temporary name/email profile metadata for the placeholder account area.
Why it changed: Staff auth tokens and customer password hashes should not live in browser storage.
Files changed: apps/stroane-web/backend/src/auth.js, apps/stroane-web/backend/src/adminAuth.js, apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/backend/auth.test.js, apps/stroane-web/src/portal/api/adminSession.ts, apps/stroane-web/src/portal/api/adminInventory.ts, apps/stroane-web/src/portal/api/adminProducts.ts, apps/stroane-web/src/portal/context/AdminPortalContext.tsx, apps/stroane-web/src/context/AuthContext.tsx, apps/stroane-web/src/frontend/pages/SignUp.tsx, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/security-notes.md.
Data impact: No schema migration and no database writes. Existing browser `sessionStorage` portal sessions are normalized without preserving old token fields.
Security impact: Positive. Admin credentials moved to HttpOnly cookies, customer password-hash storage was removed from the storefront, and protected backend authorization remains the source of truth. Do not widen the admin cookie domain or switch to `SameSite=None` without a CSRF/subdomain-risk review.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed. `pnpm --filter @faako/stroane-web run lint` passed. `node --test apps/faako-api/src/demoAccess.test.mjs apps/stroane-web/backend/auth.test.js` passed. `pnpm run security:gate` passed. `pnpm run security:scan` passed.
Rollback notes: Revert the cookie-auth helpers/client fetch wrapper changes and restore bearer-token storage only if absolutely needed for a deployment hotfix. Do not restore browser-side customer password storage.
Next step: Add explicit CSRF tokens before broadening cookie scope or introducing same-site/cross-site staff workflows, then design real server-backed customer accounts separately.

### Storefront priced-commerce recovery, galleries, and update notice

Date: 2026-06-15
Feature/change name: Storefront priced-commerce recovery, galleries, and update notice
What changed:
- Restored the storefront shopping path around priced products: `/shop`, product detail, checkout, search/listing helpers, and cart summary now focus on products with numeric prices while preserving inquiry paths for quote-only/unpriced catalogue items.
- Reinstated add-to-cart and clear-basket affordances in the storefront, including the floating/header cart count path and designed clear-basket button.
- Updated frontend/backend purchase gating so explicit zero quantity, `out_of_stock`, preorder without backorder, and known insufficient quantity block checkout, while unknown quantity no longer blocks priced products during the current price-fill and inventory-backfill pass.
- Added/recorded transparent thermometer gallery assets from the supplied PDFs and kept primary images intact while appending gallery media in `src/data/stroaneCatalogue.json`.
- Confirmed Paystack development setup expectations: test secret/public keys can initialize a test transaction; `PAYSTACK_WEBHOOK_SECRET` can be blank in development because the backend falls back to `PAYSTACK_SECRET_KEY`, and `PAYSTACK_CALLBACK_URL` defaults to local `/checkout/return` unless supplied.
- Mounted the shared `AppUpdateNotice` so storefront/portal users are prompted, not forced, to refresh when a newer deployed bundle exists.
Why it changed: Stroane’s product pages and shop had drifted back toward inquiry-only behavior. The current client test path needs a simple priced-product checkout flow, usable product galleries, Paystack test readiness, and non-interruptive deploy prompts.
Files changed: apps/stroane-web/src/frontend/pages/Shop.tsx, apps/stroane-web/src/frontend/pages/ProductDetail.tsx, apps/stroane-web/src/frontend/pages/Checkout.tsx, apps/stroane-web/src/frontend/pages/Search.tsx, apps/stroane-web/src/frontend/pages/ProductList.tsx, apps/stroane-web/src/frontend/pages/Sitemap.tsx, apps/stroane-web/src/frontend/pages/Home.tsx, apps/stroane-web/src/context/CartContext.tsx, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/paystack.test.js, apps/stroane-web/backend/orders.test.js, apps/stroane-web/public/imgs/products/thermometers/*gallery*transparent.webp, apps/stroane-web/src/App.tsx, packages/ui/src/components/AppUpdateNotice.tsx, packages/ui/src/ui.css, apps/stroane-web/README.md, docs/apps/stroane-web/*, docs/platform/platform-progress-log.md.
Data impact: Source catalogue JSON and static product media changed. No database writes, migrations, seed/reconcile runs, order data, payment records, inventory movements, or customer data changed in this pass.
Security impact: Paystack secrets remain server-side. Storefront totals remain display-only; backend order creation and Paystack initialization still recalculate prices and enforce explicit stock blockers server-side. The update notice performs same-origin HTML checks and never sends cart/customer/payment data.
Testing notes: `git diff --check` passed. `apps/stroane-web/src/data/stroaneCatalogue.json` parsed successfully. Direct backend tests for priced checkout and Paystack helper behavior passed with 7 tests. Stroane TypeScript, lint, and narrow component TypeScript checks were attempted but did not complete in this shell and were interrupted.
Rollback notes: Revert the storefront/cart/product-detail/checkout changes, catalogue media additions, Paystack test additions, shared update notice wiring, and documentation updates. No data rollback is required unless the catalogue JSON has already been seeded into a database.
Next step: Enter confirmed physical counts for priced products, then smoke-test two updated product detail galleries plus the Paystack test checkout path on desktop and mobile Safari/Chrome.

### Stroane mobile inventory operations repair

Date: 2026-06-02
Feature/change name: Stroane mobile inventory operations repair
What changed:
- Replaced the wide desktop inventory table with phone-only stock records at mobile widths while preserving the full operational table on larger screens.
- Added an immediately visible `Adjust quantity` action to every mobile stock record so staff do not need to horizontally scroll to reach the movement workflow.
- Added phone-friendly inventory activity records so reviewing movement history does not reintroduce a wide-table layout viewport.
- Presented stock adjustments as a safe-area-aware mobile bottom sheet above the fixed portal navigation.
- Reduced nested inventory-shell width loss on phones and added an authenticated mobile Playwright workflow that records a restock movement from a stock record.
Why it changed: The desktop inventory table retained a `920px` minimum width on phones. Mobile Safari expanded its layout viewport around that table, stretched the fixed bottom navigation, and placed the quantity-adjustment control far beyond the visible screen.
Files changed: apps/stroane-web/src/pages/AdminInventory.tsx, apps/stroane-web/src/styles/pages/AdminInventory.css, apps/stroane-web/src/styles/pages/AdminPortal.css, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, docs/apps/stroane-web/progress-log.md.
Data impact: None. No stock values, catalogue records, suppliers, movements, schema, or migrations changed.
Security impact: None. Stock adjustments remain protected by the existing authenticated admin API and role checks.
Testing notes: `pnpm exec tsc -p tsconfig.app.json --noEmit`, `pnpm run lint`, and `pnpm run build` passed. The six focused portal Playwright checks passed, including the authenticated touch-sized inventory workflow that opens the phone adjustment sheet, records a restock, and asserts zero horizontal document overflow. A local `390x844` Chrome mobile render audit measured `innerWidth=390`, `htmlScroll=390`, a `358px` bottom navigation, and visible stock cards with quantity actions.
Rollback notes: Revert the phone-only stock/activity records, mobile bottom-sheet styles, inventory shell width adjustment, and mobile Playwright workflow assertion.
Next step: Run a hosted iPhone Safari smoke after deploying the Cloudflare Pages frontend update.

### Stroane collapsed portal rail polish

Date: 2026-06-01
Feature/change name: Stroane collapsed portal rail polish
What changed:
- Reduced shared collapsed ERP-sidebar panel and link padding so navigation icons fit inside the narrow rail without clipping.
- Limited collapsed sidebar navigation to vertical scrolling and constrained compact links to the rail width.
- Reworked the Stroane portal footer identity into an avatar plus username and role block.
- Kept the full identity visible in expanded mode while collapsed mode now shows the user avatar and an icon-only storefront shortcut.
- Added Playwright coverage that collapses the rail, confirms there is no horizontal navigation overflow, verifies that all module icons remain inside the rail, and checks the compact avatar state.
Why it changed: The collapsed portal rail retained expanded spacing and identity content, which clipped module icons, introduced horizontal scrolling, and cropped the signed-in user footer.
Files changed: packages/ui/src/ui.css, packages/theme/src/erp-shell.css, packages/ui/README.md, apps/stroane-web/src/components/admin/AdminPortalLayout.tsx, apps/stroane-web/src/styles/pages/AdminPortal.css, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, docs/apps/stroane-web/progress-log.md.
Data impact: None.
Security impact: None. Existing protected portal access and session handling remain unchanged.
Testing notes: `pnpm exec tsc -p tsconfig.app.json --noEmit`, `pnpm run lint`, `pnpm run build`, the six focused portal Playwright checks, and `git diff --check` passed. The loading-state mock delay was lengthened so its skeleton assertion remains deterministic during cold portal renders.
Rollback notes: Revert the compact shared rail spacing, Stroane footer markup/styles, and collapsed-rail Playwright assertions.
Next step: Deploy the Cloudflare portal frontend after review.

### Stroane portal emblem branding

Date: 2026-06-01
Feature/change name: Stroane portal emblem branding
What changed:
- Replaced the protected portal sidebar `ST` letter placeholder with the existing Stroane colour emblem.
- Extended the shared ERP sidebar branding type with an optional `sidebarMarkUrl` asset while preserving its existing letter-mark fallback for other apps.
- Set the Stroane portal emblem tile to white so the colour emblem remains clear against the blue sidebar panel.
- Added a Playwright regression assertion confirming that the portal shell renders the expected emblem asset.
Why it changed: The operations portal should carry the established Stroane emblem instead of a temporary text placeholder.
Files changed: apps/stroane-web/src/components/admin/AdminPortalLayout.tsx, apps/stroane-web/appSystem.js, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, packages/types/src/index.ts, packages/ui/src/ErpNavSidebar.tsx, packages/theme/src/erp-shell.css, packages/ui/README.md, docs/apps/stroane-web/progress-log.md.
Data impact: None.
Security impact: None. The logo asset is already public and portal access controls remain unchanged.
Testing notes: `pnpm exec tsc -p tsconfig.app.json --noEmit`, `pnpm run lint`, `pnpm run build`, the six focused portal Playwright checks, and `git diff --check` passed.
Rollback notes: Remove `sidebarMarkUrl` from the Stroane portal brand and revert the optional shared-shell emblem support.
Next step: Deploy the Cloudflare portal frontend after review.

### Stroane portal sidebar backing cleanup

Date: 2026-06-01
Feature/change name: Stroane portal sidebar backing cleanup
What changed:
- Removed the dark navy backing surface behind the protected ERP sidebar navigation.
- Preserved the blue gradient navigation panel, active-link contrast, sidebar controls, and mobile bottom navigation.
- Gave the light collapse control an explicit blue chevron, visible border, and blue-tinted hover state.
- Added Playwright regression assertions confirming that the outer desktop sidebar wrapper remains transparent and the collapse chevron remains visible.
Why it changed: The inset blue operations menu already provides the intended navigation surface. The additional dark wrapper background created an unnecessary heavy gutter behind it.
Files changed: apps/stroane-web/appSystem.js, apps/stroane-web/src/styles/pages/AdminPortal.css, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, docs/apps/stroane-web/progress-log.md.
Data impact: None. No catalogue, inventory, supplier, alert, order, payment, or customer data changed.
Security impact: None. Protected routes and staff auth remain unchanged.
Testing notes: Focused TypeScript, lint, and portal Playwright verification completed successfully.
Rollback notes: Restore `--erp-sidebar-bg` to `var(--color-primary-dark)`, remove the Stroane collapse-toggle CSS override, and revert the regression assertions.
Next step: Deploy the Cloudflare portal frontend after review.

### Stroane uncounted inventory display correction

Date: 2026-06-01
Feature/change name: Stroane uncounted inventory display correction and local portal bootstrap
What changed:
- Corrected the protected admin product mapper so an existing operational `InventoryItem` with an unknown physical count remains `null` instead of inheriting a catalogue-level zero.
- Updated the operations-overview `Available units` KPI to render `Not set` with an awaiting-count message when tracked inventory exists but no physical counts have been recorded.
- Added backend and Playwright regression coverage for uncounted stock so unknown availability remains distinct from confirmed zero stock.
- Seeded the configured development database with the existing normalized catalogue and applied the additive inventory bootstrap: 10 categories, 18 products, and 18 inventory placeholders.
- Fixed Express 5 API startup diagnostics so bind failures such as a duplicate local port report an actionable error and non-zero exit instead of printing a false listening message.
Why it changed: The public storefront can render its browser-safe fallback catalogue while the private portal depends on persisted operational inventory. Unknown physical counts were being presented as zero in the overview, which could be mistaken for confirmed out-of-stock data.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/products/services.js, apps/stroane-web/backend/products.test.js, apps/stroane-web/src/pages/AdminPortalHome.tsx, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, docs/apps/stroane-web/progress-log.md.
Data impact: Development only: added 10 normalized categories, 18 catalogue products, 18 inventory placeholders, and their additive bootstrap audit entries to the configured development database. No quantities were invented and no existing inventory rows were overwritten. Production was queried read-only: it has 18 inventory rows with unknown quantities, zero confirmed-zero inventory rows, and 24 catalogue rows including 6 archived legacy rows. No production writes were performed.
Security impact: None. The production audit was read-only, printed no credentials or recipient data, and preserved backend-only configuration.
Testing notes: Read-only development verification confirmed 18 inventory rows with `availableQuantity=null`, zero rows with confirmed zero stock, and 18 normalized catalogue products. Read-only production verification confirmed 18 inventory rows with `availableQuantity=null`, zero rows with confirmed zero stock, and the admin product mapper returning `null` availability for all currently uncounted products. `node --check backend/server.js`, `node --check backend/src/products/services.js`, `pnpm run test:backend` with 31 tests, `pnpm exec tsc -p tsconfig.app.json --noEmit`, `pnpm run lint`, `pnpm exec prisma validate`, and `pnpm run build` passed. The focused inventory Playwright suite passed with 6 tests after adding an explicit allowance for cold lazy-route transforms. An isolated development API smoke on port `3001` returned a healthy `/health` response and 18 products plus 10 categories from `/api/catalogue/products`.
Rollback notes: Revert the mapper, overview KPI, regression tests, and this documentation entry. Development bootstrap rows are additive and audit-backed; review them before removal. No production data rollback is required.
Next step: Record reviewed physical stock counts or restock movements through the protected portal, then deploy the API and Cloudflare portal updates so hosted staff see `Not set` until counts are entered.

### Stroane skeleton loading refinement

Date: 2026-06-01
Feature/change name: Stroane shared skeleton loading animation
What changed:
- Replaced the shared three-bar loading pulse with a structured animated skeleton surface.
- Added header, metric, and table-row placeholder blocks with a restrained shimmer animation.
- Expanded the lazy-loading page skeleton into a full-width, full-height viewport scaffold while retaining region-contained compact skeletons for operational panels.
- Realigned Stroane's shared `--sys-*` theme mappings with its existing `--color-*` tokens so shared portal UI resolves visible surfaces, accents, borders, and shadows consistently.
- Preserved compact loading states for private inventory, supplier, supplier-detail, and movement fetches while improving the full-page lazy portal transition.
- Added reduced-motion handling and Playwright coverage for the skeleton row structure.
Why it changed: Stroane loading transitions needed to feel more intentional and operationally polished while data is loading, without adding app-specific duplicate components.
Files changed: apps/stroane-web/appSystem.js, packages/ui/src/components/Feedback.tsx, packages/ui/src/ui.css, packages/ui/README.md, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, docs/apps/stroane-web/progress-log.md.
Data impact: None. No schema, migration, catalogue, inventory, supplier, alert, order, payment, or customer data changed.
Security impact: None. This is a shared presentation-only refinement.
Testing notes: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing local-env Vite `NODE_ENV=production` warning. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web run test:e2e` passed with 13 tests. A local Chrome render audit confirmed that the lazy page skeleton measures exactly to the viewport at `1440x1100` desktop and `390x844` phone sizes with zero horizontal overflow. A delayed private-inventory audit confirmed that the compact skeleton remains full-width within its operational region, renders three shimmer rows, and remains usable at both widths. `git diff --check -- packages/ui apps/stroane-web docs/apps/stroane-web` passed.
Rollback notes: Revert the shared skeleton markup, styles, E2E assertion, and documentation. No data rollback is required.
Next step: Reuse the shared skeleton in additional operational table states only where their loading lifecycle is already explicit.

### Stroane portal login site chrome

Date: 2026-06-01
Feature/change name: Stroane portal login site header and footer
What changed:
- Wrapped the private portal `/login` screen with the existing Stroane public header and footer.
- Added an optional storefront navigation base URL to the existing site layout, header, and footer so login-page links return to `https://stroanesolutions.com` rather than navigating inside the portal hostname.
- Kept authenticated `/admin/*` routes inside the operational ERP shell only.
- Added Playwright assertions for login-page chrome, storefront logo handoff, and the absence of storefront chrome after staff authentication.
Why it changed: Staff should recognize the Stroane site context when entering the operations portal, while the operational workspace should remain focused after sign-in.
Files changed: apps/stroane-web/src/PortalApp.tsx, apps/stroane-web/src/components/Layout.tsx, apps/stroane-web/src/components/Header.tsx, apps/stroane-web/src/components/Footer.tsx, apps/stroane-web/src/pages/AdminPortalSignIn.tsx, apps/stroane-web/src/styles/pages/AdminPortal.css, apps/stroane-web/tests/e2e/admin-products.spec.ts, docs/apps/stroane-web/portal-architecture.md, docs/apps/stroane-web/progress-log.md.
Data impact: None. No schema, migration, catalogue, inventory, supplier, alert, order, payment, or customer data changed.
Security impact: None. The login form and staff bearer-token flow are unchanged. Public chrome is mounted only around `/login`, and protected admin routes remain inside existing route guards and backend authorization.
Testing notes: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing local-env Vite `NODE_ENV=production` warning. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web exec playwright test tests/e2e/admin-products.spec.ts` passed with 8 tests. A local Chrome render audit confirmed visible login-page header and footer content, a storefront logo handoff to `https://stroanesolutions.com/`, and zero horizontal overflow at `1440px` desktop and `390px` phone widths. `git diff --check -- apps/stroane-web docs/apps/stroane-web` passed.
Rollback notes: Revert the login wrapper, external storefront navigation support, scoped login padding, tests, and documentation entry. No data rollback is required.
Next step: Perform a hosted portal login smoke test after the next Cloudflare Pages deployment.

### Stroane API schema-readiness hardening and blue portal sidebar

Date: 2026-05-31
Feature/change name: Stroane API schema-readiness hardening and blue portal sidebar
What changed:
- Anchored backend `.env` and `.env.development` loading to `apps/stroane-web` so API database resolution no longer depends on the shell working directory.
- Added safe Prisma `P2021`/`P2022` handling: schema-readiness failures now return an actionable `503` response instead of an opaque `500`.
- Added Prisma error codes to sanitized backend logs without exposing connection strings or database values.
- Added shared ERP-shell token overrides for a Stroane blue portal sidebar and adjusted portal footer contrast with existing Stroane tokens.
- Removed an unused `Layout` import from the portal sign-in page so the existing sign-in work continues to pass TypeScript checks.
Why it changed: The portal inventory, product, and alert reads were reporting missing-column errors from a running API process even though both configured Stroane databases had the additive migrations recorded. The runtime should consistently load Stroane-owned env files and fail with a useful operational message if a deployed schema is genuinely behind.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/appSystem.js, apps/stroane-web/src/styles/pages/AdminPortal.css, apps/stroane-web/src/pages/AdminPortalSignIn.tsx, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md.
Data impact: None. No schema, migration, seed, catalogue, stock, supplier, alert, order, payment, or customer data changed.
Security impact: Positive operational hardening. Error responses remain customer-safe, logs include only sanitized message/code metadata, and backend env lookup remains server-side.
Testing notes: Both `APP_ENV=development` and `APP_ENV=production` Prisma migration status checks reported all 11 migrations applied. Read-only service smoke queries passed for inventory, admin products, and inventory-alert summaries against both configured databases. A monorepo-root API launch resolved the Stroane development environment and reached the listening state. `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 30 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing local-env Vite `NODE_ENV=production` warning. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web run test:e2e` passed with 12 tests. A local Chrome render audit confirmed a blue-to-navy sidebar gradient, white sidebar text, one portal sidebar instance, and zero horizontal overflow. `git diff --check -- apps/stroane-web docs/apps/stroane-web` passed.
Rollback notes: Revert the app-relative dotenv paths, safe schema-readiness mapping, Stroane ERP-shell token overrides, footer contrast adjustment, and this documentation entry. No data rollback is required.
Next step: Restart any already-running local API process with `pnpm run dev:stroane`. For Railway, redeploy the API after `pnpm --filter @faako/stroane-web run db:deploy:prod` so the process reloads generated Prisma code and production env.

### Stroane ERP operations overview design foundation

Date: 2026-05-31
Feature/change name: Stroane ERP operations overview design foundation
What changed:
- Replaced the private `/admin` static link directory with a live operational overview.
- Added protected API-backed dashboard KPI tiles for catalogue products, tracked stock, available units, reserved units, low-stock items, out-of-stock items, draft products, and active suppliers.
- Added compact catalogue-readiness indicators for publication, stock-tracking, and supplier-link coverage.
- Added a stock-attention work queue for low-stock, reorder, out-of-stock, unavailable, and manual-review inventory items.
- Added a compact recent inventory movement feed and retained direct links into inventory, suppliers, products, and order operations.
- Added resilient partial-data handling so one unavailable admin API does not collapse the full portal overview.
- Updated Playwright coverage for the signed-in overview, stock attention signals, and recent movement rendering.
Why it changed: The separated Stroane portal had the right route and shell architecture, but its entry screen was still a static directory. Staff need an operational first view that helps them decide where to work without turning Stroane into a full ERP.
Files changed:
- apps/stroane-web/src/pages/AdminPortalHome.tsx
- apps/stroane-web/src/components/admin/AdminPortalLayout.tsx
- apps/stroane-web/src/styles/pages/AdminPortal.css
- apps/stroane-web/tests/e2e/admin-products.spec.ts
- apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts
- docs/apps/stroane-web/portal-architecture.md
- docs/apps/stroane-web/progress-log.md
Data impact: None. Existing protected read APIs are reused. No schema, migration, seed, catalogue, inventory movement, supplier, order, payment, or storefront data changes.
Security impact: None. The overview remains inside existing `RequireAdminAuth` and `RequirePortalAccess` route guards and uses the existing protected bearer-auth admin APIs. No internal data is exposed to public storefront routes.
Testing notes: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 30 tests. `pnpm --filter @faako/stroane-web run build` passed with the existing local-env Vite `NODE_ENV=production` warning. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web run test:e2e` passed with 12 tests after making the existing product loading-state mock deterministic. Coverage includes public fallback catalogue behavior, protected portal routes, portal login/logout, stock alerts, dashboard KPI and readiness rendering, product API error/loading/empty states, authenticated product edits, and mobile portal behavior. A built-preview Chrome screenshot audit confirmed eight KPI tiles, three readiness progress indicators, and zero horizontal overflow at `1440px` desktop and `390px` phone widths. `git diff --check -- apps/stroane-web docs/apps/stroane-web` passed.
Rollback notes: Revert the overview component, scoped portal styles, E2E updates, and documentation entry. Existing admin routes and API behavior remain intact.
Next step: Continue with a dedicated supplier operations page and a compact settings surface for alert preferences, while keeping procurement and warehouse automation deferred.

### Stroane storefront and portal subdomain separation

Date: 2026-05-31
Feature/change name: Stroane storefront and portal subdomain separation
What changed: Refactored the Stroane frontend into lazy storefront and portal application surfaces. The public Cloudflare Pages surface keeps catalogue, product, checkout, and informational routes. The operational Cloudflare Pages surface owns `/login` and protected `/admin/*` routes on `portal.stroanesolutions.com`. Public sign-in actions and legacy apex auth/admin requests hand off to the portal host; legacy portal `/admin/signin` redirects to `/login`. Railway API CORS now includes the portal origin. Localhost keeps a combined compatibility surface for development and Playwright.
Why it changed: Match the REEBS-style public-versus-portal architecture while keeping Stroane storefront browsers from loading operational shell and admin workflow chunks unnecessarily.
Files changed: apps/stroane-web/src/App.tsx, apps/stroane-web/src/StorefrontApp.tsx, apps/stroane-web/src/PortalApp.tsx, apps/stroane-web/src/config/appSurface.ts, apps/stroane-web/src/components/ExternalRedirect.tsx, apps/stroane-web/src/components/Header.tsx, apps/stroane-web/src/components/FloatingHeader.tsx, apps/stroane-web/src/components/admin/AdminPortalLayout.tsx, apps/stroane-web/src/components/admin/RequireAdminAuth.tsx, apps/stroane-web/src/components/admin/RequirePortalAccess.tsx, apps/stroane-web/src/pages/AdminPortalSignIn.tsx, apps/stroane-web/src/pages/AdminPortalHome.tsx, apps/stroane-web/src/pages/AdminPortalPlaceholder.tsx, apps/stroane-web/src/pages/AdminOrders.tsx, apps/stroane-web/src/pages/AdminInventory.tsx, apps/stroane-web/src/pages/AdminProducts.tsx, apps/stroane-web/src/pages/CustomerAccountPlaceholder.tsx, apps/stroane-web/src/pages/SignUp.tsx, apps/stroane-web/src/main.tsx, apps/stroane-web/backend/security.js, apps/stroane-web/backend/security.test.js, apps/stroane-web/playwright.config.ts, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, apps/stroane-web/tests/e2e/admin-products.spec.ts, apps/stroane-web/.env.example, Stroane docs.
Data impact: None. No schema, migration, seed, catalogue, inventory, supplier, order, payment, alert, or customer records changed.
Security impact: Positive separation. Portal bearer tokens remain origin-scoped in `sessionStorage`, protected APIs remain authoritative, CORS allows the explicit portal origin, and no broad `.stroanesolutions.com` auth cookie was introduced.
Testing done: `node --check apps/stroane-web/backend/server.js` and `node --check apps/stroane-web/backend/security.js` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 30 tests. `pnpm run security:gate` passed. `pnpm --filter @faako/stroane-web run build` passed. Explicit `VITE_APP_SURFACE=storefront` and `VITE_APP_SURFACE=portal` Vite builds passed. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web run test:e2e` passed with 11 tests after widening the local assertion timeout for cold lazy-surface transforms. A headless Chrome production-preview request audit confirmed `/catalogue` loads the `StorefrontApp` chunk with zero `PortalApp` requests and keeps fallback catalogue behavior, while `/login` loads the `PortalApp` chunk with zero `StorefrontApp` requests. `git diff --check` passed.
Rollback notes: Revert the surface router, external handoff links, portal URL changes, CORS addition, and documentation. Existing API auth tokens and data remain compatible.
Next step: Create the second Cloudflare Pages portal project, bind `portal.stroanesolutions.com`, set surface-specific `VITE_*` values, redeploy Railway CORS config, and perform hosted login/logout plus protected-route smoke testing.

### Stroane shared-boundary realignment audit

Date: 2026-05-31
Feature/change name: Stroane shared-boundary realignment audit
What changed: Reviewed Stroane public storefront, future account placeholders, protected staff portal, inventory-owner alerts, shared shell adoption, API helpers, auth strategy, and notification helpers against current Faako platform patterns. Kept app-specific catalogue, inventory, supplier, alert orchestration, and bearer-auth behavior local. Replaced the alert module's duplicated text cleanup with the shared `@faako/notifications` sanitizer and documented the extraction boundary.
Why it changed: Stroane needs to stay aligned with the Faako platform without pushing client-specific persistence and state transitions into shared packages prematurely.
Files changed: apps/stroane-web/package.json, apps/stroane-web/backend/src/inventoryAlerts/notifications.js, docs/apps/stroane-web/portal-architecture.md, docs/apps/stroane-web/progress-log.md, docs/platform/architecture.md, docs/platform/faako-client-app-boundaries.md, docs/platform/platform-progress-log.md, pnpm-lock.yaml.
Data impact: None. No Stroane schema, migration, seed, stock quantity, supplier, order, payment, customer, or alert-state writes changed.
Security impact: Positive low-risk alignment. Inventory notifications now use a shared control-character-safe sanitizer while recipient configuration, supplier notes, dispatch audit metadata, and backend secrets remain private.
Testing done: `pnpm --filter @faako/notifications run test` passed with 5 tests. `pnpm --filter @faako/stroane-web run test:backend` passed with 30 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web run test:e2e` passed with 9 tests, including public fallback, protected portal, inventory alerts, product operations, and mobile coverage. `pnpm run security:gate`, `pnpm run monitoring:check`, and `git diff --check` passed.
Rollback notes: Revert the shared sanitizer import, workspace dependency, lockfile update, and boundary documentation. Existing inventory alert behavior and persisted rows remain compatible.
Next step: Keep backend email transport app-owned until sender, audit, retry, and idempotency contracts are reviewed across apps.

### Stroane operational inventory owner alerts

Date: 2026-05-31
Feature/change name: Stroane low-stock and out-of-stock operational notifications
What changed: Added an additive inventory-owner alert foundation around the existing Stroane inventory mutation services. Published, active, tracking-enabled products are scanned for low stock, reorder-threshold pressure, out-of-stock state, and recovery after restock. Durable `InventoryAlert` rows keep state and cooldown timestamps; `InventoryAlertDispatch` rows record safe channel attempts without storing recipient addresses or WhatsApp numbers. Added grouped backend-only Resend summaries, provider-neutral WhatsApp message preparation, authenticated manual scans, a scheduler-secret internal scan route, post-commit mutation scans, owner-alert counts in the protected inventory portal, and row-level restock recommendations. Added backend and Playwright coverage for alert logic, exclusions, cooldown deduplication, protected routes, desktop rendering, and mobile rendering.
Why it changed: Stroane owners need actionable inventory warnings before procurement automation or order allocation exists, while public catalogue reads must remain side-effect free and internal recipient details must remain private.
Files changed: apps/stroane-web/.env.example, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260531000000_add_inventory_alert_foundation/migration.sql, apps/stroane-web/backend/server.js, apps/stroane-web/backend/inventory-alerts.test.js, apps/stroane-web/backend/src/inventory/controllers.js, apps/stroane-web/backend/src/inventory/services.js, apps/stroane-web/backend/src/inventory/validation.js, apps/stroane-web/backend/src/inventoryAlerts/controllers.js, apps/stroane-web/backend/src/inventoryAlerts/notifications.js, apps/stroane-web/backend/src/inventoryAlerts/routes.js, apps/stroane-web/backend/src/inventoryAlerts/services.js, apps/stroane-web/src/api/adminInventory.ts, apps/stroane-web/src/pages/AdminInventory.tsx, apps/stroane-web/src/styles/pages/AdminInventory.css, apps/stroane-web/tests/e2e/admin-inventory-alerts.spec.ts, docs/apps/stroane-web/api.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md.
Data impact: Additive migration `20260531000000_add_inventory_alert_foundation` adds `InventoryItem.inventoryTrackingEnabled` defaulting to `true`, plus `InventoryAlert` and `InventoryAlertDispatch`. Existing catalogue, supplier, order, payment, customer, and fallback records are not removed or rewritten. Stock mutations may create or update private alert/audit rows after migration deploy.
Environment impact: Railway API can set backend-only `STROANE_ALERT_EMAILS`, `STROANE_ALERT_WHATSAPP_NUMBERS`, `STROANE_ALERT_FROM`, `STROANE_ALERT_REPLY_TO`, `STROANE_ALERT_COOLDOWN_MINUTES`, and `STROANE_ALERT_CRON_SECRET`. Email delivery also uses existing backend-only `RESEND_API_KEY`. Cloudflare Pages requires no new values.
Security impact: Positive. Recipient configuration and scheduler secrets remain server-side; public catalogue routes never trigger scans; alert APIs require bearer-protected staff auth or a timing-safe scheduler-secret check; configured contact values are not returned to browsers or persisted in dispatch rows; and skipped provider configuration does not fail committed inventory changes.
Testing done: `node --check` passed for the server, inventory alert services/notifications/routes, and inventory controllers. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 30 tests. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm --filter @faako/stroane-web run test:e2e` passed with 9 Playwright tests. `pnpm --filter @faako/stroane-web run build` passed. `git diff --check -- apps/stroane-web docs/apps/stroane-web` passed. Migration inspection found no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM`. Public fallback verification returned 18 products with no alert/internal fields, and the product asset directory still contains 57 files.
Rollback notes: Revert the alert modules, post-mutation scan calls, protected alert routes, owner-alert portal summary, env/docs, schema, and migration. If the migration has already deployed, archive any needed alert dispatch audit rows before removing the two new private tables and the tracking flag in a separately reviewed forward migration.
Known gaps: Railway cron scheduling is documented but not provisioned in repo code. WhatsApp delivery is intentionally not connected to a provider. Resend sender-domain readiness, owner recipient approval, real Railway migration deployment, and authenticated production smoke testing remain operational steps.
Next step: Deploy the additive migration, configure approved Railway recipients and scheduler secret, run a private admin manual scan, confirm immediate-repeat cooldown behavior, then provision the Railway scheduled call.

### Stroane admin product and media operations workflow

Date: 2026-05-30
Feature/change name: Stroane admin product and media operations workflow
What changed: Added the first protected `/admin/products` operational workflow inside the separated Stroane staff portal. The page uses shared `@faako/ui` ERP table, filter, field, select, badge, action, and drawer patterns for searchable/filterable product rows; stock and preferred-supplier visibility; edit-light product copy, SKU, pricing, category, and tag fields; validated thumbnail/gallery path previews; draft/active/archived publishing; featured state; and private preferred-supplier selection, product code, and notes. Added modular protected product route/controller/service/validation layers and endpoints for product list/detail, product edits, media edits, publishing edits, and preferred-supplier edits. Public catalogue persistence reads now require active published rows and omit legacy supplier/cost internals. Split the browser-safe public fallback from the server-side Prisma import seed so source references, review flags, review notes, and operations-only specifications do not enter the Cloudflare Pages bundle. Added a shared ERP form-label association fix so visible labels correctly target inputs, selects, and textareas. Added Playwright coverage for public fallback, portal protection, loading/error/empty states, authenticated product mutation workflow, and mobile product cards.
Why it changed: Stroane staff need a small operational product-management layer before direct uploads, procurement, inventory automation, order allocation, or broader ERP workflows. The storefront must remain safe when Railway is unavailable, and private supplier details must never drift into public catalogue responses.
Files changed: apps/stroane-web/package.json, apps/stroane-web/playwright.config.ts, apps/stroane-web/tests/e2e/admin-products.spec.ts, apps/stroane-web/backend/server.js, apps/stroane-web/backend/products.test.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/src/products/routes.js, apps/stroane-web/backend/src/products/controllers.js, apps/stroane-web/backend/src/products/services.js, apps/stroane-web/backend/src/products/validation.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/prisma/data/stroaneCatalogueSeed.json, apps/stroane-web/prisma/migrations/20260530000000_add_catalogue_product_publishing_fields/migration.sql, apps/stroane-web/src/App.tsx, apps/stroane-web/src/api/adminProducts.ts, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/pages/AdminProducts.tsx, apps/stroane-web/src/styles/pages/AdminProducts.css, apps/stroane-web/src/utils/productMedia.ts, apps/stroane-web/README.md, packages/ui/src/components/ERPForm.tsx, packages/ui/README.md, pnpm-lock.yaml, docs/apps/stroane-web/api.md, docs/apps/stroane-web/catalogue-architecture.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md.
Data impact: Additive migration `20260530000000_add_catalogue_product_publishing_fields` adds nullable `compareAtPrice`, non-null `publishingStatus` defaulting to `active`, non-null `isFeatured` defaulting to `false`, and supporting indexes. Existing catalogue rows remain visible after migration. Intentional admin edits append `InventoryAuditEntry` records. No destructive migration, product deletion, inventory deduction, order allocation, payment change, customer-account change, or storefront fallback change was added.
Environment impact: No environment variable changes. Cloudflare Pages still needs browser-safe `VITE_API_BASE_URL`; Railway API still owns `DATABASE_URL`, `APP_ENV`, `NODE_ENV`, `APP_AUTH_SECRET`, and other backend-only secrets.
Security impact: Product routes use existing backend `SiteUser` bearer auth. `ADMIN` can mutate; `ADMIN` and `VIEWER` can read. Media validation allows only safe `/imgs/products/` paths with supported extensions. Empty supplier mutations cannot silently clear a preferred link. Public catalogue APIs, including server-side JSON-seed fallback responses, omit supplier references, supplier notes, internal cost fields, catalogue import/review metadata, drafts, and archived products. The checked-in browser fallback is now separately sanitized so seed-only source references, review flags, review notes, and operations-only specifications stay outside the frontend bundle.
Testing done: `node --check` passed for the Stroane server, catalogue adapter, catalogue seed, order helper, and product route/controller/service/validation modules. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run test:backend` passed with 23 tests. `pnpm --filter @faako/stroane-web run test:e2e` passed with 6 Playwright tests using local headless Chrome. `pnpm --filter @faako/stroane-web run build` passed. `git diff --check -- apps/stroane-web docs/apps/stroane-web packages/ui pnpm-lock.yaml` passed. Asset verification found 57 product files and zero missing JSON-referenced `/imgs/products/` assets. Migration inspection found no destructive SQL.
Rollback notes: Revert the protected product modules/routes, admin product page/client/styles/media helper, Playwright setup/tests, public mapper privacy refinement, seed/schema/migration, shared ERP label association fix, lockfile dependency update, and docs. If the migration has been deployed and product operations used, export `CatalogueProduct` publishing fields and related `InventoryAuditEntry` records before rolling back.
Known gaps: Direct file upload, external media hosting, product creation, category editing, bulk product editing, variant editing, full supplier CRUD UI, initial stock-item setup UI, order allocation, and automatic inventory reservation/deduction remain intentionally deferred. The checked-in browser fallback remains a public outage snapshot and cannot observe Railway publishing changes while the API is unavailable; archiving an existing fallback product requires updating that snapshot and redeploying Cloudflare Pages. Real Railway `ADMIN` and `VIEWER` smoke testing should follow deployment.
Next step: Deploy the additive migration and Railway API, run a private admin/viewer acceptance pass against `/admin/products`, then add focused product creation/category setup only after the edit-light workflow is accepted.

### Stroane storefront, account, and operations portal separation

Date: 2026-05-30
Feature/change name: Stroane architecture separation
What changed: Separated public storefront routes, future customer account placeholders, and internal staff operations into distinct browser route areas. Added a dedicated `/admin/signin` page, centralized staff session provider, `RequireAdminAuth` and `RequirePortalAccess` guards, and a shared `@faako/ui` ERP shell with desktop sidebar, topbar, and mobile bottom navigation. Moved inventory, supplier, and order operations under protected `/admin/*` routes; retained `/admin/orders` as a compatibility alias; added `/catalogue`; and prepared customer-only `/account`, `/orders`, and `/quotes` placeholders. Removed the duplicated two-link admin mini-nav and the staff-auth fallback from public `/signin`. Added Stroane-local Vite router deduplication so shared shell links resolve against the app router context.
Why it changed: Stroane public customer account assumptions and internal operations access were mixed together. Staff operations now have a clear private doorway and portal shell without exposing ERP navigation through the storefront.
Files changed: apps/stroane-web/src/App.tsx, apps/stroane-web/src/main.tsx, apps/stroane-web/src/api/adminOrders.ts, apps/stroane-web/src/context/AdminPortalContext.tsx, apps/stroane-web/src/components/admin/AdminPortalLayout.tsx, apps/stroane-web/src/components/admin/RequireAdminAuth.tsx, apps/stroane-web/src/components/admin/RequirePortalAccess.tsx, apps/stroane-web/src/components/AdminSectionNav.tsx (removed), apps/stroane-web/src/pages/AdminPortalSignIn.tsx, apps/stroane-web/src/pages/AdminPortalHome.tsx, apps/stroane-web/src/pages/AdminPortalPlaceholder.tsx, apps/stroane-web/src/pages/CustomerAccountPlaceholder.tsx, apps/stroane-web/src/pages/AdminOrders.tsx, apps/stroane-web/src/pages/AdminInventory.tsx, apps/stroane-web/src/pages/SignIn.tsx, apps/stroane-web/src/pages/SignUp.tsx, apps/stroane-web/src/styles/components/AdminSectionNav.css (removed), apps/stroane-web/src/styles/pages/AdminPortal.css, apps/stroane-web/src/styles/pages/AccountPlaceholder.css, apps/stroane-web/vite.config.ts, apps/stroane-web/README.md, docs/apps/stroane-web/portal-architecture.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md.
Data impact: None. No schema, migration, seed, catalogue, inventory, supplier, order, payment, or customer data writes.
Security impact: Positive separation. Public customer localStorage auth no longer attempts backend staff login. Staff sessions use the dedicated `/admin/signin` entrypoint, route guards, and backend bearer-protected APIs. Frontend guards are navigation boundaries only; backend authorization remains authoritative.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing local-env Vite warning about `NODE_ENV=production`. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec node --test backend/inventory.test.js backend/security.test.js backend/paystack.test.js` passed with 15 tests. `git diff --check` passed. Source inspection confirmed API-first catalogue fallback remains unchanged, 22 `/imgs/products/` references resolve with 0 missing files, public `/signin` no longer invokes backend staff login, and protected `/admin/*` route guards wrap the ERP shell. A headless Chrome preview smoke test caught and then verified the Stroane-local `react-router-dom` dedupe fix: unauthenticated `/admin` redirects to `/admin/signin`; public `/catalogue` and `/account` render with zero ERP shells; catalogue fallback remains visible without an API; and a render-only `VIEWER` session mounts the `/admin/inventory` ERP shell with the expected title and no runtime errors.
Rollback notes: Revert the Stroane portal provider, guards, shell, route wiring, dedicated staff sign-in, placeholder pages, admin wrapper cleanup, and docs. No database rollback is required.
Known gaps: Customer account placeholders remain frontend-only and expose no private server data. Portal bearer tokens remain in `sessionStorage` as a transitional staff-session strategy. Product, reports, and settings portal pages are intentionally placeholders.
Next step: Smoke-test `/admin/signin`, `/admin/inventory`, `/admin/suppliers`, and `/admin/operations` against the redeployed Railway API, then define the protected product setup workflow without broadening customer account scope.

### Stroane Railway API production wiring and Cloudflare Pages deployment completion

Date: 2026-05-30
Feature/change name: Stroane API deployment and production wiring
What changed: Audited the Stroane Railway API contract, existing route mounts, Cloudflare frontend API helper, CORS allow-list, Prisma migration set, package scripts, and internal inventory UI API usage. Added a Cloudflare Pages-native `public/_headers` file with the static frontend security policy and Railway API connection allowance, removed the obsolete `netlify.toml` deployment artifact and Netlify-specific postinstall branch, tightened public category loading so persisted categories are used only when published persisted products exist, and made missing database configuration fail fast with a safe Railway startup message. Updated deployment, environment, API, pre-deploy, security, README, and system-status notes with the Railway generate/migrate/start sequence, Cloudflare Pages environment boundary, DNS notes, smoke tests, and rollback guidance.
Why it changed: Stroane now has a deployed Cloudflare Pages frontend and Railway API, but production wiring needed one authoritative deployment path. A partially seeded Railway database was also returning older database categories beside seed-fallback products, which made the public catalogue source inconsistent during rollout.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/package.json, apps/stroane-web/public/_headers, apps/stroane-web/netlify.toml (removed), apps/stroane-web/README.md, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/pre-deploy-checklist.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md.
Data impact: No schema, migration, seed, catalogue record, inventory record, order, payment, or customer data writes. The public category response now falls back to the normalized JSON seed when Railway Postgres has categories but no published persisted products.
Security impact: Positive. Cloudflare Pages now owns a checked-in static header policy, frontend CSP connects to the Railway API and existing Paystack browser asset only, the backend keeps allow-list CORS and protected admin routes, and Netlify config is no longer part of Stroane deployment. Rotate any auth secret that has appeared in chat, screenshots, tickets, or logs and configure Railway with `APP_AUTH_SECRET`.
Testing done: `node --check` passed for `backend/server.js`, `backend/src/catalogue.js`, and the existing inventory route/controller/service/validation modules. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec node --test backend/inventory.test.js backend/security.test.js backend/paystack.test.js` passed with 15 tests. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed and copied `public/_headers` to `dist/_headers`. `git diff --check` passed. Product image verification found 22 unique `/imgs/products/` files and 0 missing references. Migration inspection found the existing nine forward-only migration directories and no destructive `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` statements. A no-database startup probe returned the intended safe configuration error. A production-style startup probe printed the expected server startup banner. Live Railway read-only smoke tests returned `200` for `/health`, canonical catalogue reads, product detail, and legacy catalogue aliases; the allowed Stroane origin preflight returned `204`; an unrelated origin returned `403`. The currently deployed Railway service still returns `404` for `/api/admin/inventory`, confirming that this workspace deployment remains required.
Rollback notes: Restore `netlify.toml` only if Stroane intentionally returns to Netlify. Otherwise revert `public/_headers`, the category source-coherence guard, and related docs. No database rollback is required.
Known gaps: The live Railway API currently responds successfully, but production catalogue data still needs intentional review before any catalogue seed refresh. Authenticate against the production `SiteUser` table after migrations are deployed and smoke-test `/admin/inventory` with private staff credentials.
Next step: Redeploy the Railway API with the documented generate/migrate/start sequence, redeploy Cloudflare Pages so `_headers` and `VITE_API_BASE_URL` are baked into the frontend, then perform authenticated admin inventory smoke testing.

### Stroane internal inventory operations dashboard layer

Date: 2026-05-30
Feature/change name: Stroane internal inventory operations dashboard layer
What changed: Added a protected `/admin/inventory` operations screen that consumes the existing admin inventory/supplier API. The screen provides searchable, filterable, sortable inventory visibility; available/reserved/reorder quantities; low-stock and unavailable badges; linked suppliers; updated timestamps; supplier list/detail review with admin-only notes and contacts; recent inventory movement history; and lightweight audited restock, manual adjustment, correction, damage, reserved, and released quantity entry. Added a shared admin section nav between orders and inventory. Staff sign-in now returns users to an intended `/admin/...` destination after backend staff authentication.
Why it changed: Stroane staff need a small operational layer for stock and supplier work before procurement, warehouse allocation, ecommerce automation, or broader ERP workflows are introduced.
Files changed: apps/stroane-web/src/App.tsx, apps/stroane-web/src/api/adminInventory.ts, apps/stroane-web/src/components/AdminSectionNav.tsx, apps/stroane-web/src/pages/AdminInventory.tsx, apps/stroane-web/src/pages/AdminOrders.tsx, apps/stroane-web/src/pages/SignIn.tsx, apps/stroane-web/src/styles/components/AdminSectionNav.css, apps/stroane-web/src/styles/pages/AdminInventory.css, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md.
Data impact: No schema or migration changes. Inventory writes happen only when an authenticated `ADMIN` intentionally submits an existing inventory-item movement. The UI does not automatically reserve stock, deduct stock for orders, or modify storefront fallback data.
Security impact: The internal dashboard reads only through protected `/api/admin/*` endpoints. Existing bearer auth is reused. `VIEWER` users can review stock, suppliers, and activity but do not receive adjustment actions. `ADMIN` users can record movements. Supplier internal notes and movement history remain behind backend auth and are not added to public catalogue responses.
Testing done: `pnpm --filter @faako/stroane-web run build` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `node --test apps/stroane-web/backend/inventory.test.js` passed with 5 tests. `node --check` passed for `backend/server.js` and the inventory service/controller/route modules. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `git diff --check` passed. Product image reference verification found 22 `/imgs/products/` references and 0 missing files. Storefront catalogue helper inspection confirmed local-seed fallback remains unchanged. A sandbox runtime probe emitted the backend startup banner but the sandbox released the listener before local `curl` could reach it; perform final authenticated browser smoke testing through `pnpm run dev:stroane` or the deployed Railway API.
Rollback notes: Revert the inventory dashboard API client, route, page, shared internal nav, sign-in redirect refinement, styles, and docs. No data rollback is required unless staff have intentionally recorded inventory movements while testing.
Known gaps: Initial stock-item setup, supplier creation/editing, and product-supplier linking remain protected API/admin setup tasks. This UI is intentionally focused on visibility and audited movements for already configured inventory items. Orders do not reserve or deduct inventory yet.
Next step: Confirm production `SiteUser` auth and real inventory records in Railway, run a logged-in browser smoke test for `ADMIN` and `VIEWER`, then add a small protected stock-item setup editor and supplier editor before procurement workflow work.

### Stroane development database auth migration diagnosis

Date: 2026-05-30
Feature/change name: Stroane development database auth migration diagnosis
What changed: Confirmed the configured development Railway Postgres database had not received the nine Stroane migrations, including `20260511000000_add_site_users`, which explained the local `P2021` login failure for `public.SiteUser`. Updated the private CSV user seed helper so it loads environment-specific config safely. The default `db:seed` command now explicitly targets `.env.development`, while the separate `db:seed:prod` command must be used intentionally for production. Applied the existing nine forward-only migrations to the configured development database, seeded the intended private development `ADMIN` and `VIEWER` accounts, and removed the ignored plaintext CSV import file afterward.
Why it changed: The previous user seed helper loaded generic `.env` directly, which could seed the wrong database during local setup. Local auth setup must follow the same `.env.development` precedence as the API and Prisma commands.
Files changed: apps/stroane-web/prisma/seed-users.mjs, apps/stroane-web/package.json, apps/stroane-web/README.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/progress-log.md.
Data impact: Applied the existing nine forward-only migrations to the configured development database and upserted two private CSV-backed `SiteUser` development accounts. No production database writes were performed.
Security impact: Positive. Development and production user seeding now require distinct commands, reducing the risk of accidentally writing local seed users to production. The ignored plaintext CSV import file was removed after seeding.
Testing done: Initial read-only `APP_ENV=development pnpm --filter @faako/stroane-web exec prisma migrate status` confirmed all nine migrations were pending on the configured development database. `pnpm --filter @faako/stroane-web run db:deploy:dev` applied all nine migrations. `pnpm --filter @faako/stroane-web run db:seed` seeded two development users. Final read-only migration status reported `Database schema is up to date!`. A local `/api/auth/login` probe with deliberately invalid credentials returned the expected `401 Incorrect username or password`, confirming the API can query `SiteUser` without the prior `P2021` failure. `node --check apps/stroane-web/prisma/seed-users.mjs` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `git diff --check` passed.
Rollback notes: Revert the seed helper environment loading, package scripts, and docs if the command separation is no longer wanted. The applied development migrations are forward-only; do not reset the database. Remove or deactivate seeded development users manually if required.
Next step: Restart `pnpm run dev:stroane` and verify local username/password staff login. Check production migration status separately before any Railway production deploy.

### Stroane local API proxy and base URL normalization

Date: 2026-05-30
Feature/change name: Stroane local API proxy and base URL normalization
What changed: Added a shared frontend API config helper used by catalogue, order, payment, and admin-order requests. The helper strips an accidental trailing `/api` from configured base URLs before appending route paths, preventing malformed `/api/api/*` requests. Updated the ignored local `.env.development` value to leave `VITE_API_BASE_URL` blank so Vite proxies same-origin `/api` requests to the local backend on port `3000`. Aligned Prisma environment resolution so explicit `APP_ENV=development` takes precedence over a generic `NODE_ENV`.
Why it changed: Local login attempted `http://localhost:4000/api/api/auth/login`, while the combined Stroane dev command runs the backend on port `3000`. Local development should use `.env.development`, not `.env.example`, and should use the existing Vite proxy.
Files changed: apps/stroane-web/.env.development (ignored local config), apps/stroane-web/src/api/config.ts, apps/stroane-web/src/api/products.ts, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/api/adminOrders.ts, apps/stroane-web/prisma.config.ts, apps/stroane-web/README.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/progress-log.md.
Data impact: None. No schema, migration, catalogue, order, payment, or customer data changes.
Security impact: Positive local hardening. Local browser requests use the Vite same-origin proxy, avoiding unnecessary local cross-origin requests. Public API base normalization does not expose or log secrets.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite warning caused by `NODE_ENV=production` in the generic local `.env`. `git diff --check` passed.
Rollback notes: Revert the shared API config helper imports, Prisma precedence change, docs, and local `.env.development` value if local development intentionally moves to a separate backend origin.
Next step: Restart `pnpm run dev:stroane`, then verify `/signin`, `/shop`, and one product detail page through the same-origin local `/api` proxy.

### Stroane protected supplier and inventory admin API foundation

Date: 2026-05-29
Feature/change name: Stroane protected supplier and inventory admin API foundation
What changed: Added a modular backend admin inventory API foundation with separate response helpers, validation, services, controllers, and routes. Added protected supplier CRUD foundations, inventory item list/detail/update routes, inventory movement list/create routes, and product inventory update/sync route. Inventory movement support now records `RESTOCK`, `ADJUSTMENT`, `DAMAGE`, `MANUAL_CORRECTION`, `RESERVED`, and `RELEASED` movements with before/after quantities, reserved quantities, notes, audit entries, and authenticated actor placeholders.
Why it changed: Stroane needs internal supplier and inventory management APIs before a future admin dashboard can safely edit stock, suppliers, reorder thresholds, and restock history. The storefront and fallback catalogue behavior must stay stable while backend operations mature.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/apiResponse.js, apps/stroane-web/backend/src/inventory/controllers.js, apps/stroane-web/backend/src/inventory/routes.js, apps/stroane-web/backend/src/inventory/services.js, apps/stroane-web/backend/src/inventory/validation.js, apps/stroane-web/backend/inventory.test.js, docs/apps/stroane-web/api.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/progress-log.md.
Data impact: No schema or migration changes in this phase. The API writes to the existing additive supplier/inventory tables and syncs existing `CatalogueProduct` stock fields only when an authenticated admin calls an update/movement route.
Security impact: Positive internal API hardening. All supplier/inventory admin routes require backend `SiteUser` bearer auth; `ADMIN` and `VIEWER` can read, while supplier creation/update, inventory updates, movements, and product inventory updates require `ADMIN`. Existing admin rate limiting is reused. Supplier notes, purchase notes, cost-oriented supplier fields, and movement history remain admin-only and are not exposed through public catalogue endpoints.
Testing done: `node --check` passed for `backend/server.js`, `backend/src/apiResponse.js`, and the new inventory controller/route/service/validation modules. `pnpm --filter @faako/stroane-web exec node --test backend/inventory.test.js backend/security.test.js backend/paystack.test.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite warning that local `.env` should not set `NODE_ENV=production`. `git diff --check` passed.
Rollback notes: Revert the admin inventory route wiring and new backend inventory/API helper modules plus docs. No database rollback is required unless admins have already created supplier/inventory data through these endpoints.
Next step: Build a small protected admin stock/supplier screen that consumes these endpoints after Railway auth/token handling is confirmed in production.

### Stroane product image transparent background pass

Date: 2026-05-29
Feature/change name: Stroane product image transparent background pass
What changed: Added a dev-only `sharp` asset helper and `assets:cutout` script for product-image background removal. Generated transparent WebP versions for 22 catalogue product images under `public/imgs/products/` and updated `src/data/stroaneCatalogue.json` to reference the transparent cutouts. Kept original JPG/WebP source images in place for rollback/manual review.
Why it changed: Product photos had white boxed backgrounds in the storefront. Transparent WebP cutouts let product cards and detail pages sit more naturally on Stroane surfaces without hardcoding visual workarounds in components.
Files changed: apps/stroane-web/package.json, pnpm-lock.yaml, apps/stroane-web/scripts/remove-white-background.mjs, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/public/imgs/products/**/*-transparent.webp, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md.
Data impact: Catalogue image URL references changed from source JPG/WebP files to generated transparent WebP cutouts. No product pricing, stock, payment, order, customer, or database schema changes.
Security impact: None. No secrets or API behavior changed.
Testing done: `pnpm --filter @faako/stroane-web assets:cutout` generated 22 transparent WebP image assets and updated 22 catalogue image references. Image reference check found 22 `/imgs/products/` references and 0 missing files. Alpha check confirmed sampled transparent WebP outputs contain transparent pixels. `node --check apps/stroane-web/scripts/remove-white-background.mjs` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite warning that local `.env` should not set `NODE_ENV=production`. `git diff --check` passed.
Rollback notes: Repoint catalogue image URLs to the original source images and remove the generated `*-transparent.webp` assets and `assets:cutout` script/dependency if the cutouts need to be replaced manually.
Next step: Visually review the deployed product grid/detail pages and manually retouch any image where white product surfaces or shadows need finer cutout treatment.

### Stroane frontend catalogue API failure diagnostics

Date: 2026-05-29
Feature/change name: Stroane frontend catalogue API failure diagnostics
What changed: Added safe browser diagnostics to the catalogue API helper so fallback events log the public API base URL, full endpoint, HTTP status when available, and safe error message. Confirmed the helper prefers `VITE_API_BASE_URL` over the legacy `VITE_BACKEND_BASE_URL` and calls `/api/catalogue/products`, `/api/catalogue/categories`, and `/api/catalogue/products/:slug`. Hardened response normalization so product/category list reads accept either array responses or object-wrapped `{ products: [...] }` and `{ categories: [...] }` responses. Updated API CORS defaults to allow the live Cloudflare Pages storefront origins and Cloudflare Pages preview origins without using wildcard CORS with credentials.
Why it changed: The live Cloudflare Pages frontend showed "Catalogue fallback active" while the direct Railway API URL worked. That points to browser-facing config/CORS behavior rather than a dead API, so the app needed safer diagnostics and production origin defaults.
Files changed: apps/stroane-web/src/api/products.ts, apps/stroane-web/backend/security.js, apps/stroane-web/backend/security.test.js, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md.
Data impact: None. No schema, migration, product, order, payment, customer, or inventory data changes.
Security impact: No secrets exposed. Diagnostics log only public frontend config and request status. CORS remains allow-list based and does not use `*` with credentials.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec node --test backend/security.test.js` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite warning that local `.env` should not set `NODE_ENV=production`.
Rollback notes: Revert the catalogue API diagnostics, CORS default-origin changes, and docs. No data rollback is required.
Next step: Redeploy the Railway API, confirm `/health`, then redeploy Cloudflare Pages after verifying `VITE_API_BASE_URL=https://stroane-api-production.up.railway.app` is set.

### Stroane Railway API start and health readiness

Date: 2026-05-29
Feature/change name: Stroane Railway API start and health readiness
What changed: Confirmed `start:api` exists for the Railway API service and kept existing `server:dev`, `server:prod`, and `server:with-migrate` scripts. Confirmed the backend listens on `process.env.PORT` with a local fallback. Updated `/health` to return `{ ok: true, service: "stroane-api" }` without database access. Documented the Railway API build command, start command, required API env vars, and the boundary that `VITE_API_BASE_URL` belongs on the Cloudflare Pages frontend, not the Railway API service.
Why it changed: Railway was reporting "Application failed to respond", so the API start command, port binding, and health response needed to be explicit and deployment-safe.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/README.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md.
Data impact: None. No schema, migration, product, order, payment, or customer data changes.
Security impact: No secrets exposed. API-only env vars remain documented as Railway API service values, and frontend-only `VITE_API_BASE_URL` remains Cloudflare Pages scoped.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec prisma generate` passed and verifies the documented Railway API build command. `PORT=0 pnpm --filter @faako/stroane-web start:api` started the production API command and printed the backend startup message. `git diff --check` passed.
Rollback notes: Revert the health response and documentation updates. No data rollback is required.
Next step: Deploy the Railway API with build command `pnpm --filter @faako/stroane-web exec prisma generate` and start command `pnpm --filter @faako/stroane-web start:api`, then test `/health`.

### Stroane Cloudflare Pages and Railway API readiness

Date: 2026-05-29
Feature/change name: Stroane Cloudflare Pages and Railway API readiness
What changed: Added a Railway-friendly `start:api` script for the API/backend service, removed the inappropriate `start:web` script, and corrected current deployment notes so Stroane frontend hosting is Cloudflare Pages while Railway is only for the API/backend and Railway Postgres database. Documented the known Railway API URL, production Cloudflare Pages `VITE_API_BASE_URL`, API-only `DATABASE_URL` boundary, Cloudflare DNS records, and catalogue API smoke-test URLs.
Why it changed: Stroane frontend is hosted on Cloudflare Pages, the API/backend runs on Railway, the database is Railway Postgres, and Cloudflare manages DNS/domain routing. The previous update briefly documented the wrong frontend host, which is not the current deployment direction.
Files changed: apps/stroane-web/.env.example, apps/stroane-web/README.md, apps/stroane-web/backend/server.js, apps/stroane-web/package.json, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/pre-deploy-checklist.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md.
Data impact: None. No database schema, migration, seed, product, order, payment, or customer data changes.
Security impact: Positive configuration clarity only. `DATABASE_URL` and provider secrets are documented as API-service-only. The frontend service should only receive browser-safe `VITE_*` values.
Testing done: `node -e "JSON.parse(...apps/stroane-web/package.json...)"` passed. `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite warning that local `.env` should not set `NODE_ENV=production`. `PORT=0 pnpm --filter @faako/stroane-web start:api` started the production API command and printed the backend startup message. `git diff --check` passed.
Rollback notes: Revert the package script addition and deployment documentation changes. No data rollback is required.
Next step: Deploy or configure the Railway API service and Cloudflare Pages frontend with the documented commands/env vars, then smoke test the catalogue API and storefront through Cloudflare DNS.

### Stroane catalogue API route alignment

Date: 2026-05-29
Feature/change name: Stroane catalogue API route alignment
What changed: Aligned the existing Stroane catalogue frontend helper with the intended `/api/catalogue/*` route contract while preserving the current shop/product UI and local catalogue fallback. Added backend read-only catalogue route aliases for `GET /api/catalogue/categories`, `GET /api/catalogue/products`, and `GET /api/catalogue/products/:slug` while keeping legacy `/api/categories`, `/api/products`, and `/api/products/:slug` available during rollout. Updated browser API helpers to prefer `VITE_API_BASE_URL` with `VITE_BACKEND_BASE_URL` as a legacy fallback.
Why it changed: Stroane frontend is now on Cloudflare Pages and the API is expected to run separately on Railway. The shop/product pages need the agreed catalogue API contract without breaking the current fallback-driven storefront.
Files changed: apps/stroane-web/.env.example, apps/stroane-web/README.md, apps/stroane-web/backend/server.js, apps/stroane-web/src/api/products.ts, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/api/adminOrders.ts, docs/apps/stroane-web/api.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/pre-deploy-checklist.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/progress-log.md.
Data impact: None. No schema changes, migrations, seed changes, product data edits, checkout/payment changes, or inventory updates were made.
Security impact: No secrets exposed. `VITE_API_BASE_URL` is documented as browser-safe only; database URLs, Paystack keys, Resend keys, auth secrets, and webhook secrets remain server-side. Legacy route aliases are read-only catalogue endpoints only.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed with Prisma 7 config loaded from `prisma.config.ts`. `pnpm --filter @faako/stroane-web exec node --test backend/paystack.test.js backend/security.test.js` passed. `pnpm --filter @faako/stroane-web run build` passed with the existing Vite warning that `.env` should not set `NODE_ENV=production`. Product image path check found 22 `/imgs/products/` references and 0 missing files. `git diff --check` passed.
Rollback notes: Revert the API helper base URL changes, the backend catalogue route aliases, and the docs/env updates. Legacy `/api/products` routes remain in place, so rollback does not require data migration.
Next step: Deploy or configure the Railway API origin, set `VITE_API_BASE_URL` in Cloudflare Pages, then smoke test `/shop`, `/products`, and a product detail page against both API-available and API-unavailable states.

### Stroane stability review and operational inventory foundation

Date: 2026-05-29
Feature/change name: Stroane stability review and operational inventory foundation
What changed: Completed a focused Stroane stability review for the Cloudflare Pages move and product-image path relocation, then added an additive operational inventory/supplier database foundation. Product imagery now resolves from `/imgs/products/`; empty legacy product-image folders were removed. Storefront stock helpers now understand `availableQuantity`, `reservedQuantity`, and `reorderThreshold`, and product cards/details show available stock when a confirmed value exists. Prisma now has supplier, supplier-contact, product-supplier, inventory-item, stock-movement, and inventory-audit models. Backend catalogue/order helpers expose and validate available stock without trusting frontend quantities.
Why it changed: Stroane is preparing for operational inventory and supplier workflows, but the current shop/catalogue must remain stable while the API is still being deployed and the frontend has moved to Cloudflare Pages.
Files changed: apps/stroane-web/.env.example, apps/stroane-web/README.md, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/package.json, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260529000000_add_inventory_supplier_foundation/migration.sql, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/src/styles/pages/ProductList.css, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/public/imgs/products/**, docs/apps/stroane-web/api.md, docs/apps/stroane-web/catalogue-architecture.md, docs/apps/stroane-web/database.md, docs/apps/stroane-web/deployment.md, docs/apps/stroane-web/env.md, docs/apps/stroane-web/implementation-notes.md, docs/apps/stroane-web/pre-deploy-checklist.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/system-status.md.
Stability findings: All catalogue image references now use `/imgs/products/`; a filesystem check found 22 unique product image paths and 0 missing files. `useCatalogueData` still initializes from local seed data and catches API failures, so `/shop` and `/products` can fall back while the Stroane API is unavailable. Cloudflare Pages is now documented as the active frontend host. The legacy `netlify.toml` remains as a non-primary fallback artifact only. Existing Safari/iOS native-control cleanup remains present in global/shared styles.
Migration summary: Added nullable `CatalogueProduct.availableQuantity`, `CatalogueProduct.reservedQuantity`, and `CatalogueProduct.reorderThreshold`. Added `Supplier`, `SupplierContact`, `CatalogueProductSupplier`, `InventoryItem`, `InventoryMovement`, and `InventoryAuditEntry`. The migration is additive and does not modify payment/order totals, existing catalogue fields, or checkout/order workflows.
Env vars added/changed: No new env vars. `.env.example` now documents Railway Postgres as the production database direction. `package.json` postinstall now treats `CF_PAGES` as a static Pages install, matching Cloudflare Pages.
Commands run: `node --check apps/stroane-web/backend/src/catalogue.js`; `node --check apps/stroane-web/backend/src/orders.js`; `node --check apps/stroane-web/backend/server.js`; catalogue JSON parse check; product image path existence check; `pnpm --filter @faako/stroane-web exec prisma validate`; `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit`; `pnpm --filter @faako/stroane-web run lint`; `pnpm --filter @faako/stroane-web run build`; `pnpm --filter @faako/stroane-web exec node --test backend/paystack.test.js backend/security.test.js`.
Verification results: All commands passed. Build completed with Vite's warning that local `.env` should not set `NODE_ENV=production`; the build still succeeded. Keep `APP_ENV=production` for app/runtime targeting and avoid setting `NODE_ENV=production` inside `.env` files for Vite builds.
Known gaps: Supplier/inventory admin screens and API endpoints are planned but not implemented. Orders still do not reserve or deduct inventory. Real stock counts, supplier details, costs, and reorder thresholds must be entered before enabling online purchase for products with unknown stock. The deployed Cloudflare Pages/Railway pairing still needs real-device Safari/iOS smoke testing.
Rollback notes: Revert the additive Prisma migration/schema additions, stock helper/UI additions, backend mapper/order stock validation additions, image path relocation, and docs. If the migration has been deployed and real inventory/supplier records have been entered, export those records before rollback.
Next step: Implement protected supplier/inventory admin API endpoints and a small admin stock editor after confirming Railway backend deployment and access rules.

### Stroane catalogue normalization and product architecture pass

Date: 2026-05-22
Feature/change name: Stroane catalogue normalization and product architecture pass
What changed: Normalized the Stroane catalogue seed into category groups, leaf categories, standalone thermometer products, and apron variant-parent products. Added product media, variant, structured specification, inventory placeholder, and manual-review metadata to the catalogue helper types. Added supplied thermometer/apron product images under organized public asset folders. Updated product detail to support media galleries, thumbnail switching, variant image switching, and structured specifications. Updated shop filtering/search so parent category groups stay out of customer filters and variant/specification terms are searchable. Updated backend catalogue mapping so DB-backed products/categories merge local seed media, variants, category-group metadata, and manual-review notes when persisted rows lag behind the current seed.
Why it changed: Stroane catalogue depth expanded and needs a normalized product/variant/media/specification structure before future inventory, admin stock, or ERP-adjacent workflows are considered.
Files changed: apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/public/imgs/products/thermometers/*, apps/stroane-web/public/imgs/products/aprons/*, apps/stroane-web/README.md, docs/apps/stroane-web/catalogue-architecture.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Static catalogue seed and public image asset updates only. No database schema change and no existing orders, payments, inquiries, stock counts, or customer data were changed. Seeded DB rows can still be refreshed later from the updated JSON seed.
Security impact: No secrets or private client data added. Unknown stock/pricing remains non-purchasable, preserving backend checkout protections.
Testing done: Catalogue JSON parse check passed. Backend catalogue syntax check passed. Catalogue seed script syntax check passed. Stroane frontend TypeScript check passed. Final build/check results are recorded in the chat summary.
Rollback notes: Revert the catalogue JSON, helper/type changes, product detail/shop/backend mapper updates, seed script sort-order tweak, added image assets, and docs. No database rollback is required unless the updated seed has been run against production.
Next step: Confirm real prices, stock counts, variant availability, supplier/cost fields, and final image approvals before enabling checkout for any newly normalized products.

### Stroane commerce stabilization and Safari UI QA

Date: 2026-05-21
Feature/change name: Stroane commerce stabilization and Safari UI QA
What changed: Ran a focused commerce QA/security review across catalogue, product detail, cart, checkout, Paystack initialization, callback messaging, webhook finalization, order confirmation, stock gating, and admin order visibility. Added shared Safari/iOS native-control normalization for buttons, inputs, selects, textareas, search fields, date fields, dropdowns, shared field controls, shared actions, and app maintenance surfaces. Updated Stroane mobile viewport handling on checkout, auth, admin orders, error, and services screens with `100dvh` fallbacks and safe-area padding where relevant. Tightened the Paystack browser-return status check to normalize currency codes the same way the webhook path already does, and sanitized backend route error logs so provider/auth/error objects are not dumped directly.
Why it changed: Stroane now handles customer orders, payment references, stock availability, checkout forms, and admin order review, so the app needed a stabilization pass before further commerce expansion. Safari/iOS can apply unwanted native styling to form controls, and payment/status messaging must remain conservative.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/src/styles/globals.css, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/src/styles/pages/AdminOrders.css, apps/stroane-web/src/styles/pages/Auth.css, apps/stroane-web/src/styles/pages/ErrorPage.css, apps/stroane-web/src/styles/pages/Services.css, packages/ui/src/ui.css, packages/ui/README.md, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/security-status.md
Data impact: None. No schema changes, migrations, order total changes, stock count changes, inventory deduction, fulfillment automation, CRM, WhatsApp/SMS, Dev ERP, or REEBS workflows changed.
Security impact: Positive hardening only. Payment paid-state finalization remains webhook/provider-owned. Browser callback verification still reports status only, but now handles currency casing consistently. Backend logs now avoid raw error/provider object dumps on auth, catalogue, inquiry, order, Paystack initialize, Paystack verify, and unhandled-error paths. Shared UI changes are presentation-only.
Testing done: `/usr/local/bin/node --check apps/stroane-web/backend/src/orders.js` passed. `/usr/local/bin/node --check apps/stroane-web/backend/src/routes/auth.js` passed. `/usr/local/bin/node --check apps/stroane-web/backend/server.js` passed. `/usr/local/bin/node --test apps/stroane-web/backend/paystack.test.js apps/stroane-web/backend/security.test.js` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run lint` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec prisma validate` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run build` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:gate` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:scan` passed. `git diff --check` passed.
Rollback notes: Revert the CSS normalization/viewport updates, the Paystack callback currency-normalization tweak, sanitized log changes, and docs. No database rollback is required.
Next step: Add a dedicated payment event and notification log before fulfillment automation, then run a browser-device checkout smoke test against the deployed Cloudflare Pages/Railway pairing.

### Staff sign-in routing fix

Date: 2026-05-21
Feature/change name: Staff sign-in routing fix
What changed: Updated the public Stroane sign-in page so it can accept either a customer email or a private staff username. If no local customer account matches, the page now attempts backend `SiteUser` login and sends valid `ADMIN`/`VIEWER` users to `/admin/orders`.
Why it changed: Staff users seeded into the database were trying the visible `/signin` page and hitting the customer-only local account error, "No account found for that email."
Files changed: apps/stroane-web/src/pages/SignIn.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: None. No user rows, passwords, orders, payments, or customer accounts were changed. The CSV remains an import source only and is not used at runtime.
Security impact: Staff login still uses backend `SiteUser` authentication and the existing protected admin order APIs. Customer localStorage auth remains separate and does not unlock admin routes.
Testing done: `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run lint` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run build` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:gate` passed. `git diff --check` for affected files passed.
Rollback notes: Revert the sign-in fallback change and docs if staff should only use the direct `/admin/orders` login screen.
Next step: Keep the two backend staff accounts seeded in the target database and remove plaintext seed CSVs after import.

### Stroane lightweight admin order management

Date: 2026-05-21
Feature/change name: Stroane lightweight admin order management
What changed: Added a protected lightweight admin order-management foundation for Stroane. Backend admin order routes now support authenticated order listing, search/filtering, order detail reads, masked Paystack references, and admin-only fulfillment/status/note updates. The frontend adds an unlinked `/admin/orders` screen with backend `SiteUser` login, order list filters, status badges, order detail, delivery/internal notes, and quick fulfillment actions. Added additive fulfillment fields for `CommerceOrder`: `fulfillmentStatus`, `deliveryMethod`, `expectedDeliveryDate`, `adminDeliveryNotes`, `internalNotes`, `statusUpdatedAt`, and `statusUpdatedById`.
Why it changed: Stroane now has checkout/payment finalization and needs a small staff workflow to review paid orders and move them through lightweight fulfillment without becoming a full ERP.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/adminAuth.js, apps/stroane-web/backend/src/adminOrders.js, apps/stroane-web/backend/src/routes/auth.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260521000000_add_admin_order_fulfillment_fields/migration.sql, apps/stroane-web/src/App.tsx, apps/stroane-web/src/api/adminOrders.ts, apps/stroane-web/src/pages/AdminOrders.tsx, apps/stroane-web/src/styles/pages/AdminOrders.css, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md, docs/platform/security-status.md
Data impact: Additive order fulfillment/admin-note fields only. Existing orders are not changed until an admin updates fulfillment details. Payment status, Paystack webhook verification, order totals, stock, inventory, fulfillment automation, CRM, WhatsApp/SMS, Dev ERP, and REEBS workflows are unchanged.
Security impact: Admin order APIs require backend `SiteUser` bearer authentication. `ADMIN` and `VIEWER` can view orders; only `ADMIN` can update order fulfillment/status fields. Payment status cannot be manually changed, Paystack remains payment source of truth, unpaid orders cannot be marked processing/ready/out for delivery/completed, and payment references are masked in admin responses. Public customer sign-in remains separate and does not unlock this area.
Testing done: `/usr/local/bin/node --check apps/stroane-web/backend/src/adminAuth.js`, `/usr/local/bin/node --check apps/stroane-web/backend/src/adminOrders.js`, and `/usr/local/bin/node --check apps/stroane-web/backend/server.js` passed. `/usr/local/bin/node --test apps/stroane-web/backend/paystack.test.js apps/stroane-web/backend/security.test.js` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec prisma validate` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run lint` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run build` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:gate` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:scan` passed. `git diff --check` passed.
Rollback notes: Revert the admin auth/order route files, route wiring, admin frontend route/API/page/styles, additive migration/schema fields, and docs. If deployed and staff has entered fulfillment notes, export needed order note/status data before rolling back the added fields.
Next step: Add a dedicated payment event/notification log, then lightweight admin stock/count update tools before broader fulfillment or staff alert automation.

### Stroane Paystack webhook verification and reliable order finalization

Date: 2026-05-21
Feature/change name: Stroane Paystack webhook verification and reliable order finalization
What changed: Tightened the Paystack webhook path so signed webhook events now trigger a server-side Paystack transaction verification before any paid-state finalization. The webhook flow now validates the stored order reference, Paystack-verified reference, verified amount, verified currency, and current order state before transitioning `payment_pending` to `paid`. Already-finalized paid orders return successfully without re-running order status transitions, and customer confirmation email is only attempted after trusted paid finalization. The checkout return page copy now makes clear that browser return status is only a secure status check, not final payment truth.
Why it changed: Paystack browser callbacks can fail or be misleading, and webhook payloads should not be treated as the only payment truth. Stroane needs server-to-server verification and idempotent finalization before broader commerce operations.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/paystack.test.js, apps/stroane-web/src/pages/CheckoutReturn.tsx, apps/stroane-web/.env.example, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: No schema changes. Existing order payment/webhook metadata fields now store transaction-verified webhook metadata. No inventory deduction, fulfillment automation, CRM workflow, Dev ERP workflow, REEBS workflow, WhatsApp sending, or SMS sending was added.
Security impact: `PAYSTACK_SECRET_KEY` and webhook signing values remain backend-only. Paid status now requires valid Paystack signature, stored order lookup, Paystack transaction verify API success, verified reference match, verified amount match, and verified currency match. Browser callback verification remains a customer-facing status check only. Confirmation email failure does not roll back payment finalization.
Testing done: `/usr/local/bin/node --check apps/stroane-web/backend/server.js` passed. `/usr/local/bin/node --check apps/stroane-web/backend/src/paystack.js` passed. `/usr/local/bin/node --test apps/stroane-web/backend/paystack.test.js apps/stroane-web/backend/security.test.js` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run lint` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web exec prisma validate` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm --filter @faako/stroane-web run build` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:gate` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run security:scan` passed. `PATH=/usr/local/bin:$PATH /usr/local/bin/pnpm run project-registry:check` passed with warning-only missing metadata notes for apps outside this scope. `git diff --check` passed.
Rollback notes: Revert the webhook transaction-verification changes, duplicate webhook early-return behavior, checkout return copy update, Paystack helper test, env/docs updates, and this entry. No database rollback is required.
Next step: Lightweight admin order management, plus a dedicated payment event/notification log for stricter replay review before fulfillment automation.

### Stroane security and production readiness pass

Date: 2026-05-20
Feature/change name: Stroane security and production readiness pass
What changed: Audited Stroane and shared platform security foundations, then tightened low-risk commerce safety paths. Stroane backend security headers now reuse `@faako/security`, route-specific rate limits cover auth, inquiry, checkout, Paystack initialization, Paystack verification, and Paystack webhooks, and Paystack initialization revalidates current product price, currency, stock status, purchasability, and quantity before redirecting customers to Paystack. Paystack provider metadata was minimized to order number/source, obsolete browser-visible preview-auth env examples were removed, customer-facing legal copy now uses pricing wording, and Stroane/platform security notes were added.
Why it changed: Stroane now handles customer orders, payments, and contact data, so shared security consistency, payment integrity, env safety, and production-readiness gaps needed a hardening pass before further commerce expansion.
Files changed: apps/stroane-web/backend/security.js, apps/stroane-web/backend/security.test.js, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/backend/src/paystack.js, apps/stroane-web/.env.example, apps/stroane-web/package.json, pnpm-lock.yaml, apps/stroane-web/src/pages/Privacy.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/security-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/security-status.md, docs/platform/platform-progress-log.md
Data impact: None. No schema changes and no data migration in this pass. Payment initialization now performs an additional server-side readiness check against current catalogue data before contacting Paystack.
Security impact: Improves shared header reuse, route-specific abuse protection, browser-visible env hygiene, payment metadata minimization, and server-side payment readiness validation. Remaining gaps are documented: frontend-only localStorage auth, in-memory rate limiting, missing Railway/provider-level rate controls, Railway Postgres least-privilege access, and missing payment event/notification logs.
Testing done: `pnpm install --lockfile-only --offline --ignore-scripts` updated the lockfile; `CI=true pnpm install --ignore-scripts` restored workspace links after the local store lacked one offline tarball. `pnpm --filter @faako/stroane-web exec node --test backend/security.test.js` passed. `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/security.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `node --check apps/stroane-web/backend/src/paystack.js` passed. `node --check apps/stroane-web/backend/src/orderNotifications.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed after rerunning with access to Prisma's local engine cache. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run security:scan` passed. `pnpm run security:gate` initially flagged `VITE_AUTH_PASSWORD`; after removing obsolete preview-auth env examples, it passed. `pnpm run monitoring:check` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the shared header import/dependency/lockfile update, route-specific rate limit wiring, pre-Paystack readiness check, Paystack metadata minimization, `.env.example` cleanup, pricing wording update, and security docs. No database rollback is required.
Next step: Add Railway/provider-level rate limiting plus payment event/notification logs, then plan backend-enforced admin auth and Railway Postgres least-privilege access before expanding commerce/admin workflows.

Decision update: On 2026-05-21, public sign-in/sign-up was retained intentionally as a frontend-only customer convenience. It is not a backend security boundary. Production rate limiting should use Railway/provider controls, and the production database direction is Railway Postgres with least-privilege runtime/migration access where available. Backend `SiteUser` access should stay private with one seeded `ADMIN` and one seeded `VIEWER` account until a real admin/account model is approved.

### Stroane storefront stock availability foundation

Date: 2026-05-20
Feature/change name: Stroane storefront stock availability foundation
What changed: Added storefront stock availability fields to the centralized catalogue model and Prisma `CatalogueProduct` persistence foundation: `stockQuantity`, `stockStatus`, `lowStockThreshold`, `allowBackorder`, and `isPurchasable`. Updated the JSON catalogue seed/import mapping so PDF-imported products default to `stockQuantity: null`, `stockStatus: unavailable`, and `isPurchasable: false` until Stroane confirms real counts. Product cards, product detail, product list, cart controls, and checkout now separate “priced” from “purchasable”: unavailable or unconfirmed-stock items show availability/inquiry messaging and cannot proceed to checkout. Backend order preparation now validates purchasability, status, quantity, price, and stock metadata server-side before Paystack initialization can ever run.
Why it changed: Stroane is now a lightweight commerce storefront, so customers need clear availability before checkout. Unknown stock should not be treated as sellable, and inquiry should be the fallback only when price, custom order, or availability is not ready.
Files changed: apps/stroane-web/src/data/products.ts, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/types/index.ts, apps/stroane-web/src/components/QuantityControls.tsx, apps/stroane-web/src/styles/components/QuantityControls.css, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000004_add_catalogue_stock_availability_fields/migration.sql, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Additive catalogue stock metadata fields only until deployed. Running the migration adds storefront availability metadata to catalogue products. The seed intentionally keeps existing PDF-imported products non-purchasable until real stock counts are entered. No inventory deduction, warehouse logic, fulfillment automation, payment total changes, CRM workflow, Dev ERP workflow, or REEBS workflow changed.
Security impact: Frontend stock and cart state are display/convenience only. Backend checkout validation still recalculates prices and now validates purchasability/stock before order creation and Paystack initialization. Secrets and payment provider behavior were not changed.
Testing done: `node --check apps/stroane-web/backend/src/catalogue.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `node --check apps/stroane-web/prisma/seed-catalogue.mjs` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `git diff --check` passed.
Rollback notes: Revert the stock metadata schema/migration, seed defaults, product helper changes, storefront availability UI changes, checkout validation changes, and docs. If the migration has been deployed and stock metadata entered, export those catalogue values before rolling back fields.
Next step: Add a lightweight authenticated stock editor/admin workflow so Stroane can enter real counts, thresholds, and purchasability decisions before public online purchasing is enabled.

### Stroane Paystack webhook verification and order confirmation completion

Date: 2026-05-20
Feature/change name: Stroane Paystack webhook verification and order confirmation completion
What changed: Added a signed Paystack webhook endpoint at `POST /api/paystack/webhook`, raw-body signature capture, HMAC-SHA512 signature verification, webhook event validation, server-side order lookup by Paystack reference, amount/currency checks, webhook metadata storage, and idempotent paid-status handling. The browser return verification endpoint now acts as a customer-facing status check only; it no longer finalizes `PAID` or sends confirmation email before webhook confirmation. Customer-safe payment-confirmed email now runs from the webhook-confirmed paid path and still uses `customerNotificationSentAt` to avoid duplicate confirmations where possible.
Why it changed: Stroane payment handling should not rely on browser redirects as final payment truth. Paystack webhook verification gives a safer server-to-server confirmation path before paid status and order confirmation email.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/paystack.js, apps/stroane-web/backend/src/orderNotifications.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000003_add_paystack_webhook_metadata/migration.sql, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/CheckoutReturn.tsx, apps/stroane-web/.env.example, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Additive webhook metadata fields only until deployed. After deployment, signed Paystack webhooks can mark matching orders paid only when the backend verifies the Paystack transaction and the reference, amount, and currency validate. Browser callback verification does not finalize paid status. No inventory deduction, fulfillment automation, advanced CRM, Dev ERP workflow, REEBS workflow, WhatsApp sending, or SMS sending was added.
Security impact: `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` stay backend-only. Invalid signatures are rejected. Paid status requires signed webhook confirmation plus server-side Paystack transaction verification for reference, amount, and currency. Logs avoid provider payload dumps and sensitive details. Confirmation emails remain customer-safe and use order-level sent metadata to reduce duplicate sends; a dedicated notification/webhook event log remains future work for stronger idempotency and replay auditing.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/paystack.js` passed. `node --check apps/stroane-web/backend/src/orderNotifications.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. Paystack webhook signature helper check passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes. `git diff --check` passed.
Rollback notes: Revert the webhook route/signature helpers, callback-status-only behavior, additive webhook metadata migration/schema fields, env/docs updates, and project-registry milestone update. If deployed, preserve needed webhook/payment metadata before removing fields.
Next step: Add a dedicated payment event/notification log for replay-safe idempotency, then staff order alerts and fulfillment preparation.

### Stroane order notification foundation

Date: 2026-05-20
Feature/change name: Stroane order notification foundation
What changed: Added customer-safe order notification templates and a backend Resend email sender for payment-confirmed order emails after successful Paystack verification. Checkout now captures a preferred contact method, and `CommerceOrder` has additive notification metadata fields for send status, type, sent timestamp, provider ID, and last error. Added WhatsApp and SMS order message formatter helpers for later use, without automating those channels.
Why it changed: Customers need confirmation after verified checkout payment, while Stroane still needs to avoid exposing internal notes, payment secrets, card/MoMo details, or building a full CRM/notification system.
Files changed: apps/stroane-web/backend/src/orderNotifications.js, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000002_add_order_notification_foundation/migration.sql, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/.env.example, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive order notification metadata fields only until deployed. After deployment, verified paid orders can record customer email notification status. No order total changes, payment logic changes, inventory automation, fulfillment automation, advanced CRM, Dev ERP workflow, REEBS workflow, WhatsApp sending, or SMS sending was added.
Security impact: Resend API keys remain backend-only. The email uses customer-safe order number, items summary, total, payment status, and customer contact details only. Internal notes, audit metadata, raw database IDs, secrets, Paystack authorization payloads, card/MoMo details, and admin-only metadata are not included. Duplicate sends are reduced by checking `customerNotificationSentAt`; a future notification log is still needed for strict idempotency and retry history.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/orderNotifications.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. Order notification helper import check passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes. `git diff --check` passed.
Rollback notes: Revert the notification helper, Paystack-verify email hook, checkout contact-preference UI, additive notification migration/schema fields, env/docs updates, and project-registry milestone update. If already deployed, preserve any sent notification audit needs before removing notification metadata fields.
Next step: Add Paystack webhook signature verification, a true notification log/idempotency table, and order confirmation/staff alert runbooks before fulfillment automation.

### Stroane Paystack checkout MVP

Date: 2026-05-20
Feature/change name: Stroane Paystack checkout MVP
What changed: Added backend Paystack transaction initialization for existing pending orders, backend Paystack reference verification, safe payment status mapping (`payment_pending`, `paid`, `failed`, `abandoned`), and a customer return page at `/checkout/return`. Checkout now creates a pending order, asks the backend to initialize Paystack with the server-side secret key, redirects to the Paystack authorization URL, then verifies the returned reference through the backend. Added additive payment metadata fields to `CommerceOrder` for provider reference/status/verification metadata and updated docs/env examples.
Why it changed: Stroane needs a lightweight Ghana-ready checkout path using Paystack test mode first, while preserving server-side order total verification and avoiding inventory, fulfillment, CRM, or ERP expansion.
Files changed: apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/paystack.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000001_add_commerce_payment_metadata/migration.sql, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/pages/CheckoutReturn.tsx, apps/stroane-web/src/App.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive payment metadata fields only until deployed. Initializing payment updates an existing `CommerceOrder` with Paystack reference/status/metadata. Verifying payment can mark a matching order `PAID` only after Paystack confirms reference, amount, and currency. No inventory deduction, warehouse workflow, fulfillment automation, CRM workflow, Dev ERP workflow, REEBS workflow, or unrelated app data is changed.
Security impact: `PAYSTACK_SECRET_KEY` stays backend-only. Frontend totals are not trusted; the backend verifies order totals before initialization and verifies Paystack amount/currency/reference before paid status. Live Paystack secret keys are blocked unless `PAYSTACK_ALLOW_LIVE=true` is explicitly set server-side. No card or MoMo sensitive details are stored. Webhook verification is documented as the next phase and was not implemented.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/paystack.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the Paystack helper/endpoints, checkout redirect/return-page wiring, additive payment metadata migration/schema changes, env/docs updates, and project-registry metadata update. If already deployed, preserve any needed payment references before removing payment metadata fields.
Next step: Add Paystack webhook verification and customer/staff order confirmation emails after test-mode checkout has been verified end to end.

### Stroane commerce and checkout foundation

Date: 2026-05-20
Feature/change name: Stroane commerce and checkout foundation
What changed: Added persistent lightweight cart storage for product IDs/quantities, a cart count in the public header/mobile nav, a checkout review flow that collects customer/contact/delivery details, and a backend `POST /api/orders` foundation that prepares pending orders. Added additive Prisma models/migration for `CommerceOrder` and `CommerceOrderItem` with order status, customer details, server-calculated line items/totals, payment-provider placeholders, and item snapshots. Checkout now creates a pending order request instead of directly invoking Paystack in the browser. Added future Paystack server-side env placeholders and updated Stroane portfolio metadata for the commerce milestone.
Why it changed: Stroane is moving from catalogue/inquiry toward lightweight commerce and needs a safe browse -> cart -> checkout -> pending order foundation before real payment collection, inventory automation, CRM, or ERP workflows.
Files changed: apps/stroane-web/src/context/CartContext.tsx, apps/stroane-web/src/components/Header.tsx, apps/stroane-web/src/styles/components/Header.css, apps/stroane-web/src/api/orders.ts, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/styles/pages/Checkout.css, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/orders.js, apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260520000000_add_commerce_order_foundation/migration.sql, apps/stroane-web/.env.example, packages/config/src/projectRegistry/projectRegistry.js, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: Additive schema only until deployed. Applying the migration creates `CommerceOrder`, `CommerceOrderItem`, and `CommerceOrderStatus`. Creating an order stores customer contact/delivery details, product snapshots, and server-calculated totals. No inventory deduction, warehouse workflow, payment capture, CRM automation, Dev ERP workflow, REEBS workflow, or unrelated app data is changed.
Security impact: Prices are recalculated server-side from persisted catalogue data or the local catalogue fallback; frontend totals are not trusted. Paystack secret values remain backend-only placeholders. No Paystack charge, payment link, webhook status mutation, inventory automation, or admin order-management surface was added.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/orders.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the cart/header/checkout/order API changes, order helper, additive migration/schema changes, env/docs updates, and project-registry metadata update. If the migration has already been deployed and orders exist, export/archive needed order records before dropping `CommerceOrderItem`, `CommerceOrder`, and `CommerceOrderStatus`.
Next step: Implement server-side Paystack payment link/initialize planning and webhook verification only after deployed order creation is tested against the intended production database.

### Stroane catalogue frontend and inquiry workflow completion refinement

Date: 2026-05-19
Feature/change name: Stroane catalogue frontend and inquiry workflow completion
What changed: Completed the safe catalogue browsing and inquiry path by making the backend catalogue API prefer persisted `CatalogueCategory` and `CatalogueProduct` rows when available, with JSON seed fallback for unmigrated or unavailable databases. Updated the single-product endpoint to fall back safely instead of failing if catalogue tables are not deployed yet. Kept `/shop` category browsing/counts tied to the backend-aware catalogue data and kept Product Detail rendering mapped product imagery, specifications, use cases, pricing labels, and product-specific inquiry forms for both priced and quote-only products.
Why it changed: Stroane needs a polished customer-facing catalogue and inquiry experience that can use backend data in production while remaining usable during backend/database rollout.
Files changed: apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/backend/server.js, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/pages/ProductDetail.tsx, packages/config/src/projectRegistry/projectRegistry.js, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Read-only catalogue API behavior only. Product/contact inquiries continue to use the existing `/api/inquiries` endpoint and may create minimal `CatalogueInquiry` records only when the previously added migration/backend are deployed. No payments, orders, inventory automation, CRM workflow, Dev ERP workflow, or REEBS workflow changed.
Security impact: No secrets exposed. The backend remains the validation point for inquiry payloads, catalogue fallback avoids leaking internal errors, and no admin/inquiry review surface or automated notifications were added.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/catalogue.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run project-registry:check` passed with warning-only app metadata coverage notes.
Rollback notes: Revert the backend catalogue DB-first helpers/routes, the Shop/Product Detail catalogue/inquiry UI refinements, project-registry metadata update, and this documentation. No data rollback is required unless separately deployed inquiry records need archival.
Next step: Deploy/test the Stroane backend and database pairing, verify live inquiry persistence from Cloudflare Pages, and complete final product photography/manual review.

### Stroane product image extraction and mapping

Date: 2026-05-19
Feature/change name: Stroane product image extraction and mapping
What changed: Extracted WebP product images from the Stroane thermometer catalogue, thermometer price list, and thermometers/posters/aprons brochure into `apps/stroane-web/public/imgs/products/`. Updated the centralized catalogue seed with `thumbnailUrl`, `imageUrl`, `galleryImages`, and `imageAlt` values for the current eight catalogue products. Updated product helpers and catalogue rendering surfaces to use mapped thumbnails/alt text with a safe placeholder fallback. Adjusted the homepage featured-product image treatment so product images use contained rendering instead of cropped lifestyle-image behavior.
Why it changed: Stroane catalogue pages should show real product-specific imagery from the source catalogues instead of generic placeholders, while keeping product data centralized and components data-driven.
Files changed: apps/stroane-web/public/imgs/products/*.webp, apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/pages/Home.tsx, apps/stroane-web/src/styles/pages/Home.css, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Static public image assets and catalogue metadata only. No database schema changes, no product persistence changes, no inquiry persistence changes, no payments, and no backend workflow changes.
Security impact: None. No secrets exposed and no private/internal data added. Product images are public catalogue assets.
Testing done: Rendered and reviewed a product-image contact sheet locally. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `node --check apps/stroane-web/backend/src/catalogue.js` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed.
Rollback notes: Revert the added `public/imgs/products` assets, catalogue image metadata, product helper image fallbacks, catalogue image rendering updates, homepage image CSS adjustment, and documentation updates. No database rollback is required.
Next step: Review extracted image crops with Stroane and replace any catalogue-derived crops with final product photography where available.

### Stroane catalogue frontend and inquiry workflow completion

Date: 2026-05-19
Feature/change name: Stroane catalogue frontend and inquiry workflow completion
What changed: Added an API-first catalogue data hook with local seed fallback, refreshed the Shop catalogue browsing experience with category overview cards, URL-aware category filters, result counts, fallback/loading notices, richer product cards, and mobile-friendly spacing. Updated the Product List route to use the same backend-aware catalogue hook. Improved Product Detail with API-first loading, local fallback notices, long descriptions, availability notes, expanded specifications, use-case chips, lazy-loaded related product images, and quote-only inquiry flow continuity. Completed the public Contact form path by submitting to the existing validated `/api/inquiries` endpoint when available, keeping a direct email fallback, and adding minimal honeypot protection. Updated Stroane project metadata for future byNana portfolio consumption.
Why it changed: Improve Stroane's real catalogue browsing and inquiry conversion experience while keeping the app lightweight, product-focused, and safe before payments, ERP workflows, CRM automation, or inventory automation are introduced.
Files changed: apps/stroane-web/src/hooks/useCatalogueData.ts, apps/stroane-web/src/api/products.ts, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/styles/pages/ProductList.css, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/src/components/ProductInquiryForm.tsx, apps/stroane-web/src/pages/Contact.tsx, apps/stroane-web/src/styles/pages/Contact.css, apps/stroane-web/README.md, packages/config/src/projectRegistry/projectRegistry.js, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: No schema changes. Catalogue reads are display-only. Product and contact inquiries continue to use the existing `/api/inquiries` endpoint, which may create `CatalogueInquiry` records only when the previously added migration and backend are deployed.
Security impact: No secrets exposed. Inquiry payloads remain minimal, validated by the existing backend, and include simple honeypot protection on the frontend. No payments, automated notifications, CRM/admin screens, inventory automation, or private/internal APIs were added.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/backend/src/catalogue.js` passed. `pnpm --filter @faako/stroane-web exec prisma validate` passed. `node --check scripts/check-project-registry.mjs` passed. `pnpm run project-registry:check` passed with warning-only app coverage notes. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `git diff --check` passed.
Rollback notes: Revert the catalogue hook, Shop/ProductList/ProductDetail/Contact/ProductInquiryForm UI changes, project-registry metadata update, and documentation updates. No database rollback is required.
Next step: Deploy/test the Stroane backend and database pairing in Railway, verify live inquiry persistence from Cloudflare Pages, and complete product image/manual-review cleanup.

### Stroane database and deployment foundation

Date: 2026-05-19
Feature/change name: Stroane database, deployment, and portfolio registry foundation
What changed: Added additive Prisma/Postgres models and migration for catalogue categories, catalogue products, catalogue inquiries, and public business profile content. Updated the Stroane backend database URL resolution to prefer environment-specific database URLs while supporting Railway-style `DATABASE_URL`. Changed the inquiry endpoint from acknowledgement-only to validated minimal persistence when the migration is deployed. Added a catalogue seed script for importing the centralized JSON catalogue into Postgres. Added shared Stroane project metadata to the new `@faako/config` portfolio project registry and added a warning-only project registry check for future byNana portfolio/case-study readiness. Updated env examples and deployment documentation for Cloudflare Pages frontend, Railway backend/database, DNS/email provider, optional Dev ERP Stroane API monitoring, and portfolio metadata safety.
Why it changed: Prepare Stroane for production-safe backend/data deployment and future operational scaling without turning it into an ERP or adding payments/CRM automation, while giving the byNana portfolio a safe shared metadata source to consume later.
Files changed: apps/stroane-web/prisma/schema.prisma, apps/stroane-web/prisma/migrations/20260519000000_add_catalogue_inquiry_foundation/migration.sql, apps/stroane-web/prisma/seed-catalogue.mjs, apps/stroane-web/package.json, apps/stroane-web/.env.example, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/README.md, apps/bynana-portfolio/README.md, package.json, packages/config/src/projectRegistry/projectRegistry.js, packages/config/src/index.js, packages/config/src/index.ts, packages/config/README.md, scripts/check-project-registry.mjs, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md
Data impact: Additive schema and optional seed/import foundation only. Running the migration creates new catalogue/inquiry tables; running the seed upserts catalogue/product/business-profile records from the existing JSON seed. Existing legacy `Product`, `SiteUser`, payment, order, inventory, and unrelated app data are not changed.
Security impact: Secrets remain server-side. Inquiry data is validated, trimmed, rate-limited by existing API middleware, and minimized before persistence. Portfolio metadata is intentionally public-safe, marks case study publishing disabled, and avoids private backend/admin details. No automated email/WhatsApp/SMS, payments, admin CRM, inventory automation, public case study publishing, or public inquiry admin views were added.
Testing done: `pnpm --filter @faako/stroane-web exec prisma validate` passed. `node --check apps/stroane-web/backend/server.js` passed. `node --check apps/stroane-web/prisma/seed-catalogue.mjs` passed. Catalogue inquiry helper import check passed. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run monitoring:check` passed. `pnpm run project-registry:check` passed with warning-only coverage notes. `git diff --check` passed.
Rollback notes: Revert the schema/migration/seed script, backend inquiry persistence change, env/doc updates, and package script. If the migration has already been applied, archive any needed inquiries first, then drop the added catalogue/inquiry/business-profile tables and `CatalogueInquiryStatus` enum.
Next step: Deploy a Stroane backend to Railway, attach Railway or Supabase Postgres, apply migrations, seed catalogue data, test inquiry persistence from the deployed frontend, and later plan byNana portfolio UI consumption from the shared project registry.

### Stroane catalogue and backend foundation

Date: 2026-05-19
Feature/change name: Stroane catalogue and backend foundation
What changed: Added a normalized Stroane catalogue seed from the reviewed thermometer catalogue, thermometer price list, and food safety posters/aprons brochure; added typed frontend catalogue helpers; replaced placeholder backend product routes with read-only category/product APIs; added a validated inquiry acknowledgement endpoint; added a product-detail inquiry form for quote-only items; updated shop/search/contact/product pages to use the catalogue structure; and added optional Stroane API monitoring metadata to the shared monorepo app registry without forcing it on unless a backend URL is configured.
Why it changed: Stroane needs a production-safe catalogue and inquiry foundation before any future payments, CRM, admin, inventory, or ERP-style expansion.
Files changed: apps/stroane-web/src/data/stroaneCatalogue.json, apps/stroane-web/src/data/products.ts, apps/stroane-web/src/types/index.ts, apps/stroane-web/src/api/products.ts, apps/stroane-web/src/components/ProductInquiryForm.tsx, apps/stroane-web/src/pages/Home.tsx, apps/stroane-web/src/pages/Shop.tsx, apps/stroane-web/src/pages/ProductDetail.tsx, apps/stroane-web/src/pages/ProductList.tsx, apps/stroane-web/src/pages/Search.tsx, apps/stroane-web/src/pages/Checkout.tsx, apps/stroane-web/src/pages/Contact.tsx, apps/stroane-web/src/pages/About.tsx, apps/stroane-web/src/styles/globals.css, apps/stroane-web/src/styles/pages/Shop.css, apps/stroane-web/src/styles/pages/ProductDetail.css, apps/stroane-web/backend/server.js, apps/stroane-web/backend/src/catalogue.js, apps/stroane-web/tsconfig.app.json, apps/stroane-web/README.md, packages/config/src/monorepoApps/appRegistry.js, packages/config/README.md, docs/apps/dev-erp/implementation-notes.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/platform-progress-log.md, docs/platform/platform-status.md
Data impact: No server data changes. Catalogue data is seed/config data. Inquiry endpoint validates and acknowledges submissions but does not persist leads or create orders.
Security impact: No secrets exposed. Inquiry payloads are validated and trimmed; no automated emails, payments, CRM writes, inventory changes, or customer-data persistence were added. Backend CORS/rate-limit/security headers remain in place.
Testing done: `node --check apps/stroane-web/backend/server.js` passed. Catalogue helper import check returned 8 products and 4 categories, and confirmed optional `stroane-api` monitoring emits when a backend base URL is supplied. `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed. `pnpm run monitoring:check` passed. `git diff --check` passed.
Rollback notes: Revert the catalogue seed/helpers, backend catalogue routes, inquiry form, storefront wiring, monitoring metadata, and documentation updates. No database rollback is required.
Next step: Complete full catalogue data extraction/manual review, map final product images, and decide whether inquiry persistence should use Postgres or a notification-only workflow.

### Production verification and lint stabilization

Date: 2026-05-17
Feature/change name: Production verification and lint stabilization
What changed: Re-ran Stroane Web lint, type, and build checks after recent edits. Added the missing `typescript-eslint` dev dependency and updated `eslint.config.js` to use flat-config-compatible TypeScript, React Hooks, React Refresh, browser, and Node settings. Removed an unused `Link` import from `Services.tsx`, removed an unused `quoteHref` helper from `Shop.tsx`, and cleaned obsolete ESLint disable comments in `backend/server.js` without changing backend behavior. Documented that current sign-in/sign-up and Paystack checkout helpers are front-end-only until backend validation exists. Shared app-mode helpers and generic maintenance/read-only/degraded UI wrappers are available for future opt-in use, but no Stroane runtime maintenance behavior was wired in this phase.
Why it changed: Stroane Web is the first paying client project and needed passing core checks before further feature work.
Files changed: apps/stroane-web/eslint.config.js, apps/stroane-web/package.json, apps/stroane-web/backend/server.js, apps/stroane-web/src/pages/Services.tsx, apps/stroane-web/src/pages/Shop.tsx, pnpm-lock.yaml, apps/stroane-web/README.md, docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/implementation-notes.md, docs/platform/codex-handoff-verification.md, docs/platform/platform-progress-log.md, packages/config/src/appModes/appModes.js, packages/ui/src/components/ERPNotifications.tsx, packages/ui/src/ui.css
Data impact: None.
Security impact: Tooling and unused-symbol cleanup only. No backend API behavior, payment verification, auth enforcement, checkout persistence, database schema, or production workflow changed.
Testing done: `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit` passed. `pnpm --filter @faako/stroane-web run lint` passed. `pnpm --filter @faako/stroane-web run build` passed.
Rollback notes: Revert the lint config/dependency cleanup and unused-symbol removals if a different lint strategy is chosen. No data rollback required.
Next step: Review frontend-only auth and Paystack checkout assumptions before production fulfillment workflows rely on them.

### Documentation foundation added

Date: 2026-05-10
Feature/change name: Documentation foundation added
What changed: Added the standard app documentation set for progress tracking, system status, deploy readiness, and implementation notes.
Why it changed: Establish a consistent documentation baseline for Stroane Web as part of the Faako monorepo platform.
Files changed: docs/apps/stroane-web/progress-log.md, docs/apps/stroane-web/system-status.md, docs/apps/stroane-web/pre-deploy-checklist.md, docs/apps/stroane-web/implementation-notes.md
Data impact: None. Documentation-only change.
Security impact: None. No auth, permission, secret, or runtime behavior changed.
Testing done: Documentation structure reviewed for consistency.
Rollback notes: Remove the added Stroane Web documentation files if this documentation foundation needs to be reverted.
Next step: Keep this log updated for client-facing commerce changes, backend changes, deployments, and data-impacting work.

### Public-site redesign sweep and missing-page build-out

Date: 2026-05-14
Feature/change name: Public-site redesign sweep and missing-page build-out
What changed:
- Added a sitewide scroll-to-top button via the shared Layout so every page picks it up.
- Redesigned the Services page: sticky-scroll storytelling for the services list (each service gets an accent colour, icon, watermark number, and image background), and a tab-stepper for the How It Works steps.
- Redesigned the Shop page: hero brought in line with About/Services pattern; product cards reduced to category + name + price + availability with a 1px border; replaced the "Add to quote" button with quantity controls (+/qty/+, plus bin icon to remove).
- Added a Product Detail page with a split layout (sticky image gallery on the left; details, large quantity controls, features, specs, and related products on the right).
- Extracted shared modules to make the catalogue and basket cross-page: `src/data/products.ts` (products + helpers), `src/context/CartContext.tsx` (persistent cart state), and `src/components/QuantityControls.tsx` (reusable add/qty/trash widget). `CartProvider` wraps the app in `main.tsx`.
- Redesigned the Resources page: featured guide + list layout for guides, simple accordion (single-open) for FAQs. Hero, standards, and CTA untouched.
- Built the five footer-linked pages that didn't exist yet: Contact (image hero + mailto form + direct channels), Terms, Privacy, Cookies (all three using a new shared `LegalLayout` with breadcrumb, "on this page" TOC, numbered sections, and footer link to Contact), and Sitemap (auto-generated from `products` + `categoryOptions`, organised into Company / Store / Products / Legal groups).
- Redesigned the ErrorPage as a split layout — oversized rotated/outlined status digits on the left, eyebrow + heading + message + primary/ghost CTAs + helpful-link grid on the right.
- Header fix: pages without an image hero now get the dark/solid header variant from page load using a `HERO_ROUTES` allowlist in `Header.tsx`. Added a `page-header--static` modifier that suppresses the `slideDown` entry animation on those pages. Also fixed the hamburger menu button leaking onto desktop — it now hides at `min-width: 901px` while the inline nav is shown.
- Routes added in `App.tsx`: `/contact`, `/terms`, `/privacy`, `/cookies`, `/sitemap`.

Why it changed: First paying-client polish pass. The pre-existing storefront pages were card- and text-heavy and weren't visually consistent; the policy/contact/sitemap pages were referenced from the footer but didn't exist (broken links); the header text was invisible on no-hero pages once those were added.
Files changed:
- apps/stroane-web/src/App.tsx
- apps/stroane-web/src/main.tsx
- apps/stroane-web/src/components/Layout.tsx
- apps/stroane-web/src/components/Header.tsx
- apps/stroane-web/src/components/ScrollToTop.tsx (new)
- apps/stroane-web/src/components/QuantityControls.tsx (new)
- apps/stroane-web/src/components/LegalLayout.tsx (new)
- apps/stroane-web/src/context/CartContext.tsx (new)
- apps/stroane-web/src/data/products.ts (new)
- apps/stroane-web/src/pages/Services.tsx
- apps/stroane-web/src/pages/Shop.tsx
- apps/stroane-web/src/pages/ProductDetail.tsx
- apps/stroane-web/src/pages/Resources.tsx
- apps/stroane-web/src/pages/ErrorPage.tsx
- apps/stroane-web/src/pages/Contact.tsx (new)
- apps/stroane-web/src/pages/Terms.tsx (new)
- apps/stroane-web/src/pages/Privacy.tsx (new)
- apps/stroane-web/src/pages/Cookies.tsx (new)
- apps/stroane-web/src/pages/Sitemap.tsx (new)
- apps/stroane-web/src/styles/components/ScrollToTop.css (new)
- apps/stroane-web/src/styles/components/QuantityControls.css (new)
- apps/stroane-web/src/styles/components/LegalLayout.css (new)
- apps/stroane-web/src/styles/components/Header.css
- apps/stroane-web/src/styles/pages/Services.css
- apps/stroane-web/src/styles/pages/Shop.css
- apps/stroane-web/src/styles/pages/ProductDetail.css
- apps/stroane-web/src/styles/pages/Resources.css
- apps/stroane-web/src/styles/pages/ErrorPage.css
- apps/stroane-web/src/styles/pages/Contact.css (new)
- apps/stroane-web/src/styles/pages/Sitemap.css (new)

Data impact: None. Catalogue source-of-truth moved from inline arrays in `Shop.tsx` to `src/data/products.ts` with no schema or product changes. Cart state lives in client memory only (`CartContext`) — no persistence, no backend writes.
Security impact: None. No auth, permission, secrets, or backend endpoints touched. The Contact form submits via a pre-filled `mailto:` to `info@stroanesolutions.com` (no server-side handler added).
Testing done: Visual checks across pages on desktop and mobile breakpoints. Sticky-scroll storytelling and tab-stepper interactions verified for keyboard and pointer use. Cart state verified to persist across navigation between Shop and Product Detail. Header variant verified on hero pages (transparent → solid on scroll) and no-hero pages (solid from load, no entry animation). Hamburger menu confirmed hidden on desktop.
Rollback notes: Revert the commit. All work is additive or contained — restoring the previous Shop/Services/Resources/ErrorPage files and removing the new pages, components, contexts, and shared data module, plus the five new App routes and the `CartProvider` wrapper in `main.tsx`, returns to the pre-redesign state.
Next step: Drop in real `service_7.png` and `service_8.png` images for the last two services (currently reuse 1 and 2). Decide whether to back the Contact form with a real submission endpoint instead of `mailto:`. Consider persisting `CartContext` to `localStorage` so the basket survives reloads once the client confirms desired behavior.

### Auth gate and admin user-management removed

Date: 2026-05-14
Feature/change name: Auth gate and admin user-management removed
What changed: Removed the preview-access login gate, the `AuthContext`/`AuthProvider`/`AuthGate` components, the `/users` admin route, the `UserManagement` page, and the Netlify `/api/*` proxy that was pointing at a non-existent Railway backend service. Stripped `useAuth` calls and the conditional admin "Users" link from both `Header` and `FloatingHeader`. Public site is now open — anyone can browse without credentials.
Why it changed: No Express backend is deployed (only the Railway Postgres database), so the gate could never authenticate users. The client wants the site publicly accessible; admin user-management was only needed to manage gate credentials and has no remaining purpose.
Files changed:
- apps/stroane-web/src/main.tsx (drop AuthProvider/AuthGate wrappers)
- apps/stroane-web/src/App.tsx (drop UserManagement import and /users route)
- apps/stroane-web/src/components/Header.tsx (drop useAuth and admin link)
- apps/stroane-web/src/components/FloatingHeader.tsx (drop useAuth and three admin link blocks)
- apps/stroane-web/netlify.toml (drop /api/* proxy)
- Deleted: apps/stroane-web/src/context/AuthContext.tsx
- Deleted: apps/stroane-web/src/components/AuthGate.tsx
- Deleted: apps/stroane-web/src/styles/components/AuthGate.css
- Deleted: apps/stroane-web/src/pages/UserManagement.tsx
- Deleted: apps/stroane-web/src/styles/pages/UserManagement.css
- Deleted: apps/stroane-web/railway.json (no backend service to deploy)
Data impact: Stroane preview-access seeds in `apps/stroane-web/prisma/seeds/users.csv` are now orphaned (no consumer). They can remain in the repo for reference or be removed in a follow-up. No production data changes.
Security impact: The site is now publicly accessible — no credential gate. Acceptable: the public content is marketing/store-catalogue only, the Contact form submits via `mailto:`, and there is no client-side state worth protecting. The Express backend code in `backend/` and the `/api/auth/*` routes remain in the repo but are not deployed and not reachable from production.
Testing done: Verified no remaining `useAuth`/`AuthGate`/`AuthProvider`/`UserManagement` references via grep. Header and FloatingHeader render without the admin link.
Rollback notes: `git revert` restores the gate, the admin page, and the proxy. The deleted files come back via git history. If the gate is re-introduced later, an actual backend deployment is needed first or login will fail the same way it did before.
Next step: Decide whether to delete the unused backend (`backend/`, `prisma/`, auth routes, seeds) entirely, or keep it for a possible future admin area. Update `pre-deploy-checklist.md` and the Stroane README to reflect the public-site posture.
### Catalogue reconciliation, portal inventory bootstrap, and shell loading polish

Date: 2026-05-31
Feature/change name: Stroane production catalogue reconciliation and inventory portal bootstrap
What changed:
- Added read-only catalogue reconciliation planning plus an opt-in apply command that upserts the normalized catalogue, archives stale public product rows, and deactivates stale categories without deleting records.
- Added dry-run-by-default inventory bootstrap plus an opt-in apply command that creates only missing base `InventoryItem` rows, keeps unknown quantities nullable, preserves existing inventory records, and writes an audit entry per created row.
- Fixed shared ERP sidebar navigation rows stretching vertically by top-aligning the grid content.
- Updated the Stroane portal mobile bottom navigation to expose Overview, Inventory, Suppliers, Products, and Settings, tightened narrow-screen labels, and contained dense inventory-table scrolling inside the table surface.
- Added the shared `AnimatedLoadingState` feedback component and used it for lazy route transitions plus private inventory, supplier, and movement fetches.
- Clarified the inventory empty state: bootstrapped rows remain unavailable until staff records a physical count or restock movement.
Data impact: No automatic startup write. The reviewed production apply completed intentionally: 16 normalized products were added, 6 stale products were archived, 3 stale categories were deactivated, and 18 missing inventory records plus 18 bootstrap audit entries were created. Existing rows were not deleted and stock counts remain unknown until staff records physical counts or restocks.
Security impact: No secrets are exposed. Scripts load app-root environment files, require an explicit apply command for inventory creation, never overwrite existing stock counts, and keep unknown-stock products non-purchasable.
Testing done: `node --check` for catalogue and inventory scripts, `git diff --check`, Stroane lint, Stroane build, Prisma validate, backend test suite, Playwright portal checks, and desktop/mobile shell visual audit.
Rollback notes: Revert the script/UI changes. If reconciliation was applied, restore archived rows intentionally from a reviewed backup or by publishing the required product rows; inventory bootstrap rows are additive audit-backed records and should be reviewed before removal.
Next step: Enter physical stock counts through audited movements, redeploy the Cloudflare portal for UI polish, and verify the protected inventory workspace against Railway after the deploy.

### Storefront and portal natural-height layout cleanup

Date: 2026-06-17
Feature/change name: Storefront and portal natural-height layout cleanup
What changed: Removed the stretch rules that were making checkout, shop, product-list, product-detail related cards, and orders modal panels look taller or wider than their content. The broad global `section:not(...)` full-height rule was replaced with an opt-in utility so product cards and ordinary content sections are no longer forced to `100dvh`. Shop product/category grids now top-align cards, the catalogue overview no longer reserves `20dvh`, product cards no longer force `100%` height, checkout pickup choices use content-height cards, and the checkout CTA uses a natural desktop width with mobile full-width behavior.
Why it changed: Page elements were still reading as stretched after the first cleanup because a global section selector was forcing all non-hero sections, including UI card sections rendered by shared components, to viewport height.
Files changed:
- apps/stroane-web/src/styles/globals.css
- apps/stroane-web/src/frontend/styles/Checkout.css
- apps/stroane-web/src/frontend/styles/Shop.css
- apps/stroane-web/src/frontend/styles/ProductList.css
- apps/stroane-web/src/frontend/styles/ProductDetail.css
- apps/stroane-web/src/portal/styles/order-management.css
Data impact: None.
Security impact: None.
Testing done: `git diff --check` passed for the touched files, `pnpm --filter @faako/stroane-web exec tsc -p tsconfig.app.json --noEmit --pretty false` passed, and local browser smoke verified shop catalogue overview/card heights dropped from viewport-height to natural content height. Checkout smoke with a seeded cart verified the form, summary, pickup cards, field rows, and primary CTA use natural sizing.
Rollback notes: Revert the CSS alignment and sizing changes if the team wants equal-height card rows again.
Next step: Refresh the local browser session and continue checking any page-specific sections that still need deliberate full-height treatment.
