import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production demo route redirects without publishing sample offers or forms", async () => {
  const html = await readFile(new URL("../dist/demo/index.html", import.meta.url), "utf8");
  assert.match(html, /http-equiv="refresh"/);
  assert.doesNotMatch(html, /demo-enquiry|A slower rhythm in Zanzibar|data-analytics-config/);
});
