-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('PERSONAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('BACKLOG', 'SCOPING', 'ACTIVE', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "ownerUserId" INTEGER,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "projectType" "ProjectType" NOT NULL DEFAULT 'PERSONAL',
    "stage" "ProjectStage" NOT NULL DEFAULT 'BACKLOG',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'MEDIUM',
    "currency" "CurrencyCode",
    "budgetAmount" DECIMAL(14,2),
    "dueDate" DATE,
    "description" TEXT,
    "externalRef" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_organizationId_stage_idx" ON "Project"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "Project_organizationId_projectType_idx" ON "Project"("organizationId", "projectType");

-- CreateIndex
CREATE INDEX "Project_organizationId_dueDate_idx" ON "Project"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "Project_ownerUserId_idx" ON "Project"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
