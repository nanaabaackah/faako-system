# Faako Website Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/faako-website` only, or list every shared package/app also affected.

## Environment affected

- Identify local, preview, staging, or production.
- Confirm static host, domain, and API target.

## Auth and roles

- Confirm no private/admin behavior is exposed through the public site.
- Verify any protected onboarding handoff goes through the correct backend.

## API permissions

- Confirm signup calls the intended API origin.
- Verify API errors are handled without leaking server details.

## Database/data loss risk

- The website should not directly change database schema.
- Review Faako API migration/data risks before deploy when signup behavior changes.

## Customer/user data

- Protect signup form submissions and lead data.
- Avoid logging personal data or exposing secrets in client bundles.

## Payments/receipts if relevant

- Verify any pricing, plan selection, payment handoff, or receipt-related copy/integration if present.

## Inventory/bookings/orders if relevant

- Not normally applicable. If onboarding creates operational records, verify the downstream API behavior.

## Environment variables

- Compare required values against `apps/faako-website/.env.example`.
- Confirm `VITE_*` values are browser-safe.
- Keep backend secrets on the Faako API service.

## Static Deployment

- Confirm build command, publish directory, static headers/redirects, and API base URL.

## Rollback plan

- Identify previous known-good static deploy.
- Confirm whether rollback also requires reverting a Faako API deploy.
- Preserve signup leads submitted during any incident window.

## Manual testing

- Test public pages, navigation, pricing, signup form, API errors, and mobile layout.
- Test with the same API routing mode intended for production.

## Post-deploy verification

- Confirm the deployed site loads from the public domain.
- Confirm signup succeeds or fails gracefully.
- Check API logs for unexpected errors.
