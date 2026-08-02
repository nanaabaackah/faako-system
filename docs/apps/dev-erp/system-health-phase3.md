# System Health Dashboard Phase 3

## Architecture

Phase 3 adds a persisted incident-response layer beneath the existing Phase 1/2 System Health presentation. `backend/monitoring/alerts` owns rule evaluation, deterministic deduplication, delivery, retries, and escalation. `backend/monitoring/incidents` owns scoped lifecycle actions, timelines, response targets, and safe exports. `backend/monitoring/maintenance` owns planned suppression while Phase 2 checks continue to run and persist.

Incident creation never depends on notification delivery. Operational records, delivery attempts, timelines, and escalation steps survive process restarts. The execution loop remains process-local and must run on one API instance until a distributed lease or queue is approved.

## Database and migration

The additive `20260731203000_monitoring_incident_response` migration extends `MonitoringIncident` and creates `AlertRule`, `AlertEvent`, `IncidentTimelineEntry`, `MonitoringNotificationChannel`, `AlertRuleChannel`, `EscalationPolicy`, `EscalationStep`, `MaintenanceWindow`, and `MonitoringNotification`. It also adds lookup, active-incident, deduplication, target, delivery, timeline, and maintenance indexes.

The migration is created but not applied. Review and deploy it before deploying Phase 3 application code. No production migration was run.

## Alert rules and deduplication

Rules use validated enum fields rather than executable expressions. They may target one service, a category, an environment, or the full authorized scope. Supported triggers are service Down, service Degraded, consecutive failures, latency threshold, uptime threshold, unacknowledged incident age, unresolved incident age, SSL expiry, worker staleness, and critical dependency failure.

Events use a persistent key derived from rule, service, incident, event type, channel, and—only for repeated/suppressed events—a cooldown bucket. A continuous outage therefore maps to one incident; checks update it while cooldowns prevent duplicate delivery. Recovery has a separate event identity.

When `MONITORING_ALERTS_ENABLED=true`, startup creates safe global default rules and an in-app channel if they do not exist. Rules and channels remain editable through protected APIs.

## Incident lifecycle and assignment

Valid lifecycle paths are:

- `OPEN → ACKNOWLEDGED → RESOLVED → CLOSED`
- `OPEN → RESOLVED`
- `RESOLVED/CLOSED → OPEN` through controlled reopening

Manual resolution requires a resolution summary. Reopening requires a note. Notes are append-only timeline entries. Assignment accepts only an active user or an existing role resolved server-side in the requester's authorized organization scope. Reassignment creates timeline, audit, and in-app notification records.

Automatic monitoring creates `CREATED` and `DETECTED` entries. Alert delivery, acknowledgement, assignment, notes, escalation, target breaches, maintenance suppression, recovery, resolution, closure, and reopening are structured timeline records rather than unstructured log text.

## Response and resolution targets

Targets are operational targets, not contractual SLAs:

| Severity | First response | Resolution |
| --- | ---: | ---: |
| Info | 8 hours | 3 business days |
| Warning | 1 hour | 8 hours |
| Critical | 15 minutes | 2 hours |

Due timestamps are stored on the incident. The persistent sweep records each first breach once, adds a timeline entry, writes an audit event, and allows the attached escalation policy to continue.

## Notification channels

- In-app: implemented and required. Notifications are stored, organization/user scoped, linked to the incident, and expose an unread count.
- Email: implemented through the existing Dev ERP Resend-backed `sendEmail` infrastructure. Subject/body content is bounded and escaped; provider errors are reduced to generic safe messages.
- WhatsApp: disabled abstraction. Dev ERP has no approved WhatsApp incident-delivery integration, so credentials are not accepted or used.
- Webhook: disabled in Phase 3. Arbitrary outbound destinations are not accepted; signing/SSRF-safe delivery remains a Phase 4 decision.

Non-in-app channel configuration is encrypted with AES-256-GCM through `MONITORING_CHANNEL_ENCRYPTION_KEY`. API serializers never return `encryptedConfig`, recipients, credentials, phone identifiers, provider tokens, or raw payloads.

## Delivery reliability and escalation

Delivery state is persisted as Pending, Sent, Failed, or Skipped. Retries are bounded by count, delayed, limited per sweep, and use sanitized errors. Pending records left by a process interruption are eligible after restart. Skipped disabled providers do not retry.

Escalation policies contain ordered persisted steps targeting a validated active user, organization role, or authorized channel. A deterministic event per incident/step prevents repeats after restart. Policies stop after resolution and may stop after acknowledgement globally or per step.

## Maintenance windows and recovery

Windows may target one service, category, environment, or organization scope. Start/end times are validated and limited to 90 days. Checks continue during maintenance. Affected check details receive safe maintenance markers, matching alerts produce Suppressed events, active incidents receive `MAINTENANCE_SUPPRESSED` timeline entries, and new expected-outage incidents are not created in the matching scope. Scheduled windows become Active and expired windows become Completed automatically; authorized users may cancel active or scheduled windows.

Recovery uses the Phase 2 confirmation threshold. Recovery counts persist, pending escalation stops when status resolves, history remains, and each rule that actually delivered an outage alert may deliver one separate recovery notification. Recovery does not auto-close incidents.

## Authorization matrix

