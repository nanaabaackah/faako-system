import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../../prisma/schema.prisma", import.meta.url);
const migrationUrl = new URL(
  "../../prisma/migrations/20260716010000_add_project_tasks/migration.sql",
  import.meta.url
);

test("project task schema defines the initial scoped task foundation", async () => {
  const schema = await readFile(schemaUrl, "utf8");

  assert.match(schema, /model ProjectTask \{/);
  assert.match(schema, /organizationId\s+Int/);
  assert.match(schema, /projectId\s+Int/);
  assert.match(schema, /assigneeUserId\s+Int\?/);
  assert.match(schema, /status\s+ProjectTaskStatus\s+@default\(BACKLOG\)/);
  assert.match(schema, /priority\s+ProjectTaskPriority\s+@default\(MEDIUM\)/);
  assert.match(schema, /@@index\(\[organizationId, projectId, archivedAt\]\)/);
  assert.match(schema, /enum ProjectTaskStatus \{\s+BACKLOG\s+TODO\s+IN_PROGRESS\s+REVIEW\s+BLOCKED\s+DONE\s+\}/s);
  assert.match(schema, /enum ProjectTaskPriority \{\s+LOW\s+MEDIUM\s+HIGH\s+URGENT\s+\}/s);
});

test("project task migration is additive and preserves task records through relations", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /CREATE TABLE "ProjectTask"/);
  assert.match(migration, /REFERENCES "Organization"\("id"\) ON DELETE RESTRICT/);
  assert.match(migration, /REFERENCES "Project"\("id"\) ON DELETE RESTRICT/);
  assert.match(migration, /REFERENCES "User"\("id"\) ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);
});
