import { readFile, stat } from "node:fs/promises";
import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { ContentPromotionImporter, verifyPromotionBundle } from "../src/content/promotion.js";
import { readR2Config, R2Store } from "../src/media/r2.js";

const [input, mode, ...extra] = process.argv.slice(2);
if (extra.length || !["--dry-run", "--confirm-initial-production-content"].includes(mode))
  throw new Error("Choose exactly one mode: --dry-run or --confirm-initial-production-content.");
if (!input || !input.endsWith(".json")) throw new Error("Choose the reviewed promotion .json file.");
const details = await stat(input);
if (!details.isFile() || details.size < 100 || details.size > 500 * 1024 * 1024)
  throw new Error("Promotion bundle size is invalid.");
const bundle = verifyPromotionBundle(JSON.parse(await readFile(input, "utf8")));
if (mode === "--dry-run") {
  // Offline verification deliberately never connects to PostgreSQL or R2.
  // This is not an approval of production state or authority.
  console.log(JSON.stringify({ status: "validated_offline", sourcePublicationId: bundle.source.publicationId,
    sourceSha: bundle.source.sourceSha, fingerprint: bundle.fingerprint,
    pages: Object.keys(bundle.pages).length, publishedPages: Object.values(bundle.pages).filter(Boolean).length,
    media: bundle.media.length, emailTemplates: Object.keys(bundle.emailTemplates || {}).length }));
} else {
  if (process.env.APP_ENV !== "production" || process.env.NODE_ENV !== "production")
    throw new Error("Promotion import is production-only.");
  const organisationId = process.env.TWE_ORGANISATION_ID;
  const actorId = process.env.TWE_PROMOTION_ACTOR_ID;
  const pool = createDatabase(process.env, "TWE_MIGRATION_DATABASE_URL");
  try {
    await verifyDatabaseIdentity(pool, { environment: "production", organisationId });
    const storage = readR2Config();
    if (!storage) throw new Error("Production R2 is required for promotion import.");
    const result = await new ContentPromotionImporter(pool, new R2Store(storage), { organisationId, actorId }).apply(bundle);
    console.log(JSON.stringify(result));
  } finally { await pool.end(); }
}
