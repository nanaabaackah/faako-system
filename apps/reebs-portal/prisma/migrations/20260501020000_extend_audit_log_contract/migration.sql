ALTER TABLE "auditLog"
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

CREATE UNIQUE INDEX IF NOT EXISTS "auditLog_externalRef_key" ON "auditLog"("externalRef");
CREATE INDEX IF NOT EXISTS "auditLog_organizationId_createdAt_idx" ON "auditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "auditLog_source_createdAt_idx" ON "auditLog"("source", "createdAt");
CREATE INDEX IF NOT EXISTS "auditLog_category_createdAt_idx" ON "auditLog"("category", "createdAt");
CREATE INDEX IF NOT EXISTS "auditLog_severity_createdAt_idx" ON "auditLog"("severity", "createdAt");
