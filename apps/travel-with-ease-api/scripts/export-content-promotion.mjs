import { writeFile } from "node:fs/promises";
import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { PublicationRepository } from "../src/content/publication.js";
import { exportPromotionBundle } from "../src/content/promotion.js";
import { MediaService } from "../src/media/service.js";
import { readR2Config, R2Store } from "../src/media/r2.js";
import approved from "../../travel-with-ease-web/content/approved-public-release.json" with { type: "json" };

if (process.env.APP_ENV !== "staging" || process.env.NODE_ENV !== "production")
  throw new Error("Promotion export is staging-only.");
const output = process.argv[2];
if (!output || !output.endsWith(".json")) throw new Error("Choose a local .json output path.");
const organisationId = process.env.TWE_ORGANISATION_ID;
const pool = createDatabase();
try {
  await verifyDatabaseIdentity(pool, { environment: "staging", organisationId });
  const storage = readR2Config();
  if (!storage) throw new Error("Staging R2 is required for promotion export.");
  const media = new MediaService(pool, organisationId, new R2Store(storage));
  const publication = new PublicationRepository(pool, { organisationId, environment: "staging", sourceSha: "" });
  const bundle = await exportPromotionBundle({ publication, media, approvedPages: approved.pages,
    source: { organisationId } });
  await writeFile(output, JSON.stringify(bundle), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "exported", sourcePublicationId: bundle.source.publicationId,
    contentFingerprint: bundle.source.contentFingerprint }));
} finally { await pool.end(); }
