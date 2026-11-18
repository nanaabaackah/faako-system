import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("collections remain inside Content rather than becoming top-level portal modules", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const start=app.indexOf("const navigation =");
  const navigation = app.slice(start,app.indexOf("  return (",start));
  for (const id of ["packages", "journal", "travel-tips", "travel-footprint"]) assert.doesNotMatch(navigation, new RegExp(`\\["${id}",`));
  const editor = readFileSync(new URL("../src/components/WebsiteContent.jsx", import.meta.url), "utf8");
  for (const id of ["packages", "journal", "travel-tips", "travel-footprint"]) assert.ok(editor.includes(`"${id}"`));
});

test("CMS exposes cancellation only for stale pending publications, without retrying cancelled history", () => {
  const editor = readFileSync(new URL("../src/components/WebsiteContent.jsx", import.meta.url), "utf8");
  assert.match(editor, /job\.status==='pending' && canPublish/);
  assert.match(editor, /30 \* 60 \* 1000/);
  assert.match(editor, /Cancel stale publication/);
  assert.match(editor, /publication-jobs\/\$\{job\.id\}\/cancel/);
  assert.match(editor, /X-CSRF-Token/);
  assert.match(editor, /job\.last_error!=='cancelled_by_operator'/);
  assert.match(editor, /Pending publication cancelled\. Your saved drafts are unchanged/);
});
