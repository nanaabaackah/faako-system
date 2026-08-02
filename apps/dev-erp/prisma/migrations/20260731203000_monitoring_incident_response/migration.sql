ALTER TYPE "IncidentStatus" ADD VALUE 'CLOSED';

CREATE TYPE "AlertTriggerType" AS ENUM ('SERVICE_DOWN', 'SERVICE_DEGRADED', 'CONSECUTIVE_FAILURES', 'LATENCY_THRESHOLD', 'UPTIME_BELOW', 'INCIDENT_UNACKNOWLEDGED', 'INCIDENT_UNRESOLVED', 'SSL_EXPIRY', 'WORKER_STALE', 'CRITICAL_DEPENDENCY_FAILURE');
CREATE TYPE "AlertEventType" AS ENUM ('TRIGGERED', 'REPEATED', 'ESCALATED', 'DELIVERY_FAILED', 'RECOVERED', 'SUPPRESSED');
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "NotificationChannelType" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'WEBHOOK');
CREATE TYPE "IncidentTimelineType" AS ENUM ('CREATED', 'DETECTED', 'ALERT_SENT', 'ACKNOWLEDGED', 'ASSIGNED', 'UPDATED', 'NOTE_ADDED', 'ESCALATED', 'SLA_BREACHED', 'RECOVERY_DETECTED', 'RESOLVED', 'CLOSED', 'REOPENED', 'MAINTENANCE_SUPPRESSED');
CREATE TYPE "EscalationTargetType" AS ENUM ('USER', 'ROLE', 'CHANNEL');
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

ALTER TABLE "MonitoringIncident"
  ADD COLUMN "organizationId" INTEGER,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "acknowledgedByUserId" INTEGER,
  ADD COLUMN "recoveredAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "assignedUserId" INTEGER,
  ADD COLUMN "assignedRoleId" INTEGER,
  ADD COLUMN "responseDueAt" TIMESTAMP(3),
  ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
  ADD COLUMN "responseBreachedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionBreachedAt" TIMESTAMP(3),
  ADD COLUMN "autoResolve" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "impactSummary" TEXT,
  ADD COLUMN "resolutionSummary" TEXT;

CREATE TABLE "EscalationPolicy" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "stopOnAcknowledge" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonitoringNotificationChannel" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER,
  "name" TEXT NOT NULL,
  "type" "NotificationChannelType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "safeDisplay" TEXT,
  "encryptedConfig" TEXT,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonitoringNotificationChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertRule" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER,
  "serviceId" INTEGER,
  "escalationPolicyId" INTEGER,
  "name" TEXT NOT NULL,
  "triggerType" "AlertTriggerType" NOT NULL,
  "category" "MonitoringCategory",
  "environment" TEXT,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'WARNING',
  "thresholdValue" DOUBLE PRECISION,
  "consecutiveFailures" INTEGER,
  "cooldownMinutes" INTEGER NOT NULL DEFAULT 15,
  "recoveryNotifications" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertRuleChannel" (
  "ruleId" INTEGER NOT NULL,
  "channelId" INTEGER NOT NULL,
  CONSTRAINT "AlertRuleChannel_pkey" PRIMARY KEY ("ruleId", "channelId")
);

