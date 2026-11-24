import test from "node:test";
import assert from "node:assert/strict";
import { createSessionLoader, checkCurrentSession } from "../src/lib/session.js";

test("concurrent initial loads create only one Access session and then read it", async () => {
  let reads = 0, writes = 0;
  const session = { user: { role: "editor" }, csrfToken: "synthetic" };
  const load = createSessionLoader({
    async get() { if (++reads === 1) throw Object.assign(new Error("unauthenticated"), { status: 401 }); return session; },
    async post(path, options) { writes++; assert.equal(path, "/api/auth/access-session"); assert.equal(options.headers["X-TWE-Session-Init"], "1"); },
  });
  const result = await Promise.all([load("cloudflare_access"), load("cloudflare_access")]);
  assert.deepEqual(result, [session, session]);
  assert.equal(writes, 1); assert.equal(reads, 2);
  await load("cloudflare_access"); assert.equal(reads, 3);
});

test("permission and network failures are not retried or converted into new sessions", async () => {
  for (const status of [403, 500, 0]) {
    let writes = 0;
    const load = createSessionLoader({ async get() { throw Object.assign(new Error("denied"), { status }); }, async post() { writes++; } });
    await assert.rejects(load("cloudflare_access"));
    assert.equal(writes, 0);
  }
  let attempts = 0;
  const load = createSessionLoader({
    async get() { throw Object.assign(new Error("unauthenticated"), { status: 401 }); },
    async post() { attempts++; throw new Error("not provisioned"); },
  });
  await assert.rejects(load("cloudflare_access"), /not provisioned/);
  assert.equal(attempts, 1);
});

test("foreground validation never exchanges a session or signs out on connection failure", async () => {
  const session = { user: { id:"editor", organisationId:"tenant", role:"editor" }, csrfToken:"synthetic" };
  let posts = 0;
  const api = { async get(path, options) { assert.equal(path,"/api/auth/session"); assert.equal(options.cache,"no-store"); return session; }, async post() { posts++; } };
  assert.deepEqual(await checkCurrentSession(api,session), {status:"active"});
  for (const status of [401, 500, 0]) {
    const result = await checkCurrentSession({...api, async get() { throw Object.assign(new Error("unavailable"),{status}); }},session);
    assert.equal(result.status,status===401?"expired":"unavailable");
  }
  assert.deepEqual(await checkCurrentSession({...api, async get() {return {...session,csrfToken:"other"};}},session),{status:"changed"});
  for (const user of [{...session.user, role:"owner"}, {...session.user, id:"other"}, {...session.user, organisationId:"other"}]) {
    assert.deepEqual(await checkCurrentSession({...api, async get() {return {...session,user};}},session),{status:"changed"});
  }
  assert.deepEqual(await checkCurrentSession({...api, async get() {return {user:session.user};}},session),{status:"unavailable"});
  assert.equal(posts,0);
});
