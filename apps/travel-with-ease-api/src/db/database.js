import pg from "pg";
import { validateEnvironment } from "../config.js";
import { DatabaseConfigurationError } from "./configuration-error.js";

export function databaseOptions(env = process.env, variable = "DATABASE_URL") {
  const environment = validateEnvironment(env.APP_ENV || "development", env.NODE_ENV);
  const connectionKind = variable === "TWE_MIGRATION_DATABASE_URL" ? "migration" : "runtime";
  let url;
  try { url = new URL(env[variable]); } catch { throw new DatabaseConfigurationError(`${connectionKind}_url_invalid`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new DatabaseConfigurationError(`${connectionKind}_url_invalid`);
  }
  // pg connection-string SSL parameters override the explicit ssl object. A
  // Railway-provided sslmode=require is redundant but safe to consume and
  // remove; every other option remains forbidden.
  const parameters = [...url.searchParams.entries()];
  if (url.hash || parameters.some(([key, value]) => key !== "sslmode" || value !== "require"))
    throw new DatabaseConfigurationError(`${connectionKind}_url_options_forbidden`);
  url.search = "";
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (![undefined, "", "require", "disable"].includes(env.TWE_DATABASE_TLS))
    throw new DatabaseConfigurationError("database_tls_mode_invalid");
  const ssl = env.TWE_DATABASE_TLS !== "disable";
  if (!ssl && (!local || !["development", "test"].includes(environment))) {
    throw new DatabaseConfigurationError("database_tls_disabled");
  }
  const ca = env.TWE_DATABASE_CA?.trim();
  if (ca && (!ca.startsWith("-----BEGIN CERTIFICATE-----\n") || !ca.endsWith("\n-----END CERTIFICATE-----") || ca.includes("\\n")))
    throw new DatabaseConfigurationError("database_ca_invalid");
  return {
    connectionString: url.href,
    ssl: ssl ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : false,
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
