# Error handling

Status: adopted for new work and incremental API migration as of 2026-07-26.

This standard uses `@faako/api-contracts`, `@faako/api-client`, and the existing
application-state and form-experience standards. Legacy response fields remain
available through compatibility envelopes while consumers migrate.

## API categories

| Category | Code | Status | User-safe default |
| --- | --- | ---: | --- |
| Bad request | `bad_request` | 400 | The request could not be completed. |
| Validation | `validation_error` | 400/422 | Check the highlighted information and try again. |
| Authentication | `authentication_error` | 401 | Your session has expired. Sign in again. |
| Permission denied | `permission_error` | 403 | You do not have permission to do that. |
| Not found | `not_found` | 404 | The requested resource could not be found. |
| Conflict | `conflict` | 409 | The request conflicts with the current record state. |
| Rate limit | `rate_limited` | 429 | Too many requests. Please wait and try again. |
| Server | `server_error` | 500 | The service could not complete the request. |
| Upstream | `upstream_error` | 502 | A required service returned an invalid response. |
| Unavailable | `service_unavailable` | 503/504 | The service is temporarily unavailable. |
| Browser/network | `network_error` | no response | Check your connection and try again. |

Authentication and permission errors are never interchangeable. A server may
conceal a resource with `404` only when that is an explicit endpoint policy.

## Producer contract

New or migrated errors use:

```json
{
  "ok": false,
  "error": "Access denied",
  "apiError": {
    "code": "permission_error",
    "message": "Access denied"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```

The string `error` is retained for legacy consumers. `apiError` is authoritative
for migrated consumers. Validation issues use `apiError.issues`. Rate limits
also use `Retry-After` and `meta.retryAfterSeconds`.

Stack traces, SQL/ORM messages, environment data, provider bodies, secrets,
tokens, payment credentials, and sensitive personal information never belong
in a response. Debug context is logged under the request ID.

## Request IDs

`X-Request-Id` is the only transport correlation header.

1. The shared client creates a constrained ID when none is supplied.
2. The first backend validates an incoming ID and replaces invalid values.
3. The backend attaches the ID to `req.requestId`, response headers, logs, and
   compatible error metadata.
4. Downstream calls forward it when correlation is useful.
5. Domain submission/payment/job identifiers are not reused as transport IDs.

The current middleware is adopted by Dev ERP, REEBS's Express adapter, Stroane,
and Faako API. REEBS serverless responses also normalize IDs in the shared HTTP
helper.

## Frontend presentation

`getApiErrorPresentation` maps client errors to the existing UX states:

| API result | UX state | Retry |
| --- | --- | --- |
| 401 | Session expired | Sign in; never replay a mutation automatically |
| 403 | Permission denied | No retry until access changes |
| Validation | Field/form validation | Correct input |
| 429 | Rate limited | Manual retry after supplied delay |
| Network | Offline/unavailable | Manual retry |
| 5xx/unavailable | Safe error state | Retry reads; mutation retry is explicit |

The mapper does not display raw backend exception text. It returns a safe
message, recovery capability, and request ID. The Faako ERP demo-access
workflow is the first UI adoption.

Use `SecurityState` for session/permission outcomes, `InlineNotice` for
recoverable form failures, and `AnimatedLoadingState`/`EmptyState` according to
the existing design standards.

## Error-boundary inventory and target

| Surface | Current state | Target |
| --- | --- | --- |
| Dev ERP React | Route-level `ErrorBoundary` exists | Keep; route unexpected exceptions to safe support copy and request/release context where available |
| REEBS Portal/Website React | API errors are mostly local; no repository-wide boundary was identified | Add one application-shell boundary in a separate bounded PR |
| Stroane React | API modules expose route-specific errors; no shared shell boundary was identified | Add a portal/storefront boundary without merging auth states |
| Faako ERP/Website React | Local workflow notices | Adopt the shared presentation mapper per workflow |
| Portfolio Astro | Build/static rendering with React islands | Use Astro/static host error pages; islands need local React boundaries only when they can fail independently |

An Astro build exception fails the build and belongs in CI logs. A runtime
Astro/server exception, if server rendering is introduced later, must use the
same safe 5xx contract and branded host error page. Static 404 pages remain
content pages, not API errors.

## Retry rules

- Safe reads may use bounded manual or reviewed automatic retry.
- POST, PUT, PATCH, DELETE, payment, inventory, booking, and other unsafe
  mutations are never automatically retried without reviewed idempotency.
- Reauthentication never silently replays a mutation.
- Permission errors are not retried.
- An `AbortSignal` cancellation is not shown as a server failure.

## Current pilot boundaries

- Dev ERP central fallback/error middleware emits compatible errors.
- REEBS shared HTTP errors emit compatible errors and hide 5xx internals.
- Stroane shared route errors and final error middleware emit compatible errors.
- Faako API final 404/500 paths include request IDs.
- Existing endpoint-specific producers remain on the migration backlog; this
  change does not rewrite every response.
