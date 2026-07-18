import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../../prisma/schema.prisma", import.meta.url);
const migrationUrl = new URL(
  "../../prisma/migrations/20260717010000_add_trello_project_sync/migration.sql",
  import.meta.url
);

test("Trello schema stores encrypted connection, card sync, and idempotent webhook fields", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  assert.match(schema, /model TrelloConnection \{/);
  assert.match(schema, /apiTokenEncrypted\s+String/);
  assert.match(schema, /organizationId\s+Int\s+@unique/);
  assert.match(schema, /trelloCardId\s+String\?\s+@unique/);
  assert.match(schema, /model TrelloWebhookEvent \{/);
  assert.match(schema, /actionId\s+String\s+@unique/);
});

test("Trello migration is additive and does not delete existing project data", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /ALTER TABLE "ProjectTask"[\s\S]*ADD COLUMN "trelloCardId"/);
  assert.match(migration, /CREATE TABLE "TrelloConnection"/);
  assert.match(migration, /CREATE TABLE "TrelloWebhookEvent"/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);
});
