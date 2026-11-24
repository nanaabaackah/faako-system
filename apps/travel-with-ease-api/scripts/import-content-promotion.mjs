import { readFile, stat } from "node:fs/promises";
import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { ContentPromotionImporter } from "../src/content/promotion.js";
import { readR2Config, R2Store } from "../src/media/r2.js";

if (process.env.APP_ENV !== "production" || process.env.NODE_ENV !== "production")
  throw new Error("Promotion import is production-only.");
if (!process.argv.includes("--confirm-initial-production-content"))
  throw new Error("Initial production content promotion requires explicit confirmation.");
const input = process.argv[2];
if (!input || !input.endsWith(".json")) throw new Error("Choose the reviewed promotion .json file.");
const details = await stat(input);
if (!details.isFile() || details.size < 100 || details.size > 500 * 1024 * 1024)
  throw new Error("Promotion bundle size is invalid.");
const organisationId = process.env.TWE_ORGANISATION_ID;
const actorId = process.env.TWE_PROMOTION_ACTOR_ID;
const pool = createDatabase(process.env, "TWE_MIGRATION_DATABASE_URL");
try {
  await verifyDatabaseIdentity(pool, { environment: "production", organisationId });
  const storage = readR2Config();
  if (!storage) throw new Error("Production R2 is required for promotion import.");
  const bundle = JSON.parse(await readFile(input, "utf8"));
  const result = await new ContentPromotionImporter(pool, new R2Store(storage), { organisationId, actorId }).apply(bundle);
  console.log(JSON.stringify(result));
} finally { await pool.end(); }
