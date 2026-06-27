ALTER TYPE "SiteRole" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "SiteRole" ADD VALUE IF NOT EXISTS 'CUSTOM';

CREATE TABLE IF NOT EXISTS "PortalRole" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" JSONB NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PortalRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalRole_key_key" ON "PortalRole"("key");
CREATE INDEX IF NOT EXISTS "PortalRole_isActive_idx" ON "PortalRole"("isActive");
CREATE INDEX IF NOT EXISTS "PortalRole_isSystem_idx" ON "PortalRole"("isSystem");

ALTER TABLE "SiteUser" ADD COLUMN IF NOT EXISTS "customRoleId" TEXT;
CREATE INDEX IF NOT EXISTS "SiteUser_customRoleId_idx" ON "SiteUser"("customRoleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SiteUser_customRoleId_fkey'
  ) THEN
    ALTER TABLE "SiteUser"
      ADD CONSTRAINT "SiteUser_customRoleId_fkey"
      FOREIGN KEY ("customRoleId") REFERENCES "PortalRole"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
