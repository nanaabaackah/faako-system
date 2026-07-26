# @faako/api-client

Framework-independent fetch transport and opt-in domain clients for Faako
applications.

The root and `./browser` exports contain no server secrets or environment
lookups. Server applications must explicitly import `@faako/api-client/server`
and provide their configuration.

Successful payloads are returned unchanged by default. Use
`responseMode: "data"` only for canonical or compatible Faako API envelopes.
The client does not automatically retry requests.

## Environment variables

None. Applications own environment-variable lookup and pass resolved values to
the appropriate client factory.
