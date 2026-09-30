import test from "node:test";
import assert from "node:assert/strict";
import { archiveSequentially } from "./bulkArchive.js";

test("partial archive reports successes and leaves failed/unattempted records without retries", async () => {
  const requested = [];
  const result = await archiveSequentially([{ id: 1 }, { id: 2 }, { id: 3 }], async (item) => {
    requested.push(item.id);
    if (item.id === 2) throw new Error("Archive denied");
    return { name: "Archived item" };
  });
  assert.deepEqual(requested, [1, 2]);
  assert.deepEqual(result.archived.map((item) => item.id), [1]);
  assert.deepEqual(result.remaining.map((item) => item.id), [2, 3]);
  assert.equal(result.error.message, "Archive denied");
});
test("successful bulk archive reports exact records once", async () => {
  const result = await archiveSequentially([{ id: 1 }, { id: 2 }], async () => ({}));
  assert.deepEqual(result.archived.map((item) => item.id), [1, 2]);
  assert.equal(result.error, null);
  assert.deepEqual(result.remaining, []);
});
