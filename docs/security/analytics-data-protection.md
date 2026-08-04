# Analytics data protection

## Classification

| Data | Classification | Default treatment |
| --- | --- | --- |
| Application/tenant IDs, aggregate counts | Internal/tenant confidential | Required context; tenant-isolated |
| Commercial, inventory and finance aggregates | Confidential | Role-restricted; no cross-tenant exposure |
| Customer/donor/programme participant records | Sensitive/confidential | Minimise/aggregate; explicit purpose and retention |
| Employee/HR/workload data | Sensitive internal | Prefer team/opaque keys; restrict exports and small groups |
| Authentication/session/payment credentials | Secret/restricted | Prohibited from analytical snapshots, outputs and logs |
| Payment transaction details | Restricted financial | Use approved aggregates/statuses only; never payment credentials |
| Mental-health/programme information | Potentially special-category/high sensitivity | No analytics/model use without explicit lawful-purpose/privacy approval |

## Controls

- Application backends remain the authoritative permission and tenant boundary.
- Caller credentials are server-only and scoped by application and tenant.
- Path/header/body context must match; cross-tenant APIs are absent.
- Snapshots contain only fields needed for the documented decision.
- Logs allow-list request ID, caller, application, tenant, analysis, outcome and quality
  status; request bodies, tokens and personal fields are never logged.
- The service has no transactional `DATABASE_URL` and performs no operational writes.
- Current service retains no snapshot or analytical result after request completion.
- Exports require separate permission, purpose, expiry and audit controls.

## Cross-tenant aggregates

None are implemented. A future aggregate requires explicit approval, minimum group
sizes/suppression, protection against differencing/re-identification, documented lawful
purpose and audit events. Platform-admin authentication alone is insufficient approval.

## Model training

Sensitive or personal data must not be used for training without documented purpose,
data minimisation, retention/deletion, access controls, evaluation and responsible owner.
No training pipeline exists in this phase.

## Incident response

On suspected exposure: revoke the caller credential, disable the affected route,
identify request IDs/tenants from metadata-only logs, preserve evidence, follow the
repository incident process, notify the privacy/security owner and document remediation.

