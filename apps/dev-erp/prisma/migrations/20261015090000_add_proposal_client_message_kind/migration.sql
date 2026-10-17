-- Phase 3 client interaction classification.
-- Additive only: existing revision requests remain REVISION records.

CREATE TYPE "ProposalClientMessageKind" AS ENUM ('REVISION', 'QUESTION', 'DECLINE');

ALTER TABLE "ProposalRevisionRequest"
  ADD COLUMN "kind" "ProposalClientMessageKind" NOT NULL DEFAULT 'REVISION',
  ADD COLUMN "requestKey" TEXT;

CREATE UNIQUE INDEX "ProposalRevisionRequest_requestKey_key"
  ON "ProposalRevisionRequest"("requestKey");

CREATE INDEX "ProposalRevisionRequest_proposalVersionId_kind_createdAt_idx"
  ON "ProposalRevisionRequest"("proposalVersionId", "kind", "createdAt");
