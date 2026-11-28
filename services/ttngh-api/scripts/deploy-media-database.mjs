// Manual, operator-authorized staging-first media migration. Not a Railway pre-deploy hook.
import pg from "pg";
import { deployMediaSchema } from "./media-migrate.mjs";
let pool;
try {
  if (process.env.TTNGH_MEDIA_MIGRATION_APPROVED !== "true")
    throw new Error("Media migration has not been approved");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !/^postgres(ql)?:\/\//.test(connectionString))
    throw new Error("Missing TTNGH database");
  pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  const result = await deployMediaSchema(pool);
  console.info("TTNGH media migration completed:", result.applied ? "applied" : "already current");
} catch {
  console.error("TTNGH media migration stopped safely; verify approval and database schema.");
  process.exitCode = 1;
} finally {
  if (pool) await pool.end().catch(() => {});
}
