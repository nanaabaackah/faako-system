// Operator-only CLI. No public HTTP media endpoints or automatic CMS publication.
import pg from "pg";
import { readDriveConfig, DriveReader } from "../src/media/drive.js";
import { readR2Config, R2Store } from "../src/media/r2.js";
import { MediaSync } from "../src/media/sync.js";

const [operation = "plan", ...args] = process.argv.slice(2);
const option = name => args.find(arg => arg.startsWith("--" + name + "="))?.slice(name.length + 3);
const hasFlag = name => args.includes("--" + name);
let pool;

try {
  if (!["plan","sync","status","list","approve","to-sanity"].includes(operation))
    throw new Error("Use plan, sync, status, list, approve or to-sanity");
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl))
    throw new Error("An approved TTNGH database is required");
  const needsDrive = ["plan","sync"].includes(operation);
  const needsR2 = operation === "to-sanity" || operation === "sync" && hasFlag("apply");
  const driveConfig = needsDrive ? readDriveConfig(process.env) : null;
  const r2Config = needsR2 ? readR2Config(process.env) : null;
  if (needsDrive && !driveConfig) throw new Error("TTNGH Drive credentials are not configured");
  if (needsR2 && !r2Config) throw new Error("TTNGH R2 storage is not configured");
  const apply = operation === "sync" && hasFlag("apply");
  if (apply && process.env.TTNGH_MEDIA_SYNC_ENABLED !== "true")
    throw new Error("TTNGH media sync apply is disabled");
  if (["approve","list"].includes(operation) && process.env.TTNGH_MEDIA_APPROVAL_ENABLED !== "true")
    throw new Error("TTNGH media approval is disabled");
  if (operation === "to-sanity" && process.env.TTNGH_MEDIA_SANITY_EXPORT_ENABLED !== "true")
    throw new Error("TTNGH media Sanity export is disabled");

  pool = new pg.Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5000 });
  const drive = driveConfig ? new DriveReader(driveConfig) : null;
  const r2 = r2Config ? new R2Store(r2Config) : null;
  const service = new MediaSync(pool, drive, r2);
  let result;
  if (["plan","sync"].includes(operation)) {
    // "sync" without --apply is deliberately equivalent to a read-only plan.
    result = await service.sync({ apply, maxFiles: Number(option("max-files") || 1000) });
  } else if (operation === "status") {
    result = await service.status();
  } else if (operation === "list") {
    result = await service.list({ status: option("status") || "imported", limit: Number(option("limit") || 50) });
  } else if (operation === "approve") {
    result = await service.approve(option("id"), { alt: option("alt"), rights: option("rights") });
  } else {
    result = await service.exportToSanity(option("id"), {
      project: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
      token: process.env.SANITY_ASSET_WRITE_TOKEN,
    });
  }
  // Never print access tokens, provider response bodies or Drive file paths.
  console.info(JSON.stringify(result));
  if (result?.failed) process.exitCode = 1;
} catch {
  console.error("TTNGH media operation failed. Check configured access, approved media and migration status.");
  process.exitCode = 1;
} finally {
  if (pool) await pool.end().catch(() => {});
}
