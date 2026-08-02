# Logging and redaction

Status: adopted for backend diagnostic logging as of 2026-07-26.

`@faako/logger` is the shared structured logger. It uses Pino in Node services
and a JSON console adapter where configured. Application code logs events;
`@faako/audit` describes durable business audit records. The two streams are
not interchangeable.

## Levels

| Level | Use |
| --- | --- |
| `fatal` | Process cannot continue safely |
| `error` | Operation failed unexpectedly or data may require intervention |
| `warn` | Degraded/rejected condition with a known recovery path |
| `info` | Normal lifecycle or completed operational event |
| `debug` | Development diagnostics; disabled in normal production verbosity |
| `trace` | Short-lived deep diagnostics; never the production default |

Do not use `error` for expected validation, authentication, permission, or
not-found responses unless they indicate an operational defect.

## Standard fields

| Field | Meaning |
| --- | --- |
| `application` | Stable application identifier |
| `component` | Service/module emitting the record |
| `environment` | `development`, `staging`, `production`, or test equivalent |
| `eventName` | Stable dotted name such as `api.request.completed` |
| `requestId` | Transport request ID |
| `organisationId` | Tenant ID when safe and relevant |
| `userId` | Internal actor ID when safe and necessary |
| `method`, `path`, `statusCode`, `durationMs` | HTTP diagnostics |
| `err` | Error object; centralized serialization controls stack output |

Messages are static summaries. Values belong in structured fields. Query
strings and request/response bodies are not logged by default.

## Prohibited data

Never log:

- passwords or password hashes;
- access, refresh, bearer, reset, verification, or session tokens;
- cookies or Authorization headers;
- API, signing, encryption, or webhook secrets;
- payment/mobile-money credentials, card numbers, CVV/CVC, or PINs;
- raw form/request bodies;
- email addresses, phone numbers, physical addresses, names, or dates of birth
  unless a separately approved privacy requirement justifies them;
- provider payloads that may contain the above.

Internal `userId`, `organisationId`, request ID, resource ID, role key, and
permission ID may be logged when needed.

`redactLogValue` recursively redacts sensitive keys, handles circular values,
limits depth, and serializes errors. Free-text messages and serialized errors
also redact bearer/JWT credentials, credential assignments, connection-URL
user information, email addresses, payment-card patterns, and international
phone patterns. The Pino and console paths both use it. Redaction is defense in
depth: developers must still avoid placing secrets in messages or unrelated
field names.

## Request logging

Request logging is diagnostic:

```js
logger.info(
  {
    eventName: "api.request.completed",
    requestId,
    method,
    path,
    statusCode,
    durationMs,
  },
  "API request completed",
);
```

Dev ERP no longer persists routine request diagnostics as audit events by
default. A durable audit event must be emitted deliberately for a business or
administrative action.

## Error logging

Log the internal exception once at the owning boundary with request,
application, component, safe actor/tenant IDs, and event name. Return a
user-safe API error separately. Avoid duplicate logs at every layer.

Production error logs omit stacks by default in the shared serializer.
Development may include a bounded stack. Any later monitoring exporter must
apply equivalent or stricter redaction.

## Adoption

- Dev ERP uses the shared logger for central HTTP/server records.
- REEBS's login/recovery adapter and Express API adapter use the shared logger;
  direct `console.*` calls in legacy functions remain an incremental backlog.
- Stroane uses the shared logger at its final API exception boundary.
- Faako API uses the shared logger for process and unhandled API events.

New backend code must not introduce a new logger wrapper. Existing console
surfaces should move one bounded module at a time with tests for redaction.
