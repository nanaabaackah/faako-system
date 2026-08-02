CREATE TYPE "MonitoringCategory" AS ENUM ('BUSINESS', 'API', 'DATABASE', 'INFRASTRUCTURE', 'EXTERNAL', 'WORKER');
CREATE TYPE "MonitoringCheckType" AS ENUM ('HTTP', 'DATABASE', 'DNS', 'SSL', 'TCP', 'WORKER', 'EXTERNAL', 'SYNTHETIC');
CREATE TYPE "MonitoringStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "IncidentSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "MonitoredService" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "MonitoringCategory" NOT NULL,
  "environment" TEXT NOT NULL,
  "provider" TEXT,
  "checkType" "MonitoringCheckType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "intervalSeconds" INTEGER NOT NULL,
  "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "critical" BOOLEAN NOT NULL DEFAULT false,
  "safeTargetLabel" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonitoredService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthCheck" (
  "id" SERIAL NOT NULL,
  "serviceId" INTEGER NOT NULL,
  "status" "MonitoringStatus" NOT NULL,
  "latencyMs" INTEGER,
  "httpStatus" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "errorCode" TEXT,
  "errorSummary" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonitoringIncident" (
  "id" SERIAL NOT NULL,
  "serviceId" INTEGER NOT NULL,
  "status" "IncidentStatus" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "recoveryCount" INTEGER NOT NULL DEFAULT 0,
  "rootCause" TEXT,
  "summary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonitoringIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceDependency" (
  "id" SERIAL NOT NULL,
  "serviceId" INTEGER NOT NULL,
  "dependsOnServiceId" INTEGER NOT NULL,
  CONSTRAINT "ServiceDependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonitoredService_key_key" ON "MonitoredService"("key");
CREATE INDEX "MonitoredService_category_enabled_idx" ON "MonitoredService"("category", "enabled");
CREATE INDEX "MonitoredService_environment_enabled_idx" ON "MonitoredService"("environment", "enabled");
CREATE INDEX "HealthCheck_serviceId_startedAt_idx" ON "HealthCheck"("serviceId", "startedAt");
CREATE INDEX "HealthCheck_status_startedAt_idx" ON "HealthCheck"("status", "startedAt");
CREATE INDEX "MonitoringIncident_serviceId_startedAt_idx" ON "MonitoringIncident"("serviceId", "startedAt");
CREATE INDEX "MonitoringIncident_status_startedAt_idx" ON "MonitoringIncident"("status", "startedAt");
CREATE UNIQUE INDEX "ServiceDependency_serviceId_dependsOnServiceId_key" ON "ServiceDependency"("serviceId", "dependsOnServiceId");
CREATE INDEX "ServiceDependency_serviceId_idx" ON "ServiceDependency"("serviceId");
CREATE INDEX "ServiceDependency_dependsOnServiceId_idx" ON "ServiceDependency"("dependsOnServiceId");

ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitoringIncident" ADD CONSTRAINT "MonitoringIncident_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDependency" ADD CONSTRAINT "ServiceDependency_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDependency" ADD CONSTRAINT "ServiceDependency_dependsOnServiceId_fkey" FOREIGN KEY ("dependsOnServiceId") REFERENCES "MonitoredService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
