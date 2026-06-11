/* eslint-disable no-console, no-undef */
import { Client } from "pg";
import { DATABASE_URL, resolvePgSslConfig } from "../runtimeEnv.js";
import {
  DEFAULT_SOURCE_CATEGORIES,
  ensureInventoryVariantSchema,
  seedDefaultSourceCategories,
} from "../backend/functions/_shared/inventoryExtensions.js";

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: resolvePgSslConfig(),
});

const getOrganizationIds = async () => {
  const result = await client.query(`SELECT id FROM "organization" ORDER BY id`);
  const ids = result.rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  return ids.length ? ids : [1];
};

try {
  await client.connect();
  await ensureInventoryVariantSchema(client);
  const organizationIds = await getOrganizationIds();

  for (const organizationId of organizationIds) {
    await seedDefaultSourceCategories(client, organizationId);
    console.log(
      `Seeded ${DEFAULT_SOURCE_CATEGORIES.map((category) => category.name).join(", ")} for organization ${organizationId}.`
    );
  }

  console.log(`Done. Checked ${organizationIds.length} organization(s).`);
} catch (err) {
  console.error("Failed to seed inventory products:", err?.message || err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
