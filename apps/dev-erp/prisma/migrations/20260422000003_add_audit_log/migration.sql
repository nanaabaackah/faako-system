-- CreateTable: audit trail for auth and sensitive mutations
CREATE TABLE "AuditLog" (
    "id"             SERIAL       NOT NULL,
    "organizationId" INTEGER,
    "userId"         INTEGER,
    "action"         TEXT         NOT NULL,
    "targetType"     TEXT,
    "targetId"       TEXT,
    "metadata"       JSONB,
    "ipAddress"      TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_organizationId_action_createdAt_idx" ON "AuditLog"("organizationId", "action", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
