-- Additive proposal-email delivery metadata. Existing proposal links remain
-- valid and are not rewritten or treated as previously emailed links.
CREATE TYPE "ProposalEmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "ProposalAccessLink"
  ADD COLUMN "sentTo" TEXT,
  ADD COLUMN "deliveryStatus" "ProposalEmailDeliveryStatus",
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "sendIdempotencyKey" TEXT,
  ADD COLUMN "sendRequestFingerprint" TEXT,
  ADD COLUMN "failureCategory" TEXT;

CREATE UNIQUE INDEX "ProposalAccessLink_proposalVersionId_sendIdempotencyKey_key"
  ON "ProposalAccessLink"("proposalVersionId", "sendIdempotencyKey");
CREATE INDEX "ProposalAccessLink_proposalVersionId_sentAt_idx"
  ON "ProposalAccessLink"("proposalVersionId", "sentAt");
