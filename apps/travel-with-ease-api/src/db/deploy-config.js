import { databaseOptions } from "./database.js";
import { DatabaseConfigurationError } from "./configuration-error.js";

export function readDeployConfig(env) {
  const environment = env.APP_ENV;
  if (!["staging", "production"].includes(environment) || env.NODE_ENV !== "production") throw new DatabaseConfigurationError("hosted_environment_invalid");
  if (env.TWE_MIGRATION_APPROVED_ENV !== environment) throw new DatabaseConfigurationError("migration_approval_mismatch");
  if (![undefined, "", "false", "true"].includes(env.TWE_DB_INITIALISE)) throw new DatabaseConfigurationError("initialise_invalid");
  const organisationId = env.TWE_ORGANISATION_ID;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organisationId || "")) throw new DatabaseConfigurationError("organisation_id_invalid");
  const runtime = new URL(databaseOptions(env).connectionString);
  const migrator = new URL(databaseOptions(env, "TWE_MIGRATION_DATABASE_URL").connectionString);
  if (runtime.hostname !== migrator.hostname || (runtime.port || "5432") !== (migrator.port || "5432") || runtime.pathname !== migrator.pathname) throw new DatabaseConfigurationError("database_endpoint_mismatch");
  let runtimeRole;
  let migrationRole;
  try {
    runtimeRole = decodeURIComponent(runtime.username);
    migrationRole = decodeURIComponent(migrator.username);
  } catch {
    throw new DatabaseConfigurationError("database_username_invalid");
  }
  if (!runtimeRole || !migrationRole || runtimeRole === migrationRole) throw new DatabaseConfigurationError("database_roles_not_separate");
  const initialise = env.TWE_DB_INITIALISE === "true";
  const organisationName = initialise ? env.TWE_ORGANISATION_NAME?.trim() : undefined;
  if (initialise && (!organisationName || organisationName.length > 160)) throw new DatabaseConfigurationError("organisation_name_invalid");
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole)) throw new DatabaseConfigurationError("runtime_role_invalid");
  return { environment, organisationId, initialise, organisationName, runtimeRole };
}
