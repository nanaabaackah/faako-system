-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'BLOCKED');

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "startDate" DATE,
ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "health" "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK';
