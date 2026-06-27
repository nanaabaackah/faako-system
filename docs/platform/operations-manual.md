# Faako System Operations Manual

Updated: 2026-06-25

## Purpose

This manual is the quick operating guide for the Faako monorepo. It explains where each app lives, how to run common checks, what security rules must stay intact, and what to inspect when a storefront, portal, or API flow breaks.

## App Map

| App | Path | What it owns | Local command |
| --- | --- | --- | --- |
| Faako API | `apps/faako-api` | Signup API, health checks, Faako website backend | `pnpm --filter @faako/faako-api run dev` |
| Faako Website | `apps/faako-website` | Public Faako marketing and signup | `pnpm --filter @faako/faako-website run dev:frontend` |
| Faako ERP | `apps/faako-erp` | Shared-shell ERP reference frontend | `pnpm --filter @faako/faako-erp run dev:frontend` |
| REEBS Portal | `apps/reebs-portal` | Authenticated REEBS admin portal and API handlers | `pnpm --filter @faako/reebs-portal run dev:with-backend` |
| REEBS Website | `apps/reebs-website` | Public store, rentals, cart, checkout, bookings | `pnpm --filter @faako/reebs-website run dev:with-backend` |
| Dev ERP | `apps/dev-erp` | Live operational ERP, API, reports, rent, invoices, integrations | `pnpm --filter @faako/dev-erp run dev:with-backend` |
| ByNana Portfolio | `apps/bynana-portfolio` | Public portfolio and contact surfaces | `pnpm --filter @faako/bynana-portfolio run dev` |
| Stroane Web | `apps/stroane-web` | Stroane public commerce app and protected portal | `pnpm --filter @faako/stroane-web run dev:with-backend` |
| System Starter | `apps/system-starter` | Shared shell starter app | `pnpm --filter @faako/system-starter run dev` |
| UI Workbench | `apps/ui-workbench` | Shared UI playground | `pnpm --filter @faako/ui-workbench run dev` |

## Daily Checks

Run these from the repo root before shipping broad changes:

```bash
pnpm lint
pnpm build
pnpm test
pnpm run monitoring:check
pnpm run hosting:check
pnpm run project-registry:check
pnpm security:all
```

For targeted app validation, prefer filtered commands:

```bash
pnpm --filter @faako/reebs-website run lint
pnpm --filter @faako/reebs-portal run lint
pnpm --filter @faako/stroane-web run typecheck
pnpm --filter @faako/bynana-portfolio run lint
```

## REEBS Storefront Troubleshooting

If rentals show `Failed to fetch machines` or `/api/machines` returns 500:

- Check `apps/reebs-portal/backend/functions/machines.js`.
- Raw SQL that joins `machines` and `product` must qualify machine columns with the `m.` alias. Unqualified columns such as `id`, `name`, `quantity`, or `organizationId` can become ambiguous after joins.
- The endpoint should degrade to an empty array when the table is missing, but schema drift inside an existing table should be fixed instead of hidden.
- The `Machine` Prisma model currently includes `organizationId`, `productId`, `quantity`, `price`, `rate`, `availability`, `category`, `image`, `page`, `power`, `output`, and `notes`. Optional display fields should be guarded before use.

If checkout confirmation looks blank:

- Check the `.checkout-summary`, `.checkout-summary-group`, `.checkout-item`, and `.checkout-modal-main` surfaces in `apps/reebs-website/src/pages/Checkout/Checkout.css`.
- The right column must keep an explicit background and text color. Transparent panels can disappear over image-heavy storefront backgrounds.
- Checkout should keep the customer in one focused flow and show recommended products without blocking the payment/confirmation action.

If rental detail text is hard to read:

- Check `apps/reebs-website/src/pages/RentalItem/RentalItem.css`.
- Detail cards, hero panels, specs, and similar rentals should use dark readable surfaces over the photo-led rental layout.
- Rental availability must come from booking/working/availability state, not shop stock alone.

## Auth And Security Rules

- Enforce roles on the server/API, not only through hidden navigation.
- Unauthorized portal users should not see protected routes or module chrome before access is resolved.
- Public storefront account creation must not create portal/admin users. Portal user creation belongs in the relevant portal/team module.
- Treat `VITE_*` variables as public. Never place secrets, private API keys, database URLs, payment secrets, session secrets, or webhook secrets in browser-visible env vars.
- Use parameterized queries, Prisma query builders, or safely-constructed raw SQL. Never concatenate user input into SQL.
- Validate redirect targets with same-origin or relative-path helpers before calling `res.redirect`.
- Keep password reset, invite, and account creation tokens short-lived, one-time-use, and stored hashed where persistence is required.
- Do not store auth tokens, payment secrets, or private customer records in localStorage. Local offline queues may store drafts only after minimization.
- Keep `dangerouslySetInnerHTML` limited to trusted static content or JSON-LD produced from safe internal data.

## Loading And Performance Rules

- Skeleton loaders should model the page that is loading: dashboard grids should look like dashboard grids, tables like tables, checkout like checkout, and detail pages like detail pages.
- Route-level skeletons should fill the available viewport width and height so the app does not flash a small generic placeholder.
- Saves, uploads, payment actions, auth actions, and long-running imports should show action-specific loading states and should disable duplicate submissions.
- Keep large operational pages stable before splitting them. Add focused tests or screenshots first, then extract data hooks, pure formatters, repeated cards/tables, and modal bodies in that order.

## Large-File Refactor Queue

These files are useful cleanup targets, but they touch important behavior and should be split in small reviewed steps:

- `apps/dev-erp/backend/server.js`
- `apps/reebs-portal/src/pages/Admin/Admin.jsx`
- `apps/reebs-portal/src/pages/AdminInvoicing/AdminInvoicing.jsx`
- `apps/reebs-portal/src/pages/AdminWorkspace/AdminWorkspace.jsx`
- `apps/reebs-portal/src/styles/admin.css`
- `apps/reebs-website/src/styles/admin.css`
- `apps/faako-website/src/styles/pages/Home.css`
- `packages/ui/src/ui.css`

## Documentation Rule

When a feature, module, workflow, endpoint, environment variable, security rule, or deployment behavior changes, update the nearest app README or `docs/apps/<app>/implementation-notes.md`. Cross-app decisions belong in `docs/platform/` or `docs/decisions/README.md`.
