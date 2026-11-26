import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packages = ["api", "portal", "web"].map(name =>
  JSON.parse(readFileSync(new URL(`../../travel-with-ease-${name}/package.json`, import.meta.url), "utf8"))
);
test("TWE product manifests share a valid release version", () => {
  const version = packages[0].version;
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.[1-9]\d*)?$/);
  for (const manifest of packages) assert.equal(manifest.version, version);
});
