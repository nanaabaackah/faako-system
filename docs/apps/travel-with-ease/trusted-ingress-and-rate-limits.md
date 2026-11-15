# Trusted ingress and distributed rate limits

## Reviewed topology

One Railway service exposes two reviewed paths:

- public API: `client -> Railway public edge -> Express`;
- protected CMS: `client -> Cloudflare Access -> Railway public edge -> Express`.

The custom staging and production API hostnames are DNS CNAMEs to their Railway
service hostnames. A 2026-11-15 read-only staging API probe returned
`server: railway-hikari`, `x-railway-edge` and `x-railway-request-id`, with no
Cloudflare response hop. The portal hostname is Cloudflare-proxied and targets
the same Railway service. Express's immediate peer remains Railway on both paths.

Railway documents `X-Real-IP` as the client remote address and supplies
`X-Forwarded-Proto` and `X-Forwarded-Host`. Hosted startup therefore requires
`TWE_PROXY_MODE=railway`. Express trusts only hop zero via a custom function;
it never trusts an arbitrary-length `X-Forwarded-For` chain. Public API
rate-limit identity uses only a single syntactically valid Railway `X-Real-IP`
value and fails closed if that header is absent or malformed. After the portal
guard cryptographically verifies the Access assertion, protected portal quotas
use its stable issuer/audience/subject identity. They do not trust
`CF-Connecting-IP` or other client-IP forwarding headers. Local development
uses the socket peer.

Reverify this topology before adding Cloudflare proxying, a Worker, Tunnel,
another load balancer, private service-to-service callers, or another ingress
path. Do not change the hop count or identity source by inference.

## Distributed enforcement

Hosted API instances share fixed-window counters in PostgreSQL. Client
addresses are HMAC-SHA-256 pseudonymised with the environment-specific,
server-only `TWE_RATE_LIMIT_SECRET`; raw addresses and request bodies are not
stored. Atomic upserts make concurrent replicas share one quota. Expired rows
are removed in bounded batches. A database or trusted-header failure returns
503 rather than silently bypassing the limiter.

The migration must run before code rollout. The runtime role receives only
`SELECT`, `INSERT`, `UPDATE` and `DELETE` on the counter table. Use a unique
32-byte-or-longer random base64url secret in staging and production; rotation
starts new pseudonymous buckets and should be scheduled as a reviewed rollout.

## Provider acceptance

Before deployment, confirm the DNS targets, Railway edge headers, one-hop path,
replica count and exact deployed SHA. Exercise the same quota through at least
two application replicas with synthetic traffic. Railway's platform request
limits are defense in depth, not evidence of an application quota. Any
Cloudflare/WAF rate-limit rule must be separately exported and tested; none is
claimed by this application change.
