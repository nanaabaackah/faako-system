# Faako Website System Status

## App purpose

Faako Website is the public marketing site and signup funnel for Faako. It presents product information, pricing, onboarding entry points, and calls either a dedicated Faako API deployment or mirrored local Netlify Functions.

## Current status

Public-facing marketing and signup surface. Treat brand presentation, signup availability, routing, function sync, and environment configuration as production-sensitive.

## Stable modules/features

- React and Vite public website structure.
- Netlify deployment configuration.
- Prebuild sync from `apps/faako-api` for mirrored functions.
- Signup routing through `VITE_API_BASE_URL` or local mirrored `/api/*` functions.
- Client onboarding intake wizard UI with review/submit flow.

## In-progress modules/features

- Marketing content, pricing, signup, and onboarding improvements.
- Deployment and API routing polish.
- Alignment with Faako API function behavior.
- Internal onboarding review/checklist workflow planning.

## Experimental modules/features

- New conversion experiments, signup variants, or onboarding flows until validated.
- Mirrored function behavior in new environments until tested.

## High-risk areas

- Signup flow, API base URL configuration, and mirrored function sync.
- Public pricing, product claims, and onboarding copy.
- Server-side secrets when the website owns functions directly.
- Browser-visible `VITE_*` configuration.

## Production sensitivity

Medium to high. The site is public-facing and can influence trust, lead capture, and signup success.

## Before-every-deploy questions

- Does this change affect signup, pricing, onboarding, or public product claims?
- Is `VITE_API_BASE_URL` intentionally set or intentionally omitted?
- If functions are mirrored, did the sync step pull the expected Faako API functions?
- Are server-side secrets configured only on the correct deployment target?
- Are onboarding emails configured through server-side env vars, not browser-visible `VITE_*` values?
- Has the signup path been manually tested after build?
- Is rollback available through a previous Netlify deploy?
