# API contracts

Date: 2026-07-26

## Scope and decision

This audit covers Faako API, Dev ERP, REEBS API functions and their Express adapter,
Stroane APIs, public form endpoints, browser clients, and the REEBS analytics
service. It describes response bodies and transport metadata; it does not change
authentication, authorization, persistence, routing, or provider webhook
requirements.

Framework-independent runtime contracts live in `@faako/api-contracts`.
`@faako/types` remains focused on source-consumed application and UI types. A
dedicated package is justified because response builders and normalizers must run
unchanged in Express handlers, serverless functions, Vite clients, Node tests, and
future Astro or service clients.

## Current response audit

| Surface | Successful responses | Error responses | Pagination and request IDs |
| --- | --- | --- | --- |
| Faako API | Health uses `{ ok, service }`; signup uses `{ ok, message, requestId }`; demo access historically used `{ ok, challengeToken }` or `{ ok, session }` | Mostly `{ ok: false, error: string }`; rate limits also use `Retry-After`; malformed and validation failures share status 400 | Signup has a business request ID in the body; demo access now returns transport request IDs in metadata and `X-Request-Id` |
| Dev ERP | Mix of raw arrays/resources and feature wrappers such as `{ users }`, `{ proposal }`, or `{ ok, ... }` | Usually `{ error: string }`; Zod middleware uses `{ error: "Validation failed", errors }`; classified server errors sometimes add a development-only `code`; rate limits add `scope` and `retryAfterSeconds` | List formats are endpoint-specific; request IDs are captured for selected audit events but are not consistently returned |
| REEBS API | Serverless handlers return raw arrays, raw objects, `{ ok, ... }`, and domain wrappers; the Express adapter forwards each function result | Usually `{ error: string }`; auth and permissions use the same shape; several handlers include additional fields; database and adapter fallbacks vary | Order lists use `{ items, total, page, pageSize }`; other lists are unpaged or use different fields; `x-request-id` is recorded by selected audit paths |
| Stroane API | Catalogue endpoints return domain fields directly; modular routers increasingly use `{ ok: true, ...payload }`; auth and payment responses have endpoint-specific wrappers | Usually `{ error: string }`, occasionally `{ error, details }`; auth, permission, not-found, conflict, provider, and server failures share that broad shape | Admin list endpoints use route-specific pagination; request IDs are mainly used for audit/activity calls and payment idempotency |
| Public forms | Faako signup returns `{ ok, message, requestId }`; REEBS contact returns `{ ok, message, requestId, customerId }`; Stroane contact follows its route-specific response; Portfolio may use a configured endpoint and Faako Website also has static/direct-contact surfaces | Forms generally expose a single `error` string; field validation is mostly browser-local; rate limits vary between a header, body field, or both | Faako signup and REEBS contact expose business submission identifiers, which must not be confused with transport request IDs |
| REEBS analytics | Health returns `{ ok, service, mode }`; insights return the calculation fields directly plus organization/source metadata | FastAPI uses `{ detail: string }` for HTTP errors and `{ detail: issue[] }` for request validation | No list pagination; no response request ID |

### Main findings

1. `{ error: string }` is the closest thing to a repository-wide legacy contract.
2. Success responses cannot be inferred consistently: a successful body may be an
   array, resource, domain wrapper, or `{ ok: true }` envelope.
3. Validation errors are not field-addressable across systems.
4. Status codes usually carry the error category, but body codes are absent or
   framework/provider-specific.
5. Business identifiers named `requestId` are already used by signup, CRM, audit,
   payment, and job flows. A transport request ID therefore belongs in response
   metadata and the `X-Request-Id` header.
6. Pagination exists, but `pageSize`, `limit`, totals, and cursors do not share a
   contract.
7. FastAPI validation details and JavaScript string errors need a client-side
   normalizer before response producers can migrate safely.

## Target response model

### Successful response

```json
{
  "ok": true,
  "data": {
    "id": "example"
  },
  "meta": {
    "requestId": "transport-request-id"
  }
}
```

`data` is always the endpoint result. It may be an object, array, scalar, or
`null`. `meta` is optional and must contain transport information rather than
domain records.

