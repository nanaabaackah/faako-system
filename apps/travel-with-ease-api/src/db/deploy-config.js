import { databaseOptions } from "./database.js";

export function readDeployConfig(env) {
  const environment = env.APP_ENV;
  if (!["staging", "production"].includes(environment) || env.NODE_ENV !== "production") throw new Error("Hosted migration requires explicit environment and production NODE_ENV.");
  if (env.TWE_MIGRATION_APPROVED_ENV !== environment) throw new Error("Migration approval must match the deployment environment.");
  if (![undefined, "", "false", "true"].includes(env.TWE_DB_INITIALISE)) throw new Error("Invalid initialisation setting.");
  const organisationId = env.TWE_ORGANISATION_ID;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organisationId || "")) throw new Error("A valid organisation UUID is required.");
  const runtime = new URL(databaseOptions(env).connectionString);
  const migrator = new URL(databaseOptions(env, "TWE_MIGRATION_DATABASE_URL").connectionString);
  if (runtime.hostname !== migrator.hostname || (runtime.port || "5432") !== (migrator.port || "5432") || runtime.pathname !== migrator.pathname) throw new Error("Runtime and migration connections must target the same database endpoint.");
  if (!runtime.username || !migrator.username || decodeURIComponent(runtime.username) === decodeURIComponent(migrator.username)) throw new Error("Separate runtime and migration database roles are required.");
  const initialise = env.TWE_DB_INITIALISE === "true";
  const organisationName = initialise ? env.TWE_ORGANISATION_NAME?.trim() : undefined;
  if (initialise && (!organisationName || organisationName.length > 160)) throw new Error("Initialisation requires the approved organisation name.");
  const runtimeRole = decodeURIComponent(runtime.username);
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole)) throw new Error("Runtime role must use a simple role name.");
  return { environment, organisationId, initialise, organisationName, runtimeRole };
}
