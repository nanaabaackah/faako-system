# Faako Website System Status

## App purpose

Faako Website is the public marketing site and signup funnel for Faako. It presents product information, pricing, onboarding entry points, and calls the dedicated Faako API.

## Current status

Public-facing marketing and signup surface. Treat brand presentation, signup availability, API routing, and environment configuration as production-sensitive.

## Stable modules/features

- React and Vite public website structure.
- Static deployment configuration.
- Signup routing through `VITE_API_BASE_URL` or the local Vite `/api` proxy.
- Client onboarding intake wizard UI with review/submit flow.

## In-progress modules/features

- Marketing content, pricing, signup, and onboarding improvements.
- Deployment and API routing polish.
- Alignment with Faako API behavior.
- Internal onboarding review/checklist workflow planning.

## Experimental modules/features

- New conversion experiments, signup variants, or onboarding flows until validated.
- API behavior in new environments until tested.

## High-risk areas

- Signup flow and API base URL configuration.
- Public pricing, product claims, and onboarding copy.
- Server-side secrets belong on the Faako API service.
- Browser-visible `VITE_*` configuration.

## Production sensitivity

Medium to high. The site is public-facing and can influence trust, lead capture, and signup success.

## Before-every-deploy questions

- Does this change affect signup, pricing, onboarding, or public product claims?
- Is `VITE_API_BASE_URL` intentionally set or intentionally omitted?
- Are server-side secrets configured only on the correct deployment target?
- Are onboarding emails configured through server-side env vars, not browser-visible `VITE_*` values?
- Has the signup path been manually tested after build?
- Is rollback available through the current static host?
