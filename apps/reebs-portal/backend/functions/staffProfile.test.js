import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidProfilePassword } from "./staffProfile.js";

test("profile password validation permits no change and enforces eight characters", () => {
  assert.equal(isValidProfilePassword(""), true);
  assert.equal(isValidProfilePassword("1234567"), false);
  assert.equal(isValidProfilePassword("12345678"), true);
});

test("profile writes keep user and employee profile changes in one transaction", () => {
  const source = readFileSync(new URL("./staffProfile.js", import.meta.url), "utf8");
  assert.match(source, /client\.query\("BEGIN"\)/);
  assert.match(source, /client\.query\("COMMIT"\)/);
  assert.match(source, /client\.query\("ROLLBACK"\)/);
  assert.match(source, /exceptSessionTokenId: authUser\.sessionTokenId/);
});
