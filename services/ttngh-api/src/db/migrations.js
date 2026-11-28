import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Approved for automatic deployment: contact enquiries only. The existing
// 001-donations.sql foundation requires separate approval and remains manual.
export const approvedMigrationFiles = Object.freeze(["002-enquiries.sql", "003-drive-r2-media.sql"]);

export class MigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "MigrationError";
    this.code = code;
  }
}

export function unwrapMigrationSql(sql) {
  const match = sql.match(/^(?:\s*--[^\n]*\n)*\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/i);
  if (!match || !match[1].trim()) throw new MigrationError("migration_format_invalid");
  // The file's outer BEGIN/COMMIT cannot run inside the ledger transaction:
  // doing so would commit before the migration was recorded.
  return match[1].trim();
}

export async function readApprovedMigrations() {
  return Promise.all(approvedMigrationFiles.map(async (name) => {
    const sql = await readFile(new URL("../../migrations/" + name, import.meta.url), "utf8");
    return {
      name,
      sql: unwrapMigrationSql(sql),
      checksum: createHash("sha256").update(sql).digest("hex")
    };
  }));
}

export async function deployMigrations(pool, migrations) {
  const approved = migrations || await readApprovedMigrations();
  if (approved.length !== approvedMigrationFiles.length ||
      approved.some((item, i) => item.name !== approvedMigrationFiles[i] ||
        !/^[a-f0-9]{64}$/.test(item.checksum))) {
    throw new MigrationError("migration_inventory_invalid");
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    // Bound wait time even if another deployment is already migrating.
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    // Serialises deployment attempts from multiple Railway releases.
    await client.query("SELECT pg_advisory_xact_lock(821026002)");
    await client.query("CREATE SCHEMA IF NOT EXISTS ttngh_contact");
    await client.query(
      "CREATE TABLE IF NOT EXISTS ttngh_contact.schema_migrations (" +
      "name text PRIMARY KEY, checksum char(64) NOT NULL, " +
      "applied_at timestamptz NOT NULL DEFAULT now())"
    );
    const history = await client.query(
      "SELECT name, checksum FROM ttngh_contact.schema_migrations ORDER BY name"
    );
    const known = new Map(approved.map((item) => [item.name, item]));
    for (const row of history.rows) {
      const migration = known.get(row.name);
      if (!migration) throw new MigrationError("migration_history_unknown");
      if (migration.checksum !== row.checksum.trim()) {
        throw new MigrationError("migration_checksum_mismatch");
      }
    }

    const applied = new Set(history.rows.map((row) => row.name));
    const executed = [];
    for (const migration of approved) {
      if (applied.has(migration.name)) continue;
      const names = migration.name === "002-enquiries.sql"
        ? ["ttngh_contact.enquiries", "ttngh_contact.notification_outbox"]
        : ["ttngh_media.assets"];
      // Fail closed if a schema exists without its exact recorded migration.
      const existing = await client.query("SELECT to_regclass($1) AS first, to_regclass($2) AS second",
        [names[0], names[1] || names[0]]);
      if (existing.rows[0]?.first || existing.rows[0]?.second)
        throw new MigrationError("migration_untracked_schema");
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO ttngh_contact.schema_migrations (name, checksum) VALUES ($1, $2)",
        [migration.name, migration.checksum]
      );
      executed.push(migration.name);
    }

    // Both relations must also be readable using the Railway API's own role.
    await client.query("SELECT id FROM ttngh_contact.enquiries LIMIT 0");
    await client.query("SELECT id FROM ttngh_contact.notification_outbox LIMIT 0");
    await client.query("SELECT id FROM ttngh_media.assets LIMIT 0");
    await client.query("COMMIT");
    transactionOpen = false;
    return executed;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
