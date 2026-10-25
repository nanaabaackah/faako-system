import { readConfig } from "../config.js";
import { readAccessConfig } from "../auth/access-config.js";
import { verifyDatabaseIdentity } from "../db/database.js";
import { readMigrations } from "../db/migrations.js";

export class ReadinessError extends Error {
  constructor(code, message) { super(message); this.name = "ReadinessError"; this.code = code; }
}

export const readinessFailureCode = (error) => error instanceof ReadinessError ? error.code : "database_unavailable";

// Read-only operator preflight, not a startup bypass or a substitute for live MFA QA.
export function readHostedPrerequisites(env) {
  const config = readConfig(env);
  if (!config.deployed || !["staging", "production"].includes(env.APP_ENV) || env.NODE_ENV !== "production") throw new ReadinessError("environment_invalid", "Hosted preflight requires explicit APP_ENV=staging/production and NODE_ENV=production.");
  const access = readAccessConfig(env);
  if (!access || !config.allowedOrigins.includes(access.portalOrigin)) throw new ReadinessError("access_origin_invalid", "Hosted preflight requires Access and its exact portal origin.");
  if (!/^[a-f0-9-]{36}$/i.test(env.TWE_ORGANISATION_ID || "")) throw new ReadinessError("organisation_missing", "Hosted preflight requires an organisation ID.");
  // Release provenance is enforced by PublicationRepository when publishing,
  // not by unrelated health, enquiry or staff-session startup.
  if (env.TWE_AGENT_API_TOKEN || env.TWE_LOCAL_DATA_FILE) throw new ReadinessError("local_adapter_forbidden", "Hosted preflight forbids local authentication/storage settings.");
  return { environment: config.environment, organisationId: env.TWE_ORGANISATION_ID };
}

export async function verifyHostedDatabase(pool, identity, migrations) {
  const expected = migrations || await readMigrations();
  await verifyDatabaseIdentity(pool, identity);
  const version = await pool.query("SHOW server_version_num");
  if (Math.floor(Number(version.rows[0]?.server_version_num) / 10000) !== 17) throw new ReadinessError("database_version_invalid", "Hosted database must use PostgreSQL 17.");
  const role = await pool.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
  if (role.rows.length !== 1 || role.rows[0].rolsuper || role.rows[0].rolbypassrls) throw new ReadinessError("database_role_unsafe", "Use a non-superuser runtime database role without BYPASSRLS.");
  const applied = await pool.query("SELECT name, checksum FROM twe.schema_migrations ORDER BY name");
  if (applied.rows.length !== expected.length || expected.some((file, index) => applied.rows[index]?.name !== file.name || applied.rows[index]?.checksum !== file.checksum)) {
    throw new ReadinessError("migration_inventory_mismatch", "Hosted migration inventory does not match the reviewed code.");
  }
  const org = await pool.query("SELECT id FROM twe.organisations WHERE id = $1", [identity.organisationId]);
  if (org.rows.length !== 1) throw new ReadinessError("organisation_not_provisioned", "Hosted organisation is not provisioned.");
  return { databaseMajor: 17, migrations: expected.length, identityVerified: true };
}
