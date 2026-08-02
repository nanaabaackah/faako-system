# @faako/api-contracts

Framework-independent API response contracts and runtime compatibility helpers.

The package exports:

- canonical success and error response builders;
- backward-compatible builders for existing top-level data and string errors;
- pagination, request ID, validation issue, and error-code types;
- a normalizer for current Faako, Dev ERP, REEBS, Stroane, and FastAPI response shapes;
- `ApiContractError` for client-side error handling.

It has no framework, transport, React, database, or environment dependency.

See `docs/architecture/api-contracts.md` for the response model and
`docs/migrations/api-contract-adoption.md` for the incremental migration pattern.
