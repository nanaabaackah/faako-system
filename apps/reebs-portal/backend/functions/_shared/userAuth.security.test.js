import assert from "node:assert/strict";
import test from "node:test";
import {
  getUserFromEvent,
  requireUser,
  signUserToken,
} from "./userAuth.js";

const withSecret = async (operation) => {
  const previous = process.env.USER_APP_SECRET;
  process.env.USER_APP_SECRET = "phase-5-user-auth-test-secret";
  try {
    await operation();
  } finally {
    if (previous === undefined) delete process.env.USER_APP_SECRET;
    else process.env.USER_APP_SECRET = previous;
  }
};

test("browser session selection is cookie-first when both transports are present", async () => {
  await withSecret(async () => {
    const cookieToken = signUserToken({ userId: 10, organizationId: 2, sessionTokenId: "cookie-session" });
    const bearerToken = signUserToken({ userId: 99, organizationId: 8, sessionTokenId: "bearer-session" });
    const payload = getUserFromEvent({
      headers: {
        cookie: `reebs_user_session=${encodeURIComponent(cookieToken)}`,
        authorization: `Bearer ${bearerToken}`,
      },
    });
    assert.equal(payload.userId, 10);
    assert.equal(payload.sessionTokenId, "cookie-session");
  });
});

test("historical bearer tokens without a revocable database session fail closed", async () => {
  await withSecret(async () => {
    const token = signUserToken({ userId: 10, organizationId: 2 });
    let queryCount = 0;
    const user = await requireUser({
      async query() {
        queryCount += 1;
        throw new Error("legacy bearer must not query a user-row fallback");
      },
    }, {
      httpMethod: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(user, null);
    assert.equal(queryCount, 0);
  });
});

test("cookie mutations fail closed without trusted browser origin evidence", async () => {
  await withSecret(async () => {
    const token = signUserToken({ userId: 10, organizationId: 2, sessionTokenId: "active-session" });
    let queryCount = 0;
    const user = await requireUser({
      async query() {
        queryCount += 1;
        return { rowCount: 1, rows: [{ id: 10 }] };
      },
    }, {
      httpMethod: "POST",
      headers: { cookie: `reebs_user_session=${encodeURIComponent(token)}` },
    });
    assert.equal(user, null);
    assert.equal(queryCount, 0);
  });
});

test("an extra Bearer header cannot bypass cookie mutation origin checks", async () => {
  await withSecret(async () => {
    const cookieToken = signUserToken({ userId: 10, organizationId: 2, sessionTokenId: "cookie-session" });
    const bearerToken = signUserToken({ userId: 99, organizationId: 8, sessionTokenId: "bearer-session" });
    let queryCount = 0;
    const user = await requireUser({
      async query() {
        queryCount += 1;
        return { rowCount: 1, rows: [{ id: 10 }] };
      },
    }, {
      httpMethod: "POST",
      headers: {
        cookie: `reebs_user_session=${encodeURIComponent(cookieToken)}`,
        authorization: `Bearer ${bearerToken}`,
      },
    });
    assert.equal(user, null);
    assert.equal(queryCount, 0);
  });
});
