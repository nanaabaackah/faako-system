CREATE TABLE IF NOT EXISTS "websiteContent" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "section" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "websiteContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "websiteContent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "websiteContent_org_section_key_key"
  ON "websiteContent" ("organizationId", "section", "key");

CREATE INDEX IF NOT EXISTS "websiteContent_org_section_active_sort_idx"
  ON "websiteContent" ("organizationId", "section", "isActive", "sortOrder");
