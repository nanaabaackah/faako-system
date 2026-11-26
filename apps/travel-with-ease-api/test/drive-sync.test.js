import test from "node:test";
import assert from "node:assert/strict";
import { createDriveScanner } from "../src/media/sync.js";

test("recursive automatic sync follows folders/pages, skips archived and imported revisions, requires description and bounds imports", async () => {
  const calls = [], imports = [];
  const item = (id, fields = {}) => ({ id, version: "1", syncEligible: true, ...fields });
  const service = {
    drive: { config: { folderId: "root" } },
    async listDrive(token, id) {
      calls.push([token, id]);
      if (id === "root" && !token) return { folders: [{ id: "child" }], items: [item("a"), item("b"), item("c"), item("d"), item("no-alt", { syncEligible: false }), item("old", { importedId: "asset" }), item("archived", { archived: true })], nextPageToken: "next" };
      if (id === "root") return { items: [item("e")], folders: [], nextPageToken: "" };
      return { items: [item("f")], folders: [{ id: "root" }], nextPageToken: "" };
    },
    async syncDrive(input) { imports.push(input); return { id: input.fileId }; },
  };
  let time = 0;
  const scanner = createDriveScanner(service, { now: () => time });
  await scanner.step();
  assert.equal(imports.length, 3);
  for (let i=0;i<4;i++) await scanner.step();
  assert.deepEqual(calls, [["","root"],["next","root"],["","child"]]);
  assert.deepEqual(imports.map(x => x.fileId), ["a","b","c","d","e","f"]);
  assert.equal(scanner.status().needsDescription, 1);
  assert.equal(scanner.status().imported, 6);
  assert.ok(scanner.status().lastScanAt);
  await scanner.step(); assert.equal(calls.length, 3);
  time += 3600001; await scanner.step(); assert.equal(calls.length, 4);
});

test("incomplete scan performs no imports from that page and does not claim success", async () => {
  let imports = 0;
  const scanner = createDriveScanner({
    drive: { config: { folderId: "root" } },
    async listDrive() { return { incomplete: true, items: [{id:"a",syncEligible:true}] }; },
    async syncDrive() { imports++; },
  });
  await scanner.step();
  assert.equal(imports, 0);
  assert.equal(scanner.status().lastScanAt, null);
  assert.equal(scanner.status().lastError, true);
});

test("rate-limited automatic import is retried rather than discarded", async () => {
  let attempts = 0;
  const scanner = createDriveScanner({
    drive: { config: { folderId: "root" } },
    async listDrive() { return { items: [{id:"a",version:"1",syncEligible:true}] }; },
    async syncDrive() { if (++attempts === 1) throw Object.assign(new Error(), {status:429}); return {id:"asset"}; },
  });
  await scanner.step(); assert.equal(scanner.status().imported,0);
  await scanner.step(); assert.equal(scanner.status().imported,1);
  assert.equal(attempts,2);
});
