# Monorepo testing strategy

## Test layers

1. **Framework-neutral unit tests** cover contracts, types/helpers, validation, permissions, logging redaction, finance, offline queues, and API-client behaviour.
2. **Backend route/service tests** cover authentication, permission denial, tenant scope, input validation, stock and financial transitions, webhook signatures, request IDs, and safe errors.
3. **Application integration tests** cover state adapters, compatibility clients, unsaved-change behaviour, and representative module workflows without production dependencies.
4. **Build/output tests** verify public metadata, links, redirects, CSP, route shells, indexing and bundle boundaries.
5. **Playwright browser tests** run only against local/isolated preview servers. External APIs are mocked unless an explicitly isolated test service is approved.

## Pull-request policy

- Turbo runs affected `lint`, `typecheck`, `test`, and `build` tasks using Git history and package dependencies.
- Security/registry/hosting gates run for JavaScript architecture changes.
- Faako Analytics changes run Ruff, mypy and pytest under Python 3.12 from the temporary `services/reebs-analytics[dev]` compatibility path.
- Faako and REEBS public changes run local preview browser smoke tests. Dev ERP changes run its local Playwright suite.
- REEBS Portal browser coverage is not a required CI gate until its Playwright config owns a deterministic preview server and authentication fixtures. Stroane needs first-class specs before its `test:e2e` script becomes a gate.
- Never point mutation tests at production. Production checks are read-only health/route checks only.

## Test data and safety

- Use fixed organisations/users with visibly non-production identifiers.
- Mock Paystack, MoMo, email, WhatsApp, Maps and analytics providers. Verify signatures and payload builders at the backend boundary.
- Every mutation test cleans up its isolated data or uses a rolled-back transaction.
- Browser tests assert visible recovery states and avoid raw backend errors.
- Flaky tests must be fixed or quarantined with an owner and expiry date; do not silently retry them indefinitely.

## Current gaps

- Browser-level customer/product/inventory/order/booking/invoice/payment workflows are incomplete across operational apps; backend and component tests carry most critical coverage.
- REEBS Portal E2E combines old public and portal responsibilities and lacks a managed web server.
- Stroane has Playwright infrastructure but no tracked Playwright specs; current boundary tests are Node output tests.
- TTNGH donation/event registration is not applicable until a tracked scaffold and approved provider sandbox exist.
- Local Python is 3.9 without the service tooling; CI is the reproducible Python test environment until `services/reebs-analytics/.venv` is created with Python 3.11+.
