-- Invitation-backed account activation. Raw invitation tokens are never stored.
CREATE TABLE "userInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB,
    "tokenHash" TEXT NOT NULL,
    "createdByUserId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "userInvitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "userInvitation_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "userInvitation_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "userInvitation_tokenHash_key" ON "userInvitation"("tokenHash");
CREATE INDEX "userInvitation_organizationId_email_idx"
  ON "userInvitation"("organizationId", "email");
CREATE INDEX "userInvitation_active_lookup_idx"
  ON "userInvitation"("organizationId", "expiresAt", "acceptedAt", "revokedAt");
