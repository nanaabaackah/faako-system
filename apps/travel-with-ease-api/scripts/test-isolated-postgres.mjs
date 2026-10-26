import { spawn } from "node:child_process";
import { mkdtemp, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";

// Owns only a fresh temporary cluster. Never reads application .env files or
// accepts a database URL, and never resets/deletes an existing database.
const bin = process.env.TWE_TEST_PG_BIN;
if (!bin || !path.isAbsolute(bin)) throw new Error("Set TWE_TEST_PG_BIN to an absolute PostgreSQL 17 bin directory.");
const cwd = new URL("../", import.meta.url);
const run = (name, args, { capture = false, env = {} } = {}) => new Promise((resolve, reject) => {
  const executable = name === "node" ? process.execPath : path.join(bin, name);
  const child = spawn(executable, args, {
    cwd, shell: false, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { PATH: process.env.PATH, LANG: "C", LC_ALL: "C", ...env },
  });
  let output = "";
  child.stdout?.on("data", (data) => { output += data; });
  child.stderr?.on("data", (data) => { output += data; });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`${name} failed (${code}). ${capture ? output : "See test output."}`)));
});
const version = await run("postgres", ["--version"], { capture: true });
assert.match(version, /PostgreSQL\) 17\./, "This drill requires PostgreSQL 17.");
const directory = await mkdtemp(path.join(tmpdir(), "twe-isolated-pg17-"));
await chmod(directory, 0o700);
const data = path.join(directory, "data");
const socket = net.createServer();
socket.listen(0, "127.0.0.1"); await once(socket, "listening");
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const connection = (database) => ({ host: "127.0.0.1", port, user: "twe_test", database, connectionTimeoutMillis: 5000 });
const args = ["-h", "127.0.0.1", "-p", String(port), "-U", "twe_test"];
const fingerprint = async (database) => {
  const client = new pg.Client(connection(database));
  await client.connect();
  try {
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'twe' ORDER BY tablename")).rows;
    const hash = createHash("sha256"); let count = 0;
    for (const { tablename } of tables) {
      assert.match(tablename, /^[a-z_]+$/);
      const result = await client.query(`SELECT to_jsonb(t) AS row FROM twe."${tablename}" t ORDER BY to_jsonb(t)::text`);
      hash.update(JSON.stringify([tablename, result.rows])); count += result.rowCount;
    }
    return { tables: tables.length, rows: count, sha256: hash.digest("hex") };
  } finally { await client.end(); }
};
let started = false;
try {
  await run("initdb", ["-D", data, "-U", "twe_test", "--auth=trust", "--encoding=UTF8", "--no-locale"], { capture: true });
  await run("pg_ctl", ["-D", data, "-l", path.join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"], { capture: true });
  started = true;
  await run("createdb", [...args, "twe_test_foundation"], { capture: true });
  await run("node", ["--test", "test/integration/postgres.test.js"], { env: {
    APP_ENV: "test", TWE_TEST_DATABASE_URL: `postgresql://twe_test@127.0.0.1:${port}/twe_test_foundation`,
  } });
  const before = await fingerprint("twe_test_foundation");
  // Restart must redirect the new server's output too. Otherwise PostgreSQL
  // inherits the captured pipe and keeps it open after pg_ctl exits.
  await run("pg_ctl", ["-D", data, "-l", path.join(directory, "server.log"), "-m", "fast", "-w", "restart"], { capture: true });
  assert.deepEqual(await fingerprint("twe_test_foundation"), before, "All TWE records must survive database restart.");
  const archive = path.join(directory, "synthetic-backup.dump");
  await run("pg_dump", [...args, "--format=custom", "--no-owner", "--no-acl", "--file", archive, "twe_test_foundation"], { capture: true });
  await chmod(archive, 0o600);
  await run("createdb", [...args, "twe_test_restored"], { capture: true });
  await run("pg_restore", [...args, "--exit-on-error", "--no-owner", "--no-acl", "--dbname", "twe_test_restored", archive], { capture: true });
  assert.deepEqual(await fingerprint("twe_test_restored"), before, "Restored tables and every row must match the source.");
  console.log(JSON.stringify({ result: "passed", version, restartPersistence: true, logicalRestore: true, ...before, evidenceDirectory: directory }));
} finally {
  if (started) await run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { capture: true });
  console.log(`Synthetic cluster and backup retained privately at ${directory}; no existing database was modified.`);
}
