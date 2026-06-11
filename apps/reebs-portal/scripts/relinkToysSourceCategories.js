/* eslint-disable no-console, no-undef */
import { Client } from "pg";
import { DATABASE_URL, resolvePgSslConfig } from "../runtimeEnv.js";
import {
  createSourceCategory,
  ensureInventoryVariantSchema,
  findSourceCategoryByName,
  seedDefaultSourceCategories,
} from "../backend/functions/_shared/inventoryExtensions.js";

const relinkMap = {
  Household: [
    "Johnson's® Baby Cotton Buds",
    "Assorted Body Sprays & Deodorants",
    "Dove Body Care Essentials Pack",
  ],
  Supplies: [
    "Number Foil Balloon",
    "Shredded Tissue Paper",
    "A4 Filing & Envelope Set",
  ],
};

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const orgArg = [...args].find((arg) => arg.startsWith("--org="));
const organizationId = Number(orgArg?.slice("--org=".length) || 1);

if (!Number.isFinite(organizationId) || organizationId <= 0) {
  console.error("Use --org=<organizationId> with a positive numeric id.");
  process.exit(1);
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
});

const findMappedToyItems = async (names) => {
  const lowerNames = names.map((name) => name.toLowerCase());
  const toys = await findSourceCategoryByName(client, organizationId, "Toys");
  const result = await client.query(
    `SELECT p.id, p.name, p."sourceCategoryId", p."sourceCategoryCode", p."specificCategory"
     FROM "product" p
     WHERE p."organizationId" = $1
       AND COALESCE(p."isDeleted", false) = false
       AND lower(p.name) = ANY($2::text[])
       AND (
         upper(COALESCE(p."sourceCategoryCode", '')) = 'TOYS'
         OR lower(COALESCE(p."specificCategory", '')) = 'toys'
         OR ($3::int IS NOT NULL AND p."sourceCategoryId" = $3)
       )
     ORDER BY p.name, p.id`,
    [organizationId, lowerNames, toys?.id || null]
  );
  return result.rows;
};

try {
  await client.connect();
  await ensureInventoryVariantSchema(client);
  await seedDefaultSourceCategories(client, organizationId);

  console.log(`${apply ? "Applying" : "Dry run for"} Toys source-category relink in organization ${organizationId}.`);
  console.log("Only explicitly mapped product names are considered.");

  const movedByCategory = {};
  for (const [categoryName, names] of Object.entries(relinkMap)) {
    const category = await createSourceCategory(client, organizationId, categoryName);
    const matches = await findMappedToyItems(names);
    movedByCategory[categoryName] = matches.length;

    if (!matches.length) {
      console.log(`${categoryName}: no mapped Toys items found.`);
      continue;
    }

    console.log(`${categoryName}: ${matches.length} item(s) matched:`);
    matches.forEach((item) => {
      console.log(`  - #${item.id} ${item.name}`);
    });

    if (apply) {
      const ids = matches.map((item) => item.id);
      await client.query(
        `UPDATE "product"
         SET "sourceCategoryId" = $1,
             "specificCategory" = $2,
             "lastUpdatedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE "organizationId" = $3
           AND id = ANY($4::int[])`,
        [category.id, category.name, organizationId, ids]
      );
    }
  }

  console.log("Relink report:", movedByCategory);
  if (!apply) {
    console.log("No data was changed. Re-run with --apply after reviewing the matched item list.");
  }
} catch (err) {
  console.error("Toys relink failed:", err?.message || err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
