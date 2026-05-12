-- CreateEnum
CREATE TYPE "SiteRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "SiteUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "SiteRole" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "SiteUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteUser_username_key" ON "SiteUser"("username");

-- AddForeignKey
ALTER TABLE "SiteUser" ADD CONSTRAINT "SiteUser_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "SiteUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
