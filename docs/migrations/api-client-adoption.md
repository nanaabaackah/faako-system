# API client adoption

Date: 2026-07-26

## Objective

Adopt `@faako/api-client` incrementally while preserving endpoint paths,
payloads, credentials, authentication state, user-visible messages, and
application method signatures.

The shared package is a transport seam, not a mandate to rewrite every request
or introduce a repository-wide query framework.

## Completed pilot

Faako ERP demo access is complete.

| Behavior | Before | After |
| --- | --- | --- |
| Endpoint | `VITE_FAAKO_ERP_DEMO_ACCESS_ENDPOINT` or `/api/demo-access` | Unchanged |
| Method/body | POST with JSON | Unchanged |
| Credentials | Browser same-origin default | Explicit `same-origin` |
| Success | Canonical-compatible or legacy payload parsed to data | Same shapes through `responseMode: "data"` |
| Failure | Structured contract error with fallback | Structured `ApiClientError` with the same message and richer method/URL context |
| Local mode | Rejected before Fetch | Unchanged |
| Retry | None | None |

The previous response adapter remains in place so other imports are not broken.
Pilot tests cover canonical success, legacy success, HTTP/rate-limit errors,
request metadata, request construction, and the no-network local guard.

## Adoption rules

1. Inventory the module's calls, endpoint paths, methods, credentials, headers,
   request bodies, response shapes, fallback messages, AbortSignals, and
   side-effects.
2. Capture the current behavior in tests before changing transport code.
3. Add one client instance at the owning app/module boundary. Do not create a
   global singleton with hidden environment reads.
4. Keep the module's exported functions and returned payloads unchanged.
5. Use raw response mode unless the endpoint already returns a canonical or
   compatible Faako envelope.
6. Configure `credentials: "include"` only for cookie-authenticated
   cross-origin APIs. Do not assume all browser requests need cookies.
7. Preserve CSRF, bearer, provider, client-identification, idempotency, and
   conditional headers.
8. Forward every existing AbortSignal.
9. Do not add retries during transport migration. Any future safe-read retry
   policy requires separate tests, budgets, and observability.
10. Keep server credentials in the server subpath and application-owned
    configuration.
11. Run the owning package's tests, lint, type-check where applicable, and
    build before removing the old helper.
12. Re-scan direct Fetch usage and update the migration inventory.

## Compatibility patterns

### Raw legacy payload

Use the default:

```ts
const payload = await client.get<ExistingResponse>("/api/customers");
```

The successful JSON object is returned unchanged. HTTP failures still become
`ApiClientError`.

### Canonical or compatible response

Use explicit data mode:

```ts
const data = await client.post<DemoAccessData>("/api/demo-access", {
  json: payload,
  responseMode: "data",
});
```

This supports canonical `{ ok, data }` responses and compatible responses that
retain legacy top-level fields.

### Existing application adapter

Keep the module signature:

```ts
export const existingApi = {
  async list() {
    return client.get<ExistingListResponse>(existingPath);
  },
};
```

Components should not need to know that the transport changed.

### Provider integration

Use `@faako/api-client/server` only when JSON handling and error semantics
actually match. Signature verification, webhook raw bodies, provider-specific
status rules, and secrets stay in the owning server module.

## Proposed pull request order

1. Shared package plus Faako ERP demo-access pilot.
2. Stroane customer-account module: preserve its public typed methods,
   `X-Stroane-Client`, include credentials, and current fallback messages.
3. Stroane admin API modules: extract one configured portal client and migrate
   one domain per pull request.
4. Portfolio contact or trust-stat module: add an app-local API module before
   changing the React view.
5. Faako Website signup/client-setup modules with form-submission fixtures.
6. REEBS AuthContext pair: reconcile the duplicated public/portal behavior
   first, then share transport.
7. REEBS domain modules in order: customers, inventory, bookings, orders,
   invoices/documents, payments, then secondary admin modules.
8. Dev ERP: adapt the existing client internally while preserving CSRF,
   session refresh, unauthorized handling, and safe replay controls.
9. Shared core/UI requests after their consumer and deployment assumptions are
   documented.
10. Server provider calls only through provider-specific adapters; service
    workers remain a separate workstream.

## Application risk matrix

| Area | Priority | Risk | Required protection |
| --- | --- | --- | --- |
| Faako ERP demo access | Complete | Low | Existing response compatibility tests |
| Stroane typed modules | High | Medium | Preserve headers, cookies, return types, and messages |
| Portfolio public calls | High | Medium | Origin behavior, spam protection, timeout/fallback UI |
| Faako public forms | High | Medium/high | Rate limits, field payloads, activity webhook behavior |
| REEBS page calls | High | High | First extract modules; avoid mass component changes |
| Dev ERP central client | Medium | High | CSRF, refresh lock, session expiry, replay safety |
| Server providers | Low | High | Secrets, signatures, idempotency, provider-specific bodies |
| Service workers | Separate | High | Cache semantics and Request/Response streaming |

## Calls that should remain direct for now

- service-worker fetch event handling and cache fallbacks;
- `data:` URL conversion in REEBS document download;
- provider calls requiring raw or nonstandard bodies;
- webhook delivery with endpoint-specific signing or idempotency;
- streaming, uploads, downloads, and non-JSON calls until their response mode is
  tested;
- third-party public currency calls whose browser-key exposure needs a separate
  security decision.

## Definition of done for each adoption

- No endpoint, method, payload, response, or credential change is accidental.
- Existing error messages remain compatible.
- AbortSignal is preserved or intentionally added.
- Request IDs are forwarded when the service supports them.
- No unsafe retry is introduced.
- Browser imports cannot reach server configuration.
- Focused tests cover request construction and success/error parsing.
- Direct Fetch count decreases only in the reviewed module.
- Owning workspace checks pass.
- The old helper is removed only if no compatibility consumer remains.

## Next recommended implementation

Migrate `apps/stroane-web/src/api/customerAccount.ts` internally. It is already
a cohesive typed module, making it possible to replace duplicated transport
code without changing React components or backend contracts. Preserve
`X-Stroane-Client`, `credentials: "include"`, logout's best-effort semantics,
and every current fallback message.

