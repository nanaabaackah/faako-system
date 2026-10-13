import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { transaction, verifyDatabaseIdentity } from "./database.js";
import { validateEnvironment } from "../config.js";

export const migrationDirectory = new URL("../../db/migrations/", import.meta.url);

export async function readMigrations(directory = migrationDirectory) {
  const names = (await readdir(directory)).filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error("No migrations found.");
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(new URL(name, directory), "utf8");
    return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
}

export async function migrate(pool, { environment, organisationId, initialise = false, migrations }) {
  validateEnvironment(environment);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organisationId || "")) throw new Error("TWE_ORGANISATION_ID must be a UUID.");
  const files = migrations || await readMigrations();
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(740031)");
    const existing = await client.query("SELECT to_regnamespace('twe') AS schema");
    if (!existing.rows[0].schema) {
      if (!initialise) throw new Error("Fresh database requires explicit --initialise confirmation.");
      await client.query("CREATE SCHEMA twe");
      await client.query("CREATE TABLE twe.environment_identity (singleton BOOLEAN PRIMARY KEY CHECK (singleton), environment TEXT NOT NULL, organisation_id UUID NOT NULL)");
      await client.query("INSERT INTO twe.environment_identity VALUES (true, $1, $2)", [environment, organisationId]);
      await client.query("CREATE TABLE twe.schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    }
    await verifyDatabaseIdentity(client, { environment, organisationId });
    const { rows } = await client.query("SELECT name, checksum FROM twe.schema_migrations ORDER BY name");
    for (const applied of rows) {
      if (files.find((file) => file.name === applied.name)?.checksum !== applied.checksum) throw new Error("Migration history differs from this checkout; refusing to continue.");
    }
    const pending = files.filter((file) => !rows.some((applied) => applied.name === file.name));
    if (pending.some((file) => rows.some((applied) => applied.name > file.name))) throw new Error("Out-of-order migrations are not allowed.");
    for (const file of pending) {
      await client.query(file.sql);
      await client.query("INSERT INTO twe.schema_migrations (name, checksum) VALUES ($1, $2)", [file.name, file.checksum]);
    }
    return pending.map((file) => file.name);
  });
}
