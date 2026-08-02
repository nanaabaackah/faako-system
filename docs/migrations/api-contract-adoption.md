# API contract adoption

Date: 2026-07-26

## Objective

Adopt the response model in `docs/architecture/api-contracts.md` without a
repository-wide flag day. Each pull request should migrate a bounded endpoint
family, preserve deployed clients, and include producer and consumer tests.

## Completed pilot

The first adoption is Faako API `POST /api/demo-access` and its Faako ERP
consumer.

### Producer

The endpoint uses `@faako/api-contracts` compatibility builders:

- success data is available under `data`;
- existing success fields remain at the top level;
- errors retain `error: string` and add `apiError`;
- request IDs are returned in metadata and `X-Request-Id`;
- rate limits can carry both `Retry-After` and `meta.retryAfterSeconds`.

### Consumer

Faako ERP normalizes:

- the new compatible response;
- the old top-level `{ ok, ... }` response;
- legacy string errors;
- structured contract errors;
- request ID and retry metadata.

This allows the client and server to deploy independently.

## Endpoint migration pattern

### 1. Record the existing contract

Before editing a producer:

1. identify every route alias;
2. find browser, server, webhook, job, and test consumers;
3. record status codes, fields, headers, and empty-body behavior;
4. distinguish domain `requestId` fields from transport request IDs;
5. add a legacy-shape test if one does not exist.

### 2. Migrate consumers first

Use `normalizeApiResponse` at a narrow API-client boundary. Do not spread
normalization across components. Verify the client accepts both the deployed
legacy shape and the future compatible shape.

### 3. Add a compatible producer envelope

Use a compatibility builder and retain every field the legacy client reads.
Adding `data`, `apiError`, and `meta` is safe only if consumers tolerate
additional JSON fields. Preserve status codes and required provider headers.

### 4. Add transport metadata

Return `X-Request-Id` and `meta.requestId`. Add `Retry-After` and
`meta.retryAfterSeconds` for 429 responses. Connect the request ID to safe
application logs and audits where practical.

### 5. Observe before removing legacy fields

Legacy fields should be removed only when:

- all repository clients use the normalizer or canonical model;
- deployed client versions have aged out;
- external integrations are known;
- route-level regression and monitoring evidence exists;
- the removal uses a versioned route or an explicitly approved breaking change.

## Recommended rollout order

1. Health and read-only public-stat endpoints.
2. Public contact and intake forms with clear idempotency and rate-limit tests.
3. Read-only catalogue and detail endpoints.
4. Paginated admin list endpoints.
5. Ordinary authenticated CRUD endpoints.
6. Authentication/session endpoints.
7. Payments, finance, inventory mutations, offline queues, and scheduled jobs.
8. Third-party webhooks only when provider acknowledgement requirements are
   preserved exactly.

The next suggested pilot is a read-only health or public-stat endpoint with a
real monitoring consumer. It should introduce request-ID propagation without
changing provider or session behavior.

## Surface-specific notes

### Faako API

- Keep signup business `requestId` intact.
- Migrate the signup browser client before changing its response producer.
- Treat email-delivery failures as upstream or service-unavailable errors rather
  than validation failures.

### Dev ERP

- Centralize conversion in the existing error handler before replacing route
  responses.
- Adapt Zod `errors` to contract `issues` while retaining the legacy field.
- Do not migrate the monolithic server route-by-route without feature-level
  tests.

### REEBS

- Add contract helpers beside the existing `_shared/http.js` transport helper;
  do not rewrite every function.
- Preserve serverless `statusCode`, headers, and stringified `body`.
- Move `{ items, total, page, pageSize }` to metadata compatibly.
- Contact/CRM `requestId` is a domain record ID and must remain distinct from a
  transport ID.

### Stroane

- The existing `sendOk`, `sendCreated`, `HttpError`, and `asyncRoute` helpers are
  natural adapter points.
- Keep payment status bodies and Paystack acknowledgement semantics stable.
- Migrate storefront API clients before catalogue producers.

### REEBS analytics

- Add FastAPI exception handlers only in a dedicated service change.
- Preserve native 422 details until the Node caller uses the shared normalizer
  or an equivalent Python schema.
- Do not add the JavaScript runtime package to the Python service.

### Public forms

- Preserve honeypot success behavior.
- Preserve idempotency keys and business submission references.
- Map safe field errors to `issues`; never echo raw form bodies.
- Keep rate-limit timing in both the header and compatibility metadata.

## Pull-request checklist

- [ ] Existing response and consumers documented.
- [ ] Status codes unchanged or explicitly reviewed.
- [ ] Client accepts legacy and compatible responses.
- [ ] Producer includes canonical data or error information.
- [ ] Legacy fields required by deployed clients remain.
- [ ] Validation issues contain safe field names and messages.
- [ ] Authentication and permission errors remain distinct.
- [ ] Pagination metadata is calculated correctly.
- [ ] Transport request ID is not a domain identifier.
- [ ] Rate-limit headers remain standards-compatible.
- [ ] Unit/integration tests cover success and relevant error classes.
- [ ] No provider webhook acknowledgement was wrapped accidentally.

## Out of scope for this task

- Migrating every response producer.
- Renaming existing fields or environment variables.
- Versioning all routes.
- Replacing application authentication.
- Introducing OpenAPI generation.
- Changing payment, webhook, database, or deployment architecture.
