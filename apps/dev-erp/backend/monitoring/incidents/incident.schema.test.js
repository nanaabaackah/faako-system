import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schemaUrl = new URL("../../../prisma/schema.prisma", import.meta.url);
const migrationUrl = new URL("../../../prisma/migrations/20260731203000_monitoring_incident_response/migration.sql", import.meta.url);

test("Phase 3 schema stores rules, deduplication, encrypted channels, timelines, escalation, and maintenance", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  for (const model of ["AlertRule", "AlertEvent", "IncidentTimelineEntry", "MonitoringNotificationChannel", "EscalationPolicy", "EscalationStep", "MaintenanceWindow", "MonitoringNotification"]) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.match(schema, /deduplicationKey\s+String\s+@unique/);
  assert.match(schema, /encryptedConfig\s+String\?/);
  const channelModel = schema.match(/model MonitoringNotificationChannel \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(channelModel, /webhookSecret\s+String|accessToken\s+String/);
});

test("Phase 3 migration is additive and does not delete existing monitoring records", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /ALTER TABLE "MonitoringIncident"[\s\S]*ADD COLUMN "organizationId"/);
  assert.match(migration, /CREATE TABLE "AlertRule"/);
  assert.match(migration, /CREATE TABLE "MaintenanceWindow"/);
  assert.match(migration, /CREATE UNIQUE INDEX "AlertEvent_deduplicationKey_key"/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);
});
