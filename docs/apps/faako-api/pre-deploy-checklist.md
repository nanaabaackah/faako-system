# Faako API Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/faako-api` only, or list every shared package/app also affected.

## Environment affected

- Identify local, preview, staging, or production.
- Confirm API host, database URL source, and whether Faako Website points at the intended API origin.

## Auth and roles

- Confirm public API endpoints expose only intended behavior.
- Verify any future protected endpoints have explicit server-side auth.
- If Faako ERP demo access is enabled, verify `FAAKO_ERP_DEMO_ACCESS_SECRET` is server-only, at least 32 characters, and Resend sender env values are configured.

## API permissions

- Verify endpoint routing, allowed methods, validation, and response shape.
- Confirm error responses do not leak secrets, stack traces, or database details.

## Database/data loss risk

- Review Prisma migrations before deploy.
- `pnpm --filter @faako/faako-api run dev` and `pnpm run dev:faako` run local Prisma predeploy automatically before starting.
- Run `pnpm --filter @faako/faako-api run predeploy:local` manually before deployment when signup persistence or Prisma migrations changed and you are not starting dev.
- Deploy the additive signup management migration before relying on Dev ERP status, owner, internal notes, activity timeline, email delivery, or PDF metadata management fields.
- Confirm local commands cannot target production unless explicitly allowed.
- Confirm backups or recovery plan before production schema/data changes.

## Customer/user data

- Protect signup submissions and any lead/customer records.
- Avoid logging personal data, tokens, or secrets.

## Payments/receipts if relevant

- Not normally applicable. If signup later creates paid plans or receipt records, verify those flows before deploy.

## Inventory/bookings/orders if relevant

- Not normally applicable. If signup later provisions operational records, verify downstream data creation.

## Environment variables

- Compare required values against `apps/faako-api/.env.example`.
- Use `DATABASE_URL_DEVELOPMENT` or `DATABASE_URL_LOCAL` for local work.
- Keep local/non-production `EMAIL_FORCE_TO=dev@nanaabaackah.com` so test signup and demo-access emails do not go to input addresses.
- Keep `EXPOSE_DEBUG_ERRORS=false` outside local debugging.
- Do not use `VITE_*` values in this backend-only package.

## API Deployment

- Confirm Node/Express start command, API host, migration command, and Prisma deploy command.
- Root shortcut: `pnpm run predeploy:faako-api`.
- All local app migrations shortcut: `pnpm run predeploy:local`.

## Rollback plan

- Identify previous known-good API deploy.
- Document whether migrations require rollback, restore, or forward-fix.
- Coordinate with Faako Website if API behavior changed.

## Manual testing

- Test `health`.
- Test `signup` success, validation failures, duplicate handling, and error handling.
- Test from Faako Website when website compatibility is affected.

## Post-deploy verification

- Confirm deployed `health` responds.
- Confirm signup flow works through the intended website/API path.
- Check API logs for validation, database, or unexpected runtime errors.
