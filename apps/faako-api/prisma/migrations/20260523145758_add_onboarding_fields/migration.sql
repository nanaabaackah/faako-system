-- DropIndex
DROP INDEX "SignupRequest_packageTier_idx";

-- AlterTable
ALTER TABLE "RequestThrottle" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SignupRequest" ADD COLUMN     "onboardingIntake" JSONB,
ADD COLUMN     "setupChecklist" JSONB;
