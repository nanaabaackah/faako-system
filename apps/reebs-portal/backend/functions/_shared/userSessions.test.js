import assert from "node:assert/strict";
import test from "node:test";
import { revokeUserSessionsForUser } from "./userSessions.js";

test("password changes can revoke other sessions while preserving the current session", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 2 };
    },
  };

  const revoked = await revokeUserSessionsForUser(client, 4, 9, {
    exceptSessionTokenId: "current-session",
  });

  assert.equal(revoked, 2);
  assert.match(calls[0].sql, /"sessionTokenId" <> \$3/);
  assert.deepEqual(calls[0].params, [4, 9, "current-session"]);
});

test("security-sensitive account changes still revoke every active session by default", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 3 };
    },
  };

  const revoked = await revokeUserSessionsForUser(client, 4, 9);

  assert.equal(revoked, 3);
  assert.doesNotMatch(calls[0].sql, /"sessionTokenId" <>/);
  assert.deepEqual(calls[0].params, [4, 9]);
});
