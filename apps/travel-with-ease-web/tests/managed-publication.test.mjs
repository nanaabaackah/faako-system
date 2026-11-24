import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("Git-triggered managed Pages builds cannot replace a CMS snapshot with repository content", () => {
  const script = fileURLToPath(new URL("../scripts/build-site.mjs", import.meta.url));
  for (const branch of ["main", "develop"]) {
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, CF_PAGES: "1", CF_PAGES_BRANCH: branch, TWE_HOLDING_PAGE: "false" },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must be published by the CMS publication worker/);
  }
});
