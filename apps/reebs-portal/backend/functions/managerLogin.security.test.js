import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("manager login rate-limits before password verification", async () => {
  const source = await readFile(new URL("./managerLogin.js", import.meta.url), "utf8");
  const limiterIndex = source.indexOf("await applyWindowRateLimit");
  const passwordIndex = source.indexOf("await verifyPassword");

  assert.notEqual(limiterIndex, -1);
  assert.notEqual(passwordIndex, -1);
  assert.ok(limiterIndex < passwordIndex, "PIN verification must run after the request limiter");
});
