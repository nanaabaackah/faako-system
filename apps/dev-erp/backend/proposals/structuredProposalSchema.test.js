import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.resolve(directory, "../../prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.resolve(
    directory,
    "../../prisma/migrations/20261014090000_add_structured_proposal_foundation/migration.sql"
  ),
  "utf8"
);
const clientMessageMigration = fs.readFileSync(
  path.resolve(
    directory,
    "../../prisma/migrations/20261015090000_add_proposal_client_message_kind/migration.sql"
  ),
  "utf8"
);
const acceptanceMigration = fs.readFileSync(
  path.resolve(
    directory,
    "../../prisma/migrations/20261016090000_add_proposal_acceptance_billing/migration.sql"
  ),
  "utf8"
);
const tierMigration = fs.readFileSync(
  path.resolve(
    directory,
    "../../prisma/migrations/20261017090000_add_proposal_catalogue_tiers/migration.sql"
  ),
  "utf8"
);
const emailDeliveryMigration = fs.readFileSync(
  path.resolve(
    directory,
    "../../prisma/migrations/20261019090000_add_proposal_email_delivery/migration.sql"
  ),
  "utf8"
);

test("structured proposal schema includes catalogue, versions, selections, approvals, and billing", () => {
  for (const model of [
    "CommercialCatalogueItem",
    "CommercialPackage",
    "ProposalVersion",
    "ProposalVersionItem",
    "ProposalClientSelection",
    "ProposalRevisionRequest",
    "ProposalApprovalSnapshot",
    "ProposalBillingScheduleItem",
    "ProposalAccessLink",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.match(schema, /@@unique\(\[organizationId, kind, normalizedName\]\)/);
  assert.match(schema, /@@unique\(\[proposalId, versionNumber\]\)/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /selectedByDefault\s+Boolean\s+@default\(true\)/);
});
test("structured proposal migration is additive and leaves invoice quotations untouched", () => {
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bUPDATE\s+"?(Invoice|Proposal)"?\b/i);
  assert.doesNotMatch(migration, /ALTER\s+TYPE\s+"InvoiceStatus"/i);
  assert.match(migration, /ALTER TABLE "Proposal" ADD COLUMN "projectId" INTEGER/);
  assert.match(migration, /CREATE TABLE "ProposalVersion"/);
  assert.match(migration, /"selectedByDefault" BOOLEAN NOT NULL DEFAULT true/);
});

test("interactive client-message migration is additive and idempotency-ready", () => {
  assert.match(schema, /enum ProposalClientMessageKind \{/);
  assert.match(schema, /kind\s+ProposalClientMessageKind\s+@default\(REVISION\)/);
  assert.match(schema, /requestKey\s+String\?\s+@unique/);
  assert.doesNotMatch(clientMessageMigration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(clientMessageMigration, /\bDELETE\s+FROM\b/i);
  assert.match(clientMessageMigration, /CREATE TYPE "ProposalClientMessageKind"/);
  assert.match(clientMessageMigration, /ADD COLUMN\s+"requestKey" TEXT/);
});

test("Phase 4 acceptance and invoice traceability remain additive", () => {
  assert.match(schema, /acceptanceKey\s+String\?\s+@unique/);
  assert.match(schema, /consentConfirmed\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /generationKey\s+String\?\s+@unique/);
  assert.match(schema, /proposalVersionId\s+Int\?/);
  assert.match(schema, /enum ProposalBillingScheduleStatus \{/);
  assert.doesNotMatch(acceptanceMigration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(acceptanceMigration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(acceptanceMigration, /\bUPDATE\s+"?(Invoice|Proposal)"?\b/i);
  assert.match(acceptanceMigration, /Invoice_generationKey_key/);
  assert.match(acceptanceMigration, /Invoice_proposalVersionId_fkey/);
  assert.match(schema, /acceptedProposalVersionId\s+Int\?\s+@unique/);
  assert.match(acceptanceMigration, /Project_acceptedProposalVersionId_fkey/);
});

test("proposal catalogue tiers and version pricing snapshots are additive", () => {
  assert.match(schema, /model CommercialCatalogueTier \{/);
  assert.match(schema, /systemKey\s+String\?/);
  assert.match(schema, /selectedTierName\s+String\?/);
  assert.match(schema, /providerCharge\s+Json\?/);
  assert.doesNotMatch(tierMigration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(tierMigration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(tierMigration, /\bUPDATE\s+"?(Invoice|Proposal|CommercialCatalogueItem)"?\b/i);
  assert.match(tierMigration, /CREATE TABLE "CommercialCatalogueTier"/);
  assert.match(tierMigration, /ADD COLUMN "selectedTierName" TEXT/);
});

test("proposal email delivery metadata is additive and never stores raw tokens", () => {
  assert.match(schema, /enum ProposalEmailDeliveryStatus \{/);
  assert.match(schema, /sendIdempotencyKey\s+String\?/);
  assert.match(schema, /@@unique\(\[proposalVersionId, sendIdempotencyKey\]\)/);
  assert.match(schema, /sendRequestFingerprint\s+String\?/);
  assert.doesNotMatch(emailDeliveryMigration, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(emailDeliveryMigration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(emailDeliveryMigration, /\bUPDATE\s+"?(Proposal|ProposalAccessLink)"?\b/i);
  assert.match(emailDeliveryMigration, /ProposalAccessLink_proposalVersionId_sendIdempotencyKey_key/);
  assert.doesNotMatch(emailDeliveryMigration, /rawToken|tokenCipher|tokenPlain/i);
});
