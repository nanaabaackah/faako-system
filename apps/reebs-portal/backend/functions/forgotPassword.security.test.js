import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("forgot password rate-limits before account lookup and reset creation", async () => {
  const source = await readFile(new URL("./forgotPassword.js", import.meta.url), "utf8");
  const limiterIndex = source.indexOf("await applyWindowRateLimit");
  const lookupIndex = source.indexOf("const result = isUsernameOnly");
  const tokenIndex = source.indexOf("await createPasswordResetToken");

  assert.notEqual(limiterIndex, -1);
  assert.notEqual(lookupIndex, -1);
  assert.notEqual(tokenIndex, -1);
  assert.ok(limiterIndex < lookupIndex, "account lookup must run after the request limiter");
  assert.ok(limiterIndex < tokenIndex, "reset token creation must run after the request limiter");
});
