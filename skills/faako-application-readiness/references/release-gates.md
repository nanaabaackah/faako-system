# Release gates

## Decision meanings

- `GO`: every mandatory gate has current evidence for the intended release SHA and environment; rollback and ownership are ready.
- `CONDITIONAL GO`: no unresolved critical/high risk blocks release, and each explicitly accepted condition has an owner, deadline, mitigation, and approval.
- `NO-GO`: a critical/high risk is open, a core journey is broken, production is unavailable, migration/data safety is uncertain, or mandatory hosted evidence is missing.

## Mandatory gates

- exact release SHA and branch/environment provenance;
- reproducible install, hygiene, manifests, conflicts, lint, type checks, builds, unit/integration/database/browser/accessibility/security checks appropriate to the change;
- authenticated staging acceptance for staff journeys and synthetic end-to-end public journeys;
- production configuration and migration readiness without applying unapproved changes;
- verified environment isolation, tenant/permission enforcement, secret boundaries, and delivery routing;
- provider deployment/rollback evidence and operational ownership;
- configured backup coverage plus an isolated restore drill satisfying agreed recovery objectives;
- monitoring/alert ownership and a failure drill for core workers/integrations;
- business UAT and legal/content approval where required.

Provider configuration shown in code or documentation is not hosted acceptance. A successful liveness endpoint is not readiness for external integrations. A configured backup is not a verified restore.