CREATE TABLE "AlertEvent" (
  "id" SERIAL NOT NULL,
  "ruleId" INTEGER NOT NULL,
  "serviceId" INTEGER NOT NULL,
  "incidentId" INTEGER,
  "channelId" INTEGER,
  "eventType" "AlertEventType" NOT NULL,
  "deliveryStatus" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deduplicationKey" TEXT NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "errorSummary" TEXT,
  "safeSummary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentTimelineEntry" (
  "id" SERIAL NOT NULL,
  "incidentId" INTEGER NOT NULL,
  "type" "IncidentTimelineType" NOT NULL,
  "actorUserId" INTEGER,
  "actorLabel" TEXT,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentTimelineEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EscalationStep" (
  "id" SERIAL NOT NULL,
  "policyId" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "delayMinutes" INTEGER NOT NULL,
  "targetType" "EscalationTargetType" NOT NULL,
  "targetUserId" INTEGER,
  "targetRoleId" INTEGER,
  "targetChannelId" INTEGER,
  "stopOnAcknowledge" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EscalationStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceWindow" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER,
  "serviceId" INTEGER,
  "category" "MonitoringCategory",
  "environment" TEXT,
  "name" TEXT NOT NULL,
  "reason" TEXT,
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "suppressAlerts" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" INTEGER,
  "cancelledByUserId" INTEGER,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonitoringNotification" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER,
  "userId" INTEGER,
  "incidentId" INTEGER NOT NULL,
  "type" "AlertEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "link" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonitoringNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonitoringIncident_organizationId_status_startedAt_idx" ON "MonitoringIncident"("organizationId", "status", "startedAt");
CREATE INDEX "MonitoringIncident_assignedUserId_status_idx" ON "MonitoringIncident"("assignedUserId", "status");
CREATE INDEX "MonitoringIncident_responseDueAt_status_idx" ON "MonitoringIncident"("responseDueAt", "status");
CREATE INDEX "MonitoringIncident_resolutionDueAt_status_idx" ON "MonitoringIncident"("resolutionDueAt", "status");
CREATE INDEX "AlertRule_organizationId_enabled_triggerType_idx" ON "AlertRule"("organizationId", "enabled", "triggerType");
CREATE INDEX "AlertRule_serviceId_enabled_idx" ON "AlertRule"("serviceId", "enabled");
CREATE INDEX "AlertRule_category_environment_enabled_idx" ON "AlertRule"("category", "environment", "enabled");
CREATE UNIQUE INDEX "AlertEvent_deduplicationKey_key" ON "AlertEvent"("deduplicationKey");
CREATE INDEX "AlertEvent_incidentId_createdAt_idx" ON "AlertEvent"("incidentId", "createdAt");
CREATE INDEX "AlertEvent_ruleId_serviceId_eventType_createdAt_idx" ON "AlertEvent"("ruleId", "serviceId", "eventType", "createdAt");
CREATE INDEX "AlertEvent_deliveryStatus_nextAttemptAt_idx" ON "AlertEvent"("deliveryStatus", "nextAttemptAt");
CREATE INDEX "IncidentTimelineEntry_incidentId_createdAt_idx" ON "IncidentTimelineEntry"("incidentId", "createdAt");
CREATE INDEX "IncidentTimelineEntry_type_createdAt_idx" ON "IncidentTimelineEntry"("type", "createdAt");
CREATE INDEX "MonitoringNotificationChannel_organizationId_type_enabled_idx" ON "MonitoringNotificationChannel"("organizationId", "type", "enabled");
CREATE INDEX "AlertRuleChannel_channelId_idx" ON "AlertRuleChannel"("channelId");
CREATE INDEX "EscalationPolicy_organizationId_enabled_idx" ON "EscalationPolicy"("organizationId", "enabled");
CREATE UNIQUE INDEX "EscalationStep_policyId_position_key" ON "EscalationStep"("policyId", "position");
CREATE INDEX "EscalationStep_policyId_delayMinutes_idx" ON "EscalationStep"("policyId", "delayMinutes");
CREATE INDEX "MaintenanceWindow_organizationId_status_startsAt_endsAt_idx" ON "MaintenanceWindow"("organizationId", "status", "startsAt", "endsAt");
CREATE INDEX "MaintenanceWindow_serviceId_status_startsAt_endsAt_idx" ON "MaintenanceWindow"("serviceId", "status", "startsAt", "endsAt");
CREATE INDEX "MaintenanceWindow_category_environment_status_idx" ON "MaintenanceWindow"("category", "environment", "status");
CREATE INDEX "MonitoringNotification_userId_readAt_createdAt_idx" ON "MonitoringNotification"("userId", "readAt", "createdAt");
CREATE INDEX "MonitoringNotification_organizationId_readAt_createdAt_idx" ON "MonitoringNotification"("organizationId", "readAt", "createdAt");
CREATE INDEX "MonitoringNotification_incidentId_createdAt_idx" ON "MonitoringNotification"("incidentId", "createdAt");

ALTER TABLE "MonitoringIncident" ADD CONSTRAINT "MonitoringIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitoringNotificationChannel" ADD CONSTRAINT "MonitoringNotificationChannel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_escalationPolicyId_fkey" FOREIGN KEY ("escalationPolicyId") REFERENCES "EscalationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertRuleChannel" ADD CONSTRAINT "AlertRuleChannel_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRuleChannel" ADD CONSTRAINT "AlertRuleChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MonitoringNotificationChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "MonitoringIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MonitoringNotificationChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentTimelineEntry" ADD CONSTRAINT "IncidentTimelineEntry_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "MonitoringIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscalationStep" ADD CONSTRAINT "EscalationStep_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "EscalationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitoringNotification" ADD CONSTRAINT "MonitoringNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitoringNotification" ADD CONSTRAINT "MonitoringNotification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "MonitoringIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
