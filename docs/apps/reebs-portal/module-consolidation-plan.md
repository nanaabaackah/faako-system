# REEBS Portal Module Consolidation Plan

## Purpose

Document a safe, app-specific consolidation path for REEBS Portal modules before any implementation. This is planning-only and must not change routes, auth behavior, database schema, files, redirects, or business workflows.

## Current implementation status

Team navigation consolidation is implemented as the first low-risk step. `/admin/users`, `/admin/employees`, `/admin/directory`, `/admin/hr`, `/admin/roles`, and `/admin/timesheets` are grouped visually under Team in sidebar navigation while all existing routes remain valid.

Settings navigation consolidation is implemented as the second low-risk step. `/admin/settings`, `/admin/advanced`, `/admin/website-template`, `/admin/inventory/products`, and `/admin/inventory/templates` are grouped visually through Settings metadata while all existing routes and redirect targets remain valid.

Bookings navigation consolidation is implemented as the third low-risk step. `/admin/bookings`, `/admin/rentals`, and `/admin/schedule` are grouped visually through Bookings metadata while all existing routes and workflows remain valid.

## 1. Current modules/routes

Current top-level or primary module areas:

- Home: `/admin`
- POS / store mode: `/admin/store-mode`, `/admin/purchases`, `/admin/offline`
- Orders: `/admin/orders`, `/admin/orders/new`, `/admin/orders/:id`
- Bookings and scheduling: `/admin/bookings`, `/admin/schedule`
- Inventory and operations: `/admin/inventory`, `/admin/inventory/products`, `/admin/inventory/templates`, `/admin/rentals`, `/admin/maintenance`, `/admin/water`
- Customers / CRM: `/admin/crm`, legacy `/admin/customers`
- Delivery: `/admin/delivery`
- Finance-adjacent routes: `/admin/accounting`, `/admin/expenses`, `/admin/invoicing`, `/admin/vendors`, `/admin/documents`
- Team routes: `/admin/directory`, `/admin/users`, `/admin/employees`, `/admin/hr`, `/admin/roles`, `/admin/timesheets`, `/admin/profile`
- Reports: `/admin/reports`, `/admin/audit-logs`
- Settings and admin configuration: `/admin/settings`, `/admin/advanced`, `/admin/website-template`, `/admin/marketing`

## 2. Target module structure

Recommended target structure:

- Home
- POS
- Orders
- Bookings
- Inventory
- Customers
- Delivery
- Finance
- Reports
- Team
- Settings

This matches the current registry direction while clarifying where overlapping legacy/admin routes should live in the product model.

## 3. Modules to keep as top-level

- Home: landing workspace and operational overview.
- POS: store mode and purchasing workflows.
- Orders: order list, order builder, and order detail workflows.
- Bookings: booking and event scheduling workflows.
- Inventory: day-to-day rental/shop stock and maintenance workflows. Water inventory remains in the standalone Water Business domain.
- Customers: CRM/customer relationship workflows.
- Delivery: delivery planning and fulfillment workflows.
- Finance: money movement, accounting, invoicing, expenses, vendors, and documents.
- Reports: reporting and audit visibility.
- Team: staff, users, roles, HR, timesheets, and directory.
- Settings: portal configuration, advanced settings, website template/admin configuration, marketing, and inventory settings/admin configuration.

## 4. Modules to group under other modules

- Accounting, expenses, invoicing, vendors, and documents should group under Finance.
- Rentals and schedule should group under Bookings for booking/rental workflow ownership.
- Users, employees, HR, roles, directory, profile, and timesheets should group under Team.
- CRM and legacy customers should group under Customers.
- Website template, advanced, marketing, inventory products, and inventory templates should group under Settings as admin/configuration surfaces.
- Maintenance remains an operational child area of Inventory. Water is a standalone business area and must not be folded into Inventory or core rental/event finance and analytics by default.
- Purchases should remain a POS child for now because current bottom navigation and store workflows already treat it as a buying action.

## 5. Legacy routes to preserve

Preserve every existing route during consolidation:

