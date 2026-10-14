import test from "node:test";
import assert from "node:assert/strict";
import { isIndexable, productionOrigin } from "./src/lib/indexability.js";
import { articleSchema, eventSchema } from "./src/lib/page-schema.js";

test("only explicitly enabled production builds are indexable", () => {
  assert.equal(isIndexable(productionOrigin, "true"), true);
  assert.equal(isIndexable(productionOrigin, undefined), false);
  assert.equal(isIndexable(productionOrigin, "false"), false);
  assert.equal(isIndexable("https://preview.example.org", "true"), false);
  assert.equal(isIndexable("http://localhost:5177", "true"), false);
  assert.equal(isIndexable("invalid", "true"), false);
});

test("unapproved or incomplete publishing records do not emit schema", () => {
  assert.equal(articleSchema(), null);
  assert.equal(articleSchema({ title: "Draft", approved: true }), null);
  assert.equal(eventSchema(), null);
  assert.equal(eventSchema({ title: "Recurring programme", confirmed: true }), null);
});
