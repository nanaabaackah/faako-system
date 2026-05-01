ALTER TABLE "AuditLog"
ADD COLUMN IF NOT EXISTS "appKey" TEXT,
ADD COLUMN IF NOT EXISTS "environment" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "severity" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT,
ADD COLUMN IF NOT EXISTS "summary" TEXT,
ADD COLUMN IF NOT EXISTS "actorType" TEXT,
ADD COLUMN IF NOT EXISTS "actorLabel" TEXT,
ADD COLUMN IF NOT EXISTS "requestId" TEXT,
ADD COLUMN IF NOT EXISTS "externalRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_externalRef_key" ON "AuditLog"("externalRef");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_source_createdAt_idx" ON "AuditLog"("source", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_category_createdAt_idx" ON "AuditLog"("category", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");
