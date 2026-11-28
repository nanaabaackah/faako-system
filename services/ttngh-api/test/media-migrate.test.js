import test from "node:test";
import assert from "node:assert/strict";
import { deployMediaSchema } from "../scripts/media-migrate.mjs";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../migrations/003-drive-r2-media.sql", import.meta.url), "utf8");
function database({ exists = false, checksum = "" } = {}) {
  const state = { exists, checksum, applied: 0 };
  const pool = { async connect() { return {
    async query(sql, params) {
      if (sql.startsWith("SELECT to_regclass")) return { rows: [{ assets: state.exists ? "ttngh_media.assets" : null, ledger: state.exists ? "ttngh_media.schema_migrations" : null }] };
      if (sql.startsWith("SELECT name,checksum")) return { rows: [{ name: "003-drive-r2-media.sql", checksum: state.checksum }] };
      if (sql.includes("CREATE TABLE ttngh_media.assets")) { state.exists = true; return {rows:[]} }
      if (sql.startsWith("INSERT INTO ttngh_media.schema_migrations")) { state.checksum=params[1];state.applied++; }
      return { rows: [] };
    },
    release() {},
  }}};
  return { pool, state };
}
test("media schema is applied separately without touching the existing enquiry ledger", async () => {
  const db=database();
  assert.deepEqual(await deployMediaSchema(db.pool,migration),{applied:true});
  assert.equal(db.state.applied,1);
  assert.deepEqual(await deployMediaSchema(db.pool,migration),{applied:false});
  assert.equal(db.state.applied,1);
});
test("modified media migration and invalid inventory are refused safely", async () => {
  const db=database({exists:true,checksum:"0".repeat(64)});
  await assert.rejects(deployMediaSchema(db.pool,migration),/safely/);
  await assert.rejects(deployMediaSchema(database().pool,"BEGIN; DROP TABLE x; COMMIT;"),/inventory invalid/);
});
test("existing production API pre-deploy does not run the media migration", () => {
  const config=JSON.parse(readFileSync(new URL("../railway.json", import.meta.url)));
  assert.deepEqual(config.deploy.preDeployCommand,["pnpm --filter @faako/ttngh-api db:deploy"]);
  const ordinary=readFileSync(new URL("../src/db/migrations.js",import.meta.url),"utf8");
  assert.doesNotMatch(ordinary,/003-drive-r2-media/);
});
