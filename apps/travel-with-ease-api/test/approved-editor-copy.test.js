import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedEditorCopy } from "../../travel-with-ease-portal/src/approved-copy.js";
import { contentForPage } from "../src/content/schema.js";

test("every approved public section loads as a strict CMS draft without asset URLs or invented copy", () => {
  const release = JSON.parse(readFileSync(new URL("../../travel-with-ease-web/content/approved-public-release.json", import.meta.url)));
  for (const [slug, body] of Object.entries(release.pages)) {
    if (!body) continue;
    const draft = contentForPage(slug, approvedEditorCopy(body));
    assert.equal(draft.heading, body.heading);
    assert.equal(draft.body, body.body);
    assert.equal(Object.hasOwn(draft, "image"), false);
    for (const collection of ["packages", "articles", "tips"]) {
      for (const record of draft[collection]) assert.equal(Object.hasOwn(record, "image"), false);
    }
  }
});
