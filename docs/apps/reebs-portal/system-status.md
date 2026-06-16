# REEBS Portal System Status

## App purpose

REEBS Portal is the authenticated admin and operations portal for REEBS. It supports product and variant management, bookings, orders, invoicing, delivery, accounting, website content, and internal operational modules.

## Current status

Live/private beta and used by authenticated users. Treat changes as production-sensitive unless explicitly scoped to local or demo-only behavior.

## Stable modules/features

- Authenticated portal shell and role-based navigation.
- Core operations modules such as orders, inventory, CRM, users, employees, directory, maintenance, timesheets, and rentals.
- Admin modules for bookings, schedule, accounting, expenses, vendors, delivery, documents, settings, HR, roles, invoicing, marketing, advanced tools, and website templates.
- Express API wrapper at `api.reebspartythemes.com` adapting the existing backend handlers, plus Prisma-managed database workflows.
- Shared `AppUpdateNotice` in the portal/public/store-mode shell paths prompts for a user-controlled refresh when a newer deployed frontend bundle exists without forcing active operational work to reload.

## In-progress modules/features

- Ongoing admin workspace and operational workflow refinements.
- Product, variant, booking, scheduling, invoicing, and receipt workflow hardening.
- Reporting and audit visibility improvements.

## Experimental modules/features

- Advanced website template tooling.
- Any newly introduced operational modules not yet validated by repeated private-beta usage.

## High-risk areas

- Auth, role normalization, permissions, and privileged admin routes.
- Orders, payments, receipts, invoices, accounting, and revenue recognition.
- Inventory, variants, product source categories, bookings, scheduling, delivery, and fulfillment.
- Prisma migrations, production data changes, imports, and relinking scripts.
- Customer, employee, HR, audit log, and personal data handling.

## Production sensitivity

High. The app is live/private beta, authenticated, and operational. Data loss, permission mistakes, receipt inaccuracies, or booking/order regressions can affect real users and business records.

## Before-every-deploy questions

- Does this change affect authenticated users or role visibility?
- Does this change affect orders, bookings, inventory, invoices, receipts, accounting, or delivery?
- Does this change require a Prisma migration, data import, relink script, or seed step?
- Were environment variables changed, especially secrets or browser-visible `VITE_*` values?
- Has the affected workflow been manually checked with the correct role?
- Is there a clear rollback path if production users report a regression?
