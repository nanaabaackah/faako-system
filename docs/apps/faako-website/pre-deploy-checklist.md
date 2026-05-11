# Faako Website Pre-Deploy Checklist

## App affected

- Confirm the deploy includes `apps/faako-website` only, or list every shared package/app also affected.

## Environment affected

- Identify local, preview, staging, or production.
- Confirm Netlify site, domain, API target, and function ownership model.

## Auth and roles

- Confirm no private/admin behavior is exposed through the public site.
- Verify any protected onboarding handoff goes through the correct backend.

## API permissions

- Confirm signup calls the intended API origin or mirrored `/api/*` function.
- Verify API errors are handled without leaking server details.

## Database/data loss risk

- The website should not directly change database schema.
- If mirrored functions are active, review Faako API migration/data risks before deploy.

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
- Keep backend secrets on the website only when the website owns the server-side function deployment.

## Netlify/Railway deployment

- Confirm Netlify build command, publish directory, config file, headers, redirects, and function routing.
- Railway is not the primary deployment target for this public website.
- Run the app-specific selective deploy check when needed: `node ./scripts/netlify-ignore.mjs @faako/faako-website`.

## Rollback plan

- Identify previous known-good Netlify deploy.
- Confirm whether rollback also requires reverting a Faako API deploy.
- Preserve signup leads submitted during any incident window.

## Manual testing

- Test public pages, navigation, pricing, signup form, API errors, and mobile layout.
- Test with the same API routing mode intended for production.

## Post-deploy verification

- Confirm the deployed site loads from the public domain.
- Confirm signup succeeds or fails gracefully.
- Check Netlify Function and API logs for unexpected errors.
