-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "ProjectTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeUserId" INTEGER,
    "startDate" DATE,
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTask_organizationId_projectId_archivedAt_idx" ON "ProjectTask"("organizationId", "projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_archivedAt_idx" ON "ProjectTask"("projectId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "ProjectTask_organizationId_assigneeUserId_archivedAt_idx" ON "ProjectTask"("organizationId", "assigneeUserId", "archivedAt");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_dueDate_idx" ON "ProjectTask"("projectId", "dueDate");

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
