import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("generic Railway scripts preserve platform-supplied APP_ENV", () => {
  for (const scriptName of [
    "start",
    "server",
    "server:with-migrate",
    "railway:build",
    "railway:start",
    "db:generate",
    "db:deploy",
  ]) {
    assert.doesNotMatch(manifest.scripts[scriptName], /APP_ENV\s*=/, scriptName);
  }
  assert.equal(manifest.scripts.start, "pnpm run server:with-migrate");
  assert.match(manifest.scripts["server:with-migrate"], /db:deploy/);
});

test("local development scripts remain explicitly development-scoped", () => {
  assert.match(manifest.scripts["dev:backend"], /APP_ENV=development/);
  assert.match(manifest.scripts["predeploy:local"], /db:generate:dev/);
  assert.match(manifest.scripts["predeploy:local"], /db:deploy:dev/);
});
