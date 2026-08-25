import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationUrl = new URL(
  "./migrations/20260815100000_phase6_commercial_configuration/migration.sql",
  import.meta.url
);
const migration = readFileSync(migrationUrl, "utf8");

test("Phase 6 migration is additive and leaves historical transaction amounts unchanged", () => {
  assert.match(migration, /CREATE TABLE "commercialConfiguration"/);
  assert.match(migration, /CREATE TABLE "waterProductPrice"/);
  assert.match(migration, /ADD COLUMN "unitCostCents" INTEGER/);
  assert.match(migration, /ADD COLUMN "unitCostAtSaleCents" INTEGER/);
  assert.doesNotMatch(migration, /(?:^|\n)\s*(?:DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE)\b/im);
  assert.doesNotMatch(migration, /UPDATE\s+"(?:orderItem|waterSale)"/i);
});

test("Phase 6 Water schema alignment removes dangerous create defaults without rewriting rows", () => {
  assert.match(migration, /ALTER COLUMN "unitCost" DROP DEFAULT/);
  assert.match(migration, /ALTER COLUMN "productKey" SET DEFAULT 'gwater-15pk'/);
  assert.doesNotMatch(migration, /UPDATE\s+"waterRestock"/i);
});

test("Phase 6 Water price seed does not classify or link products by fuzzy text", () => {
  assert.match(migration, /\bNULL,\s*'gwater-15pk'/i);
  assert.doesNotMatch(migration, /LIKE\s+'%water%'/i);
  assert.doesNotMatch(migration, /LIKE\s+'%gwater%'/i);
});

test("Phase 6 tenant-scoped configuration tables force row-level security", () => {
  for (const table of ["commercialConfiguration", "waterProductPrice"]) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`CREATE POLICY org_isolation ON "${table}"`));
  }
});