- `/admin/customers` should continue resolving to `/admin/crm`.
- `/admin/advanced` should continue resolving to `/admin/settings?tab=advanced`.
- `/admin/website-template` should continue resolving to `/admin/settings?tab=advanced`.
- `/admin/users` and `/admin/employees` should continue resolving through the current directory/team behavior.
- `/admin/inventory/products` and `/admin/inventory/templates` must remain valid even if surfaced under Settings.
- `/admin/orders/new` and `/admin/orders/:id` must remain valid.
- `/admin/schedule`, `/admin/rentals`, `/admin/maintenance`, `/admin/water`, `/admin/vendors`, `/admin/documents`, `/admin/timesheets`, `/admin/profile`, and `/admin/audit-logs` must remain valid.

Do not implement new redirects until a separate implementation phase defines exact route behavior.

## 6. Risks

- Navigation grouping could hide live/private-beta workflows from authenticated users.
- Role-specific navigation for Driver, Water, Staff, Warehouse, Manager, Admin, and Owner could drift from backend access checks.
- Moving finance/admin links visually could make receipts, invoices, expenses, vendors, or documents harder to find during live operations.
- Grouping inventory settings under Settings could confuse users who expect product/template settings under Inventory.
- Customers/CRM naming changes could disrupt staff habits or saved instructions.
- Mobile bottom navigation may need separate treatment from desktop sidebar navigation.

## 7. Data impact

Planning-only: none.

Future implementation should be metadata/navigation-only first. Any later data migration, schema change, seed, relink, or backfill must be scoped as a separate production-sensitive task.

## 8. Security impact

Planning-only: none.

Future implementation must not rely on frontend grouping for access control. Backend permission checks, route guards, role normalization, and API permissions must remain authoritative.

## 9. Recommended implementation order

1. Confirm this plan against the live route list and current role matrix.
2. Update registry metadata only: parent module, child module, `includeInNavigation`, labels, status, and legacy route targets. Team, Settings, and Bookings are the first implemented groupings.
3. Add a hidden/internal test mode for grouped navigation without changing route behavior.
4. Verify desktop sidebar and mobile bottom navigation separately for each role.
5. Move finance-adjacent navigation under Finance.
6. Move team-adjacent navigation under Team.
7. Move CRM/customers naming into Customers while preserving `/admin/crm` and `/admin/customers`.
8. Move schedule/rentals navigation under Bookings after booking workflow review. Bookings metadata now owns schedule and rentals; shared booking calendar, linked order/payment flow, rental return workflow, and delivery/setup schedule remain future work.
9. Move website-template, advanced, marketing, inventory products, and inventory templates into Settings after admin configuration review. Settings metadata now owns advanced, website-template, inventory products, and inventory templates; marketing remains visible as an existing Settings-adjacent item until a separate review.
10. Only after repeated validation, consider consolidated page surfaces or redirects in a separate task.

## 10. Rollback notes

- Revert registry metadata changes to the previous flat/child navigation layout.
- Restore previous sidebar and bottom-nav item ordering.
- Keep all existing route components and route declarations in place.
- Do not roll back by deleting routes or business page files.
- If users report workflow disruption, restore the previous labels and top-level visibility first, then review grouping separately.

## 11. Manual testing checklist

- Sign in as Owner/Admin and confirm all top-level and child modules remain reachable.
- Sign in as Manager/Staff/Warehouse and confirm standard modules remain reachable.
- Sign in as Driver and confirm only intended driver workflows remain visible and reachable.
- Sign in as Water and confirm water workflows remain visible and reachable.
- Check `/admin`, `/admin/store-mode`, `/admin/purchases`, `/admin/orders`, `/admin/orders/new`, and an order detail route.
- Check `/admin/bookings`, `/admin/schedule`, and `/admin/rentals`.
- Check `/admin/inventory`, `/admin/inventory/products`, `/admin/inventory/templates`, `/admin/maintenance`, and `/admin/water`.
- Check `/admin/crm` and legacy `/admin/customers`.
- Check `/admin/accounting`, `/admin/expenses`, `/admin/invoicing`, `/admin/vendors`, and `/admin/documents`.
- Check `/admin/directory`, `/admin/users`, `/admin/employees`, `/admin/hr`, `/admin/roles`, `/admin/timesheets`, and `/admin/profile`.
- Check `/admin/reports` and `/admin/audit-logs`.
- Check `/admin/settings`, `/admin/advanced`, `/admin/website-template`, and `/admin/marketing`.
- Confirm desktop sidebar has no duplicate items.
- Confirm mobile bottom navigation still supports current role-specific workflows.
- Confirm no backend/API permission behavior changed.
