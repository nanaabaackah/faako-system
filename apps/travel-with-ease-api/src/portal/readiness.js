import { readConfig } from "../config.js";
import { readAccessConfig } from "../auth/access-config.js";
import { verifyDatabaseIdentity } from "../db/database.js";
import { readMigrations } from "../db/migrations.js";

// Read-only operator preflight, not a startup bypass or a substitute for live MFA QA.
export function readHostedPrerequisites(env) {
  const config = readConfig(env);
  if (!config.deployed || env.NODE_ENV !== "production") throw new Error("Hosted preflight requires staging/production and NODE_ENV=production.");
  const access = readAccessConfig(env);
  if (!access || !config.allowedOrigins.includes(access.portalOrigin)) throw new Error("Hosted preflight requires Access and its exact portal origin.");
  if (!/^[a-f0-9-]{36}$/i.test(env.TWE_ORGANISATION_ID || "")) throw new Error("Hosted preflight requires an organisation ID.");
  if (!/^[a-f0-9]{40}$/i.test(env.TWE_RELEASE_SHA || "")) throw new Error("Hosted preflight requires the reviewed release SHA.");
  if (env.TWE_AGENT_API_TOKEN || env.TWE_LOCAL_DATA_FILE) throw new Error("Hosted preflight forbids local authentication/storage settings.");
  return { environment: config.environment, organisationId: env.TWE_ORGANISATION_ID };
}

export async function verifyHostedDatabase(pool, identity, migrations) {
  const expected = migrations || await readMigrations();
  await verifyDatabaseIdentity(pool, identity);
  const version = await pool.query("SHOW server_version_num");
  if (Math.floor(Number(version.rows[0]?.server_version_num) / 10000) !== 17) throw new Error("Hosted database must use PostgreSQL 17.");
  const role = await pool.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user");
  if (role.rows.length !== 1 || role.rows[0].rolsuper || role.rows[0].rolbypassrls) throw new Error("Use a non-superuser runtime database role without BYPASSRLS.");
  const applied = await pool.query("SELECT name, checksum FROM twe.schema_migrations ORDER BY name");
  if (applied.rows.length !== expected.length || expected.some((file, index) => applied.rows[index]?.name !== file.name || applied.rows[index]?.checksum !== file.checksum)) {
    throw new Error("Hosted migration inventory does not match the reviewed code.");
  }
  const org = await pool.query("SELECT id FROM twe.organisations WHERE id = $1", [identity.organisationId]);
  if (org.rows.length !== 1) throw new Error("Hosted organisation is not provisioned.");
  return { databaseMajor: 17, migrations: expected.length, identityVerified: true };
}
