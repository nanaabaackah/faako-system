import { verifyDatabaseIdentity } from "./database.js";
import { pendingMigrations, readMigrations } from "./migrations.js";
import { verifyRuntimeRole } from "./runtime-grants.js";

// Never runs migration SQL, grants or schema creation. Use one consistent,
// read-only database snapshot; do not acquire the migration write lock here.
export async function inspectMigrationState(pool, options, files) {
  const reviewed = files || await readMigrations();
  const client = await pool.connect();
  let releaseError;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const existing = await client.query("SELECT to_regnamespace('twe') AS schema");
    const schemaExists = Boolean(existing.rows[0]?.schema);
    if (!schemaExists && !options.initialise)
      throw new Error("Fresh database requires explicit --initialise confirmation.");
    let applied = [];
    if (schemaExists) {
      await verifyDatabaseIdentity(client, options);
      const ledger = await client.query("SELECT name, checksum FROM twe.schema_migrations ORDER BY name");
      applied = ledger.rows;
    }
    const pending = pendingMigrations(reviewed, applied);
    if (options.runtimeRole) await verifyRuntimeRole(client, options.runtimeRole, { schemaExists });
    await client.query("COMMIT");
    return { schemaExists, applied: applied.length, pending: pending.map(file => file.name) };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (rollbackError) { releaseError = rollbackError; }
    throw error;
  } finally { client.release(releaseError); }
}