### Error response

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "The request could not be validated.",
    "issues": [
      {
        "field": "email",
        "code": "invalid_email",
        "message": "Enter a valid email address."
      }
    ]
  },
  "meta": {
    "requestId": "transport-request-id"
  }
}
```

`message` is safe for users. Internal exception text, SQL, stack traces, secrets,
tokens, and provider payloads must not be returned. `details` is optional and
must also be safe for the relevant client. `issues` is the portable validation
representation.

### Error codes and HTTP statuses

| Condition | Contract code | Normal HTTP status |
| --- | --- | --- |
| Invalid request outside field validation | `bad_request` | 400 |
| Body, query, or field validation | `validation_error` | 400 or 422 |
| Missing, expired, or invalid authentication | `authentication_error` | 401 |
| Authenticated but not permitted | `permission_error` | 403 |
| Resource or route not found | `not_found` | 404 |
| State, idempotency, or unique-value conflict | `conflict` | 409 |
| Request limit exceeded | `rate_limited` | 429 |
| Unexpected server failure | `server_error` | 500 |
| Required dependency unavailable or timed out | `service_unavailable` | 503 or 504 |
| Upstream provider returned an unusable response | `upstream_error` | 502 |

Authentication and permission remain distinct. A server must not convert a
permission denial into a not-found response unless concealing resource existence
is an explicit security requirement for that endpoint.

### Pagination

Pagination belongs at `meta.pagination`:

```json
{
  "ok": true,
  "data": {
    "items": []
  },
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 125,
      "totalPages": 3,
      "hasNext": true,
      "hasPrevious": false,
      "cursor": null,
      "nextCursor": null,
      "previousCursor": null
    }
  }
}
```

Page and cursor fields are optional so an endpoint can use either model without
inventing values. A migration may retain legacy `total`, `page`, and `pageSize`
fields until all consumers use metadata.

### Rate limits

A rate-limited response uses code `rate_limited`,
`meta.retryAfterSeconds`, and the standard `Retry-After` header. Existing
`retryAfterSeconds` body fields may remain during compatibility rollout.

### Request IDs

- Accept an incoming `X-Request-Id` only after length and character validation,
  otherwise generate one.
- Return it in `X-Request-Id` and `meta.requestId`.
- Use it in logs and audit metadata.
- Do not reuse a domain submission, CRM, payment, invoice, or job identifier as
  the transport request ID.
- Do not expose tracing headers that contain credentials or provider internals.

## Compatibility model

Changing every producer to the canonical envelope would break current clients.
The shared package therefore exposes compatibility builders.

A compatible success response contains canonical `data` and the existing
top-level fields:

```json
{
  "ok": true,
  "data": {
    "challengeToken": "example"
  },
  "challengeToken": "example",
  "meta": {
    "requestId": "transport-request-id"
  }
}
```

A compatible error retains the legacy string and adds a structured error:

```json
{
  "ok": false,
  "error": "Enter a valid email address.",
  "apiError": {
    "code": "validation_error",
    "message": "Enter a valid email address."
  },
  "meta": {
    "requestId": "transport-request-id"
  }
}
```

New and migrated clients normalize `apiError`, canonical `error`, legacy
`error`, FastAPI `detail`, and raw successes into one in-memory contract.
Canonical-only responses should be introduced only on a versioned route or after
usage evidence shows that no legacy consumer remains.

## Package API

`@faako/api-contracts` provides:

- `createSuccessResponse` and `createErrorResponse` for canonical producers;
- `createCompatibleSuccessResponse` and
  `createCompatibleErrorResponse` for incremental rollout;
- `normalizeApiResponse`, `getApiResponseData`, and `ApiContractError` for clients;
- `API_ERROR_CODES` and `errorCodeForStatus`;
- types for responses, errors, validation issues, pagination, metadata, and
  request IDs;
- header readers for request IDs and retry timing.

The package deliberately does not know about Express, FastAPI, Cloudflare,
Railway, Prisma, React, or a specific domain.

## Pilot

`POST /api/demo-access` in Faako API is the pilot endpoint.

- The server emits compatible canonical success and error information.
- Existing top-level `challengeToken`, `deliveryMode`, `message`, `session`, and
  string `error` fields remain unchanged.
- `X-Request-Id` and `meta.requestId` are additive.
- Faako ERP parses canonical and legacy payloads through the shared normalizer.
- Tests cover the producer, the consumer, structured errors, and legacy success
  compatibility.

No other API response was migrated in this task.

## Validation

Validated on 2026-07-26:

- the shared contract package passed its lint, declaration type-check, and six
  runtime tests;
- Faako API passed its four endpoint tests;
- Faako ERP passed its three adapter tests and production build;
- repository lint passed in all 28 active workspaces;
- repository type-check passed in all 13 applicable workspaces;
- tests passed in all 15 test-bearing workspaces; the four Dev ERP HTTP tests
  that require localhost binding passed with ordinary loopback permission;
- all 10 build-capable applications passed;
- frozen-lockfile resolution passed across all 29 workspace projects.
