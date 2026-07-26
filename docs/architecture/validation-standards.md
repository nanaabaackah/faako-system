# Validation standards

Date: 2026-07-26

## Decision

Zod 3 is the shared validation standard for JavaScript and TypeScript trust
boundaries in the Faako monorepo. It was already the only dedicated
JavaScript validation library in active use, in Dev ERP. The Python REEBS
Analytics service continues to use Pydantic because its models are native to
the FastAPI runtime and do not cross the pnpm package boundary.

The framework-independent package is `@faako/validation` in
`packages/validation`. It has no React, Vite, Astro, Express, Prisma, browser,
database, or environment-variable dependency. It exports runtime schemas,
Zod-inferred input types, shared primitives, and a small issue normalizer.

This task does not replace all application validators. Shared schemas are
adopted one boundary at a time, with compatibility tests before any existing
input is tightened.

## Repository audit

| Area | Current implementation | Main finding | Adoption direction |
| --- | --- | --- | --- |
| Dev ERP authentication | Zod schemas and Express validation middleware | The dominant, best-defined validation boundary | Pilot one schema, then migrate the remaining schemas individually |
| Dev ERP bookings and productivity | Zod at the API boundary plus app-local form checks | Public booking schema and handler disagree about `durationMinutes` and honeypot/company input | Reconcile the existing contract before adopting the shared booking schema |
| Faako API and website | Handwritten normalizers, regular expressions, required-field checks, and HTML constraints | Signup/onboarding validation is large and tightly coupled to response and persistence behavior | Extract compatible adapters around stable request shapes first |
| Faako ERP | Browser checks around demo access | Small surface, but its API response contract was only recently standardized | Keep server authority; share a request schema only when the API boundary is changed |
| REEBS Portal | Handwritten parsers in serverless/Express handlers and page-local form checks | Customer, booking, order, payment, inventory, and invoice rules are dispersed | Migrate endpoint by endpoint with handler fixtures |
| REEBS Website | Page-local checks and duplicated email/phone/contact helpers | Public contact and booking behavior duplicates portal logic | Establish one server-owned schema, then reuse a safe client projection |
| Stroane | Typed client helpers plus substantial handwritten backend validators | Product and inventory rules are mature but application-specific; customer and payment inputs use separate parsers | Compose shared primitives without replacing mature domain rules wholesale |
| Portfolio | Custom contact-form validation in the Astro/React surface and serverless handler | Client and server rules can drift | Make the server endpoint the future pilot authority |
| REEBS Analytics | Pydantic models | Correct native choice for Python/FastAPI | Keep isolated; translate only at the HTTP contract |
| Newsletter and event registration | No stable repository-wide endpoint contract | Product and consent behavior is not yet settled | Treat the shared schemas as opt-in baselines, not deployed contracts |

No Yup, Joi, Ajv, Valibot, Superstruct, class-validator, or competing
JavaScript schema dependency was found. Browser attributes such as `required`,
`pattern`, `min`, and `max` are useful interaction hints but are not trusted
server validation.

## Shared schema inventory

`@faako/validation` exports:

- authentication: login, forgot-password, password reset, and registration;
- organisation and customer forms;
- product forms and inventory adjustments;
- bookings;
- invoices and invoice lines;
- payments with an explicit major/minor currency unit;
- contact, newsletter, and event-registration inputs;
- reusable identifiers, email, phone, currency, date, datetime, and money
  primitives;
- `validationIssues`, which converts Zod issues to framework-independent
  field/code/message records.

All public object schemas use Zod's strip behavior. Fields that are not
declared at the request boundary—including password hashes, token versions,
database timestamps, internal permissions, payment metadata, and
server-calculated state—do not appear in parsed output.

The package exports `z.infer` aliases such as `ForgotPasswordInput`,
`ProductFormInput`, and `EventRegistrationInput`. Consumers should infer from
the schema instead of maintaining a parallel form interface.

## Required rules

1. Validate untrusted data at the server or worker trust boundary. Client-side
   validation improves the experience but never grants authority.
2. Use `safeParse` where the application must return a controlled validation
   response. Use `parse` only where throwing is already the intended control
   flow.
3. Define request inputs, not database models. Server-managed fields, secrets,
   hashes, authorization state, calculated totals, and provider payloads do not
   belong in public form schemas.
4. Strip unknown object keys by default. Use strict rejection only when the
   endpoint intentionally documents that behavior and compatibility tests
   prove it is safe.
5. Preserve whitespace where it is semantically meaningful, especially
   passwords and tokens. Trim human-readable names, labels, and free-text
   identifiers deliberately.
6. Use ISO `YYYY-MM-DD` for date-only values and offset-bearing ISO datetimes
   for instants. Add cross-field tests for date ranges.
7. State whether money is a major-unit decimal or a minor-unit integer. Never
   infer the unit from the number.
8. Put cross-field rules in `superRefine` and attach issues to actionable field
   paths.
9. Keep transport error formatting outside schema definitions. Existing API
   clients and status codes must remain compatible during adoption.
10. When existing clients use different field names, introduce a boundary
    adapter before changing either the shared schema or every caller.
11. Test accepted, rejected, boundary, transformed, and unknown/server-only
    fields. A pilot must also test the application's imported schema identity
    or end-to-end parsing path.
12. Do not import framework, ORM, or deployment modules into
    `packages/validation`.

## Pilot adoption

Dev ERP's forgot-password input is the first pilot. Its existing exported
`forgotPasswordSchema` now aliases `forgotPasswordInputSchema` from
`@faako/validation`, so the existing middleware and handler need no response
or control-flow change.

Compatibility is preserved:

- `email` remains required, is capped at 254 characters, and must be a valid
  email address;
- password/token whitespace behavior is not involved;
- unknown fields continue to be accepted and stripped, matching the previous
  Zod object behavior;
- the existing export name, middleware, status code, and API error payload are
  unchanged.

The package suite tests all candidate schema families. A Dev ERP regression
test proves the application uses the shared schema and preserves accepted and
rejected forgot-password inputs.

## Known mismatches and blockers

- Dev ERP's `publicBookingSchema` currently requires `endAt` and strips fields
  that downstream code reads, including a duration fallback and honeypot or
  company value. Adopting the shared booking schema without a request fixture
  audit could silently change spam protection or scheduling behavior.
- REEBS public and portal contact validation is duplicated. Its exact field
  names, optional-phone behavior, and error wording need an endpoint-level
  compatibility fixture before consolidation.
- REEBS customer, order, booking, invoice, inventory, and payment parsing is
  spread across handlers. Their database-shaped inputs must not be copied into
  the public package.
- Stroane's product and inventory validators encode application-specific
  publishing, variant, and stock rules. Shared primitives can reduce
  duplication, but a generic product schema is not a safe replacement.
- Payment flows use different provider payloads and amount units. Provider
  webhooks remain server-local and require signature verification before
  schema parsing.
- Newsletter consent and event-registration rules require product and privacy
  decisions before endpoint adoption.

## Migration pattern

For each future endpoint:

1. capture current accepted and rejected payloads as tests;
2. separate public input fields from persistence and authorization fields;
3. compare the local validator with the closest shared schema;
4. extend or adapt without changing the response envelope;
5. import the shared schema at the authoritative server boundary;
6. optionally reuse a safe client schema or inferred type;
7. run the owning app's lint, type-check, tests, and build;
8. remove the old validator only after all callers use the new boundary.

The recommended next pilot is one public contact endpoint with both client and
server fixtures. The Dev ERP public-booking mismatch should be repaired as a
separate, explicit behavior change rather than folded into a broad validation
migration.

