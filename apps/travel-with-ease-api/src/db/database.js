import pg from "pg";
import { validateEnvironment } from "../config.js";

export function databaseOptions(env = process.env, variable = "DATABASE_URL") {
  const environment = validateEnvironment(env.APP_ENV || "development", env.NODE_ENV);
  let url;
  try { url = new URL(env[variable]); } catch { throw new Error(`${variable} must be a PostgreSQL URL.`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error(`${variable} must identify a PostgreSQL database.`);
  }
  // Connection-string SSL parameters override pg's ssl object. Reject them so
  // certificate verification cannot be silently disabled by a copied URL.
  if (url.search || url.hash) throw new Error(`${variable} must not contain query parameters or a fragment.`);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const ssl = env.TWE_DATABASE_TLS !== "disable";
  if (!ssl && (!local || !["development", "test"].includes(environment))) {
    throw new Error("Disabling database TLS is allowed only for local development/test databases.");
  }
  return {
    connectionString: url.href,
    ssl: ssl ? { rejectUnauthorized: true, ...(env.TWE_DATABASE_CA ? { ca: env.TWE_DATABASE_CA } : {}) } : false,
    max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000,
    statement_timeout: 15_000, application_name: `twe-${environment}`,
  };
}

export function createDatabase(env = process.env, variable = "DATABASE_URL", logger) {
  const pool = new pg.Pool(databaseOptions(env, variable));
  pool.on("error", () => logger?.error({ eventName: "database.pool_error" }, "Database connection failed"));
  return pool;
}

export async function transaction(pool, operation) {
  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (rollbackError) { releaseError = rollbackError; }
    throw error;
  } finally {
    client.release(releaseError);
  }
}

export async function verifyDatabaseIdentity(client, { environment, organisationId }) {
  const { rows } = await client.query("SELECT environment, organisation_id FROM twe.environment_identity WHERE singleton = true");
  if (rows.length !== 1 || rows[0].environment !== environment || rows[0].organisation_id !== organisationId) {
    throw new Error("Database environment or organisation does not match this application.");
  }
}
