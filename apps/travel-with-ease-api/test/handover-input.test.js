import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("handover input helper refuses unattended and production execution without reading or echoing assertions", () => {
  const script = fileURLToPath(new URL("../scripts/handover-prompt.mjs", import.meta.url));
  for (const APP_ENV of ["staging", "production", "development"]) {
    const result = spawnSync(process.execPath, [script, "SYNTHETIC-APPROVAL"], {
      env: { APP_ENV, PATH: process.env.PATH },
      input: "synthetic-sensitive-input-must-not-echo",
      encoding: "utf8", timeout: 5000,
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-sensitive-input-must-not-echo|Reviewed handover completed/);
  }
  const source = readFileSync(script, "utf8");
  assert.match(source, /process\.stdin\.isTTY/);
  assert.match(source, /process\.env\.APP_ENV !== "staging"/);
  assert.match(source, /historySize: 0/);
  assert.match(source, /child\.stdin\.end\(JSON\.stringify\(\{ developerAssertion, clientAssertion \}\)\)/);
  assert.doesNotMatch(source, /console\.(?:log|info)\(developerAssertion|console\.(?:log|info)\(clientAssertion/);
});
