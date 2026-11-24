import { createLogger } from "@faako/logger";
import { createDatabase } from "../src/db/database.js";
import { readDeployConfig } from "../src/db/deploy-config.js";
import { migrate } from "../src/db/migrations.js";
import { verifyHostedDatabase } from "../src/portal/readiness.js";
import { classifyPredeployFailure } from "../src/db/predeploy-diagnostics.js";
import { DatabaseConfigurationError } from "../src/db/configuration-error.js";
import { inspectMigrationState } from "../src/db/migration-preflight.js";

const logger = createLogger("travel-with-ease-api", { component: "predeploy" });
let migrationPool;
let runtimePool;
let phase = "configuration";
try {
  // Intentionally do not load local .env files in the deployment hook.
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--check-only")) throw new Error("Unknown database deployment option.");
  const checkOnly = args[0] === "--check-only";
  const options = readDeployConfig(process.env);
  phase = "migration_connection";
  migrationPool = createDatabase(process.env, "TWE_MIGRATION_DATABASE_URL", logger);
  await migrationPool.query("SELECT 1");
  phase = "migration_role";
  const migrationRole = await migrationPool.query("SELECT rolcanlogin FROM pg_roles WHERE rolname = current_user");
  if (migrationRole.rows.length !== 1 || migrationRole.rows[0].rolcanlogin !== true)
    throw new DatabaseConfigurationError("migration_role_unsafe");
  phase = "migration_preflight";
  const preflight = await inspectMigrationState(migrationPool, options);
  logger.info({ eventName: "migration.preflight_verified", ...preflight }, "Read-only migration preflight completed");
  phase = "runtime_connection";
  runtimePool = createDatabase(process.env, "DATABASE_URL", logger);
  await runtimePool.query("SELECT 1");
  if (checkOnly) {
    logger.info({ eventName: "migration.check_only_completed" }, "Database preflight completed; no migrations or grants executed");
  } else {
    phase = "migrations";
    const applied = await migrate(migrationPool, options);
    logger.info({ eventName: "migration.completed", applied }, "Reviewed migrations completed; checking runtime readiness");
    phase = "runtime_readiness";
    await verifyHostedDatabase(runtimePool, options);
    // Prove the runtime can read operational tables without changing any data.
    for (const table of ["staff_users", "staff_sessions", "enquiries", "content_items", "notification_outbox", "staff_invitation_deliveries", "audit_records"]) {
      await runtimePool.query(`SELECT 1 FROM twe.${table} LIMIT 0`);
    }
    logger.info({ eventName: "migration.runtime_verified" }, "Database pre-deployment completed");
  }
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
