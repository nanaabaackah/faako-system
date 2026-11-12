import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { createLogger } from "@faako/logger";
import { PublicationRepository } from "../src/content/publication.js";
import { PagesProvider, readPagesConfiguration } from "../src/content/pages-provider.js";
import { publishOne } from "../src/content/publication-worker.js";
import { MediaService } from "../src/media/service.js";
import { readR2Config, R2Store } from "../src/media/r2.js";
import { ArtifactArchive } from "../src/content/artifact-archive.js";
import { verifyHostedDatabase } from "../src/portal/readiness.js";

const settings = readPagesConfiguration();
const logger = createLogger("twe-publication-worker", { environment: settings.environment });
const pool = createDatabase();
try {
  const organisationId = process.env.TWE_ORGANISATION_ID;
  await verifyDatabaseIdentity(pool, { environment: settings.environment, organisationId });
  await verifyHostedDatabase(pool, { environment: settings.environment, organisationId });
  const storage = readR2Config();
  const store = storage ? new R2Store(storage) : null;
  const result = await publishOne({
    publication: new PublicationRepository(pool, { organisationId, environment: settings.environment, sourceSha: settings.sourceSha }),
    media: new MediaService(pool, organisationId, store),
    archive: store ? new ArtifactArchive(store, { organisationId, environment: settings.environment }) : null,
    provider: new PagesProvider(settings),
    settings: { ...settings, apiOrigin: process.env.TWE_PUBLIC_API_ORIGIN || "",
      turnstileSiteKey: process.env.TWE_PUBLIC_TURNSTILE_SITE_KEY || "", indexable: process.env.TWE_PUBLIC_SITE_INDEXABLE === "true",
      googleVerification: process.env.TWE_PUBLIC_GOOGLE_SITE_VERIFICATION || "" },
    logger,
  });
  logger.info({ eventName: "publication.worker_completed", status: result.status, jobId: result.id }, "Publication worker completed.");
  if (result.status === "failed") process.exitCode = 1;
} catch {
  logger.error({ eventName: "publication.worker_failed" }, "Publication worker needs configuration or recovery review.");
  process.exitCode = 1;
} finally { await pool.end(); }
