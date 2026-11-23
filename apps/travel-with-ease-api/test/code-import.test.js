import test from "node:test";
import assert from "node:assert/strict";
import { importCodeAuthoredDraft, prepareCodeAuthoredContent } from "../src/content/code-import.js";

const body = { heading: "Imported", body: "Draft", seoTitle: "Imported", seoDescription: "Code-authored draft", entries: [{ heading: "Stable", text: "Entry" }] };

test("code-authored content receives stable record IDs and dry-run never writes", async () => {
  assert.equal(prepareCodeAuthoredContent("about", body).entries[0].id, prepareCodeAuthoredContent("about", body).entries[0].id);
  let writes = 0;
  const repository = { get: async () => null, save: async () => { writes += 1; } };
  assert.deepEqual(await importCodeAuthoredDraft({ repository, page: "about", body, expectedVersion: 0, actor: {}, dryRun: true }), { status: "would_create", expectedVersion: 0, actualVersion: 0 });
  assert.equal(writes, 0);
});

test("code-authored import detects conflicts and saves only an explicit draft", async () => {
  const repository = { get: async () => ({ version: 3, body: { ...body, body: "Client edit" } }), save: async (_page, _body, version) => ({ version: version + 1, revisionId: "revision" }) };
  assert.equal((await importCodeAuthoredDraft({ repository, page: "about", body, expectedVersion: 2, actor: {}, dryRun: false })).status, "conflict");
  const saved = await importCodeAuthoredDraft({ repository, page: "about", body, expectedVersion: 3, actor: {}, dryRun: false });
  assert.deepEqual(saved, { status: "saved_draft", version: 4, revisionId: "revision" });
});
