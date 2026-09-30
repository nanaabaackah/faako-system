import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { REEBS_PUBLIC_COMMERCE } from "@faako/config";
import { resolveReebsV1Handler } from "../versionedRoutes.js";

process.env.REEBS_SKIP_ENV_FILES = "true";
const key = "__reebsPublicCommerceTest";
let fixture;
globalThis[key] = {
  createClient: () => {
    fixture.clients += 1;
    return {
      async connect() {},
      async end() { fixture.closed = true; },
      async query() { throw new Error("Paused public commerce must not query business records"); },
    };
  },
  requireUser: async () => { fixture.authChecks += 1; return fixture.user; },
  requirePermission: async (_client, _event, permission) => {
    fixture.permissions.push(permission);
    // Stop at the unchanged staff permission boundary, without a real database.
    return { errorResponse: { statusCode: 403, body: JSON.stringify({ code: "STAFF_PERMISSION_CHECK" }) } };
  },
};
const handlers = ["createOrder", "checkoutQuote", "bookings"];
test("versioned public write aliases use the same guarded handlers", () => {
  assert.equal(resolveReebsV1Handler("/api/v1/checkout/orders"), "createOrder");
  assert.equal(resolveReebsV1Handler("/api/v1/checkout/quote"), "checkoutQuote");
  assert.equal(resolveReebsV1Handler("/api/v1/bookings"), "bookings");
});
const handlerUrls = new Set(handlers.map((name) => new URL(`./${name}.js`, import.meta.url).href));
const stubs = new Map([
  ["./_shared/databaseClient.js", `export const createDatabaseClient = globalThis.${key}.createClient;`],
  ["./_shared/userAuth.js", `
    export const getUserTokenFromEvent = (event) => event.headers?.authorization || null;
    export const requireUser = globalThis.${key}.requireUser;
  `],
  ["./_shared/internalApi.js", `
    export const hasPermission = () => false;
    export const requirePermission = globalThis.${key}.requirePermission;
  `],
]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (handlerUrls.has(context.parentURL) && stubs.has(specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(stubs.get(specifier))}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
let loaded;
try {
  loaded = await Promise.all(handlers.map((name) => import(`./${name}.js`)));
} finally {
  hooks.deregister();
}
after(() => { delete globalThis[key]; });

for (const [index, name] of handlers.entries()) {
  test(`${name}: anonymous POST is paused before any business work, including forged client flags`, async () => {
    fixture = { clients: 0, authChecks: 0, permissions: [], user: null };
    const response = await loaded[index].handler({
      httpMethod: "POST", headers: {},
      body: JSON.stringify({ publicCommerceEnabled: true, isAdmin: true, organizationId: 99 }),
    });
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).code, "PUBLIC_COMMERCE_DISABLED");
    assert.equal(fixture.clients, 0);
  });
  test(`${name}: preflight still works while public commerce is paused`, async () => {
    fixture = { clients: 0 };
    const response = await loaded[index].handler({ httpMethod: "OPTIONS", headers: {} });
    assert.equal(response.statusCode, 204);
    assert.equal(fixture.clients, 0);
  });
}

test("forged or expired credentials cannot bypass the public booking pause", async () => {
  fixture = { clients: 0, authChecks: 0, permissions: [], user: null };
  const response = await loaded[2].handler({ httpMethod: "POST", headers: { authorization: "Bearer fake-test-session" }, body: "{}" });
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).code, "PUBLIC_COMMERCE_DISABLED");
  assert.equal(fixture.authChecks, 1);
  assert.equal(fixture.closed, true);
  assert.deepEqual(fixture.permissions, []);
});

test("verified staff booking requests still reach the existing permission guard", async () => {
  fixture = { clients: 0, authChecks: 0, permissions: [], user: { id: 1, role: "staff" } };
  const response = await loaded[2].handler({ httpMethod: "POST", headers: { authorization: "Bearer fake-test-session" }, body: "{}" });
  assert.equal(JSON.parse(response.body).code, "STAFF_PERMISSION_CHECK");
  assert.deepEqual(fixture.permissions, ["bookings:write"]);
  assert.equal(fixture.closed, true);
});

test("public commerce policy is locked by default and cannot be mutated by a consumer", () => {
  assert.equal(REEBS_PUBLIC_COMMERCE.checkoutEnabled, false);
  assert.equal(REEBS_PUBLIC_COMMERCE.bookingEnabled, false);
  assert.equal(Object.isFrozen(REEBS_PUBLIC_COMMERCE), true);
});
