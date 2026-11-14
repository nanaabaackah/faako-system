# Travel With Ease Smart Enquiry System

Status: local implementation for review. No staging/production migration, deployment or real enquiry execution has been performed.

## Architecture

The existing TWE public website, API and authenticated Traveller inbox remain the system boundaries. Google Forms are not embedded and no second enquiry database is created.

- `questionnaires/index.js` imports unchanged source exports and exposes a versioned, declarative definition.
- `EnquiryForm.jsx` renders route-specific steps and resolves published service/package deep links from a server-produced catalogue.
- `questionnaire-validation.js` independently recomputes applicability on the API and rejects hidden, deferred, unknown, duplicate or invalid answers.
- `submission.js` snapshots questionnaire ID/version, applicable IDs, labels, sections and answers into the existing tenant-scoped `twe.enquiries.details` JSONB record.
- `Enquiries.jsx` retains the authenticated inbox and presents stored answers by snapshotted section instead of raw JSON.
- The existing transaction, idempotency fingerprint, notification outbox, Turnstile, honeypot, rate limit, request-size limit, exact-origin check, permissions and status audit remain in use.

Questionnaire: `twe-smart-enquiry`, version `2026-11-09.1`.

## Source inventory and branching

Unchanged supplied files live under `questionnaires/source/`: Start Here has 7 source items/3 questions; Full Trip Planning has 43 source items/29 questions; the supplied mapping text is retained beside them. Original IDs, wording, descriptions, choices, required flags, order and section associations remain traceable.

- `1428564940` routes readiness, full planning or “not sure”.
- `1653151808` resolves “not sure” and becomes conditionally required.
- `502234433` exposes required visa summary `180737542` only for “Yes”.
- Published service links preselect an approved stable service ID/title.
- Open package links preselect package UUID/title. Invalid, closed or sold-out slugs fall back to a labelled general enquiry.
- `1444304495` accepts at most three unique selections in browser and API validation.
- Every active route reaches contact and privacy acknowledgement.

Browser Back uses History state. Refresh preserves URL service/package context but deliberately does not persist private answers in browser storage.

## Data and privacy decisions

These source questions remain in the audited inventory but are not collected:

- `1811901185`, dietary requirements/allergies: health-data purpose, consent, access and retention are not approved.
- `1263904381` and `1719024406`, priced add-ons: exact commercial wording is not approved as current policy.
- `1366732008` and `858286919`, declarations/refund copy: source refund wording conflicts with or extends current approved CMS terms. The all-five requirement is retained as metadata for a later approved version.

Visa collection is limited to yes/no and, when applicable, a brief visa type/expiry summary. Passport numbers, scans, medical records, payment credentials and uploads are not accepted.

Stored data includes consent/submission timestamps, source path, entry category, service/package snapshots, applicable IDs, question label/section snapshots and answers. Logs do not contain contact details or complete payloads.

## Walkthroughs

General: open `#plan`, choose support, complete only applicable questions, provide contact details, acknowledge privacy and submit through the existing protected endpoint.

Service: a CTA opens `?service=<published-slug>#plan`. Full Planning/Premium use the detailed planning path. Readiness/Group use the safe general path until approved questionnaires are supplied.

Package: an open package CTA opens `?package=<published-slug>#plan`, snapshots package UUID/title and uses the safe package intake. No package-specific source was supplied, so it is not claimed as migrated.

## API, database and portal

Endpoint remains `POST /api/public/enquiries`; strict versioned payloads and legacy first-contact payloads are supported. No schema migration is required because existing JSONB supports historical snapshots. Existing records remain readable. The organisation scope remains server-owned.

The Traveller inbox adds status, category, service, package and traveller/reference filters with existing pagination. Details show overview, contact and readable questionnaire sections. Legacy records use a bounded fallback that hides submission idempotency metadata. Tenant SQL, role permissions, CSRF, optimistic status versions and atomic status audit are unchanged.

## Email and notifications

New enquiries still create the existing notification event transactionally; notification failure cannot erase a saved enquiry.

Portal replies are not implemented. The current outbox supports one acknowledgement per enquiry and a fixed sender template/recipient policy; it cannot safely provide multiple authored messages, previews, message history or inbound replies. No decorative Reply control or delivery claim was added. A later feature needs reviewed message/outbox storage, permissions, audit events, recipient rules and inbound-sync wording.

## Local and staging review

Local URLs:

- Website: `http://localhost:4328/#plan`
- Full Planning: `http://localhost:4328/services/full-trip-planning?service=full-trip-planning#plan`
- Package example: `http://localhost:4328/packages/zanzibar?package=zanzibar#plan`
- Portal: `http://localhost:5188/`
- API: `http://localhost:3090/healthz`

Use synthetic `.invalid` contacts and do not execute a real notification. Before staging: obtain client approval for the question/deferred inventory, deploy code only (no migration expected), exercise general/not-sure/service/package/invalid-package/retry paths, verify filters/legacy records/status audit/roles, and distinguish queued from delivered notifications. Production requires separate approval.

## Remaining decisions and risks

- Detailed Readiness, Group and package-specific questionnaires were not supplied.
- Health-data and commercial/refund/declaration copy need explicit client approval before a new questionnaire version can collect them.
- Full two-way email synchronisation is unavailable.
- Mobile/keyboard/screen-reader browser acceptance remains required before staging approval.
