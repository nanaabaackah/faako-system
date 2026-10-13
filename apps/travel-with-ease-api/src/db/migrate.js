import { createLogger } from "@faako/logger";
import { createDatabase } from "./database.js";
import { migrate, readMigrations } from "./migrations.js";

const logger = createLogger("travel-with-ease-api", { component: "migrations" });
let pool;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--plan", "--initialise", "--confirm-production"].includes(arg))) throw new Error("Unknown migration option.");
  const files = await readMigrations();
  if (args.includes("--plan")) {
    logger.info({ files: files.map(({ name, checksum }) => ({ name, checksum })) }, "Local migration inventory; database not contacted");
  } else {
    if (process.env.APP_ENV === "production" && !args.includes("--confirm-production")) throw new Error("Production migration requires explicit confirmation.");
    pool = createDatabase(process.env, "TWE_MIGRATION_DATABASE_URL", logger);
    const applied = await migrate(pool, { environment: process.env.APP_ENV || "development", organisationId: process.env.TWE_ORGANISATION_ID, initialise: args.includes("--initialise"), migrations: files });
    logger.info({ applied }, "Migration transaction completed");
  }
} catch {
  logger.error({ eventName: "migration.failed" }, "Migration failed. Check target identity, credentials, privileges and migration history; no reset was attempted.");
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
