import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("./migrations/20261007000000_current_water_product_prices/migration.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");

test("Water migration archives prior prices and backfills current product prices before retirement", () => {
  assert.match(migration, /INSERT INTO "waterPriceChange"/);
  assert.match(migration, /FROM "waterProductPrice" price[\s\S]*WHERE price\."effectiveFrom" <= CURRENT_TIMESTAMP/);
  assert.match(migration, /LAG\(price\."priceCents"\)/);
  assert.match(migration, /"retailPrice" INTEGER/);
  assert.match(migration, /"bulkPrice" INTEGER/);
  assert.match(migration, /"companyPrice" = COALESCE\(EXCLUDED\."companyPrice", "waterProductConfig"\."companyPrice"\)/);
  assert.match(migration, /DISABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY org_isolation ON "waterPriceChange"/);
});

test("Water migration removes only retired schedule storage and keeps sale snapshots", () => {
  assert.match(migration, /DROP COLUMN IF EXISTS "waterProductPriceId"/);
  assert.match(migration, /DROP TABLE "waterProductPrice"/);
  assert.doesNotMatch(migration, /DROP TABLE "(?!waterProductPrice")[A-Za-z0-9_]+"/);
  assert.doesNotMatch(migration, /DROP COLUMN "(?:unitPrice|standardUnitPrice|unitCostAtSaleCents|totalAmount)"/);
  assert.doesNotMatch(migration, /UPDATE\s+"waterSale"/i);
  assert.doesNotMatch(schema, /model WaterProductPrice\s*\{/);
  assert.match(schema, /model WaterProductConfig\s*\{[\s\S]*?retailPrice\s+Int\?[\s\S]*?companyPrice\s+Int\?[\s\S]*?bulkPrice\s+Int\?/);
  assert.match(schema, /model WaterPriceChange\s*\{/);
});
