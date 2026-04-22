-- CreateTable: audit trail for auth events
CREATE TABLE IF NOT EXISTS "auditLog" (
    "id"             SERIAL       NOT NULL,
    "organizationId" INTEGER,
    "userId"         INTEGER,
    "action"         TEXT         NOT NULL,
    "targetType"     TEXT,
    "targetId"       TEXT,
    "metadata"       JSONB,
    "ipAddress"      TEXT,
    "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "auditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auditLog_organizationId_action_createdAt_idx" ON "auditLog"("organizationId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "auditLog_userId_createdAt_idx" ON "auditLog"("userId", "createdAt");
