import pg from "pg";
import { deployMigrations } from "../src/db/migrations.js";

function safeReason(error) {
  if (typeof error?.code === "string" &&
      /^(migration_[a-z_]+)$/.test(error.code)) return error.code;
  const codes = {
    "42P01": "relation_missing",
    "42501": "database_permission_denied",
    "28P01": "database_auth_failed",
    "3D000": "database_missing",
    "ECONNREFUSED": "database_connection_refused",
    "ETIMEDOUT": "database_connection_timeout",
    "ENOTFOUND": "database_host_not_found",
    "55P03": "migration_lock_timeout"
  };
  return codes[error?.code] || "database_migration_failed";
}

let pool;
try {
  // No local .env loading in hosted pre-deploy; use the existing private
  // DATABASE_URL from TTNGH's Railway API service.
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw Object.assign(new Error(), { code: "migration_database_url_missing" });
  let target;
  try { target = new URL(connectionString); }
  catch { throw Object.assign(new Error(), { code: "migration_database_url_invalid" }); }
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      !target.hostname || !target.pathname || target.pathname === "/") {
    throw Object.assign(new Error(), { code: "migration_database_url_invalid" });
  }
  pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  });
  const applied = await deployMigrations(pool);
  console.info("TTNGH database pre-deploy completed; newly applied migrations:", applied.length);
} catch (error) {
  // Do not print raw PostgreSQL errors: they may contain database hostnames,
  // SQL statements, usernames or connection parameters.
  console.error("TTNGH database pre-deploy failed:", safeReason(error));
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
