import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("built home contains canonical discovery metadata and estimator disclaimer", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /Estimated prices are provided as a guide/);
  assert.doesNotMatch(html, /TWE_AGENT_API_TOKEN|EXCHANGE_RATE_API_KEY/);
});
