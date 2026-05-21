-- Add proposal persistence foundation.
-- This is additive only: no existing payment, invoice, rent, booking, or accounting tables are changed.

CREATE TABLE IF NOT EXISTS "Proposal" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "createdByUserId" INTEGER,
  "lastEditedByUserId" INTEGER,
  "title" TEXT NOT NULL,
  "clientName" TEXT,
  "proposalType" TEXT NOT NULL DEFAULT 'website',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "content" JSONB NOT NULL,
  "shareToken" TEXT,
  "shareTokenCreatedAt" TIMESTAMP(3),
  "shareTokenExpiresAt" TIMESTAMP(3),
  "sharedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Proposal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Proposal_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Proposal_lastEditedByUserId_fkey"
    FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_shareToken_key"
  ON "Proposal" ("shareToken");

CREATE INDEX IF NOT EXISTS "Proposal_organizationId_status_idx"
  ON "Proposal" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "Proposal_organizationId_proposalType_idx"
  ON "Proposal" ("organizationId", "proposalType");

CREATE INDEX IF NOT EXISTS "Proposal_organizationId_updatedAt_idx"
  ON "Proposal" ("organizationId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Proposal_shareToken_idx"
  ON "Proposal" ("shareToken");