All endpoints first require authentication and the existing System Health module capability. Phase 3 then requires the following action capability; Admin retains the existing unrestricted role behavior but still remains organization scoped unless its email is explicitly configured in `GLOBAL_ADMIN_EMAILS`.

| Action | Capability |
| --- | --- |
| List/detail/timeline/notifications/maintenance read | `INCIDENT_VIEW` |
| Acknowledge | `INCIDENT_ACKNOWLEDGE` |
| Assign/responders | `INCIDENT_ASSIGN` |
| Add notes/update | `INCIDENT_UPDATE` |
| Resolve/close/reopen | `INCIDENT_RESOLVE` |
| PDF/CSV export | `INCIDENT_EXPORT` |
| Alert rules | `ALERT_RULE_MANAGE` |
| Channels | `ALERT_CHANNEL_MANAGE` |
| Escalation policies | `ESCALATION_POLICY_MANAGE` |
| Maintenance mutation | `MAINTENANCE_WINDOW_MANAGE` |

Non-global users query and mutate only their `organizationId`. Cross-organization/global access requires the existing explicit global-admin boundary. Unsafe methods also retain global CSRF protection and Phase 3 mutation rate limiting. Every sensitive action writes the existing sanitized audit format.

## APIs

Phase 3 adds protected incident list/detail, acknowledge, assign, note, update, resolve, close, reopen, timeline, PDF/CSV export, safe responder lookup, alert-rule CRUD/enable/disable, channel CRUD/test, escalation-policy CRUD, maintenance CRUD/cancel, and in-app notification list/read endpoints under `/api/monitoring`.

## UI

The existing dashboard now includes active-maintenance banners and a compact Incident Response panel. It provides active/unacknowledged/critical/breached summaries, search/status/severity filters, required incident fields, a keyboard-dismissable timeline drawer, response-target state, lifecycle actions, safe responder selection, exports, alert rules, notification channels, and maintenance scheduling. Mobile layouts collapse the incident table into cards; the existing service dashboard remains unchanged.

## Safe exports

CSV and PDF exports contain incident/service status, duration timestamps, impact, root cause, resolution, structured timeline, assignment identifiers, and minimized delivery history. They exclude model metadata, encrypted channel configuration, recipients, tokens, raw provider/webhook content, database URLs, and connection details. Every export is capability checked, rate limited, and audited.

## Environment variables

Required before enabling email channels:

- `MONITORING_CHANNEL_ENCRYPTION_KEY`: dedicated 32-byte hex/base64 key
- `MONITORING_EMAIL_FROM` and optional `MONITORING_EMAIL_REPLY_TO`
- Existing `RESEND_API_KEY`

Operational controls:

- `MONITORING_ALERTS_ENABLED`
- `MONITORING_ALERT_COOLDOWN_MINUTES`
- `MONITORING_NOTIFICATION_MAX_RETRIES`
- `MONITORING_NOTIFICATION_RETRY_DELAY_MS`
- `MONITORING_ESCALATION_INTERVAL_SECONDS`
- `MONITORING_SLA_CHECK_INTERVAL_SECONDS`

Reserved WhatsApp/webhook variables remain backend-only and disabled. None may use a `VITE_` prefix.

## Deployment

1. Back up and review the target database and additive migration SQL.
2. Keep `MONITORING_ALERTS_ENABLED=false` and `MONITORING_ENABLED=false`.
3. Apply the development migration with `pnpm --filter @faako/dev-erp run db:deploy:dev`.
4. Configure a new dedicated encryption key and email sender values.
5. Deploy backend and frontend together.
6. Verify incident/rule/channel/maintenance APIs and organization boundaries while alert execution remains disabled.
7. Enable Phase 2 monitoring on one API instance, then enable Phase 3 alerts on that same instance.
8. Exercise a test rule and in-app channel before enabling email delivery.
9. Confirm alert, acknowledgement, assignment, escalation, recovery, export, and audit records contain no secrets.
10. Use `db:deploy:prod` only during a separately reviewed production rollout; never use `migrate dev` against production.

## Validation record

Prisma validation/generation, the full 243-test Dev ERP suite, full lint, typecheck, production build, focused syntax/whitespace checks, the repository security scan, and responsive light/dark browser QA passed. Browser QA covered all six monitoring categories, maintenance banners, incident filters/detail, notification links, administration tabs, Escape-key drawer closure, and zero horizontal overflow at 1440px and 390px.

The repository-wide security gate was also run. It remains blocked only by unrelated pre-existing configuration gaps: `apps/faako-website/appSystem.js` and `apps/ttngh/appSystem.js` are missing. Phase 3 did not alter those apps.

## Known limitations and Phase 4

- Scheduler, mutation throttling, and delivery execution are process-local; persistence prevents duplicate logical events but does not provide a distributed queue.
- WhatsApp and webhook delivery are deliberately disabled.
- No full on-call rota, public status page, customer subscriptions, SMS, mobile push, AI root-cause analysis, automated restart/rollback/failover, log aggregation, multi-region probes, or contractual SLA module exists.
- Phase 4 may add a distributed lease/queue, approved WhatsApp adapter, DNS-pinned signed webhooks, on-call schedules, maintenance-aware SLO reporting, delivery replay administration, and broader incident analytics after separate security review.
