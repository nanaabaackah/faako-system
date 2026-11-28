// Explicit operator migration. Never part of Railway's enquiry pre-deploy command.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

export async function deployMediaSchema(pool, raw) {
  const file = raw || await readFile(new URL("../migrations/003-drive-r2-media.sql", import.meta.url), "utf8");
  const match = file.match(/^(?:\s*--[^\n]*\n)*\s*BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/i);
  if (!match || !match[1].includes("CREATE TABLE ttngh_media.assets") ||
      !match[1].includes("CREATE TABLE ttngh_media.schema_migrations"))
    throw new Error("TTNGH media migration inventory invalid");
  const checksum = createHash("sha256").update(file).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(821026003)");
    const existing = await client.query(
      "SELECT to_regclass('ttngh_media.assets') AS assets, to_regclass('ttngh_media.schema_migrations') AS ledger"
    );
    const { assets, ledger } = existing.rows[0];
    if (Boolean(assets) !== Boolean(ledger)) throw new Error("TTNGH media schema incomplete");
    let applied = false;
    if (ledger) {
      const history = await client.query("SELECT name,checksum FROM ttngh_media.schema_migrations ORDER BY name");
      if (history.rows.length !== 1 || history.rows[0].name !== "003-drive-r2-media.sql" ||
          history.rows[0].checksum.trim() !== checksum) throw new Error("TTNGH media migration history mismatch");
    } else {
      await client.query(match[1]);
      await client.query("INSERT INTO ttngh_media.schema_migrations(name,checksum) VALUES ($1,$2)",
        ["003-drive-r2-media.sql", checksum]);
      applied = true;
    }
    await client.query("SELECT id FROM ttngh_media.assets LIMIT 0");
    await client.query("COMMIT");
    return { applied };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("TTNGH media migration could not complete safely");
  } finally {
    client.release();
  }
}
