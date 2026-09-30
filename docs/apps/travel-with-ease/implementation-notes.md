# Travel With Ease implementation notes

## Phase 0/1 foundation

- Created independent web, portal and API workspaces.
- The first API uses an app-owned repository port. `FileLeadRepository` is for isolated local development only; production startup rejects it.
- The SQL migration is reviewed design output and is not auto-applied by application startup.
- The estimator owns no browser-side supplier cost or margin data. The browser sends trip characteristics; the API loads internal cost bands from versioned server data and returns only the GHS range. An authenticated admin editor and database-backed configuration are outstanding.
- Currency math uses integer minor units and decimal-string rates. The provider response is validated and cached; stale fallback is labelled.
- The staff dashboard uses a manually entered development bearer token. This is not the final authentication/session model and cannot be enabled as the production strategy.
