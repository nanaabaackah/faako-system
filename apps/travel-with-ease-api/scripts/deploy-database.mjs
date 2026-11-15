import { createLogger } from "@faako/logger";
import { createDatabase } from "../src/db/database.js";
import { readDeployConfig } from "../src/db/deploy-config.js";
import { migrate } from "../src/db/migrations.js";
import { verifyHostedDatabase } from "../src/portal/readiness.js";
import { classifyPredeployFailure } from "../src/db/predeploy-diagnostics.js";

const logger = createLogger("travel-with-ease-api", { component: "predeploy" });
let migrationPool;
let runtimePool;
let phase = "configuration";
try {
  // Intentionally do not load local .env files in the deployment hook.
  const options = readDeployConfig(process.env);
  migrationPool = createDatabase(process.env, "TWE_MIGRATION_DATABASE_URL", logger);
  phase = "migrations";
  const applied = await migrate(migrationPool, options);
  logger.info({ eventName: "migration.completed", applied }, "Reviewed migrations completed; checking runtime readiness");
  runtimePool = createDatabase(process.env, "DATABASE_URL", logger);
  phase = "runtime_readiness";
  await verifyHostedDatabase(runtimePool, options);
  // Prove the runtime can read operational tables without changing any data.
  for (const table of ["staff_users", "staff_sessions", "enquiries", "content_items", "notification_outbox", "staff_invitation_deliveries", "audit_records"]) {
    await runtimePool.query(`SELECT 1 FROM twe.${table} LIMIT 0`);
  }
  logger.info({ eventName: "migration.runtime_verified" }, "Database pre-deployment completed");
} catch (error) {
  // Log a fixed category and guidance only. Raw PostgreSQL errors can expose
  // private network addresses, users, certificate paths or SQL parameters.
  const diagnostic = classifyPredeployFailure(error);
  logger.error(
    { eventName: "migration.predeploy_failed", phase, reason: diagnostic.code },
    `Database pre-deployment failed during ${phase} (${diagnostic.code}). ${diagnostic.guidance} No database reset or retry attempted.`,
  );
  process.exitCode = 1;
} finally {
  await migrationPool?.end();
  await runtimePool?.end();
}
