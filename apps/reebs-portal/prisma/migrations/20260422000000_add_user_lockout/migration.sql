-- AlterTable: add account lockout fields to user table
ALTER TABLE "user" ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN "lockedUntil" TIMESTAMP(3);
