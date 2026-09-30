import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

process.env.REEBS_SKIP_ENV_FILES = "true";
const handlerUrl = new URL("./water.js", import.meta.url).href;
const key = "__waterCustomerHandlerFixture";
let state;
globalThis[key] = {
  client: () => ({
    async connect() {}, async end() {},
    async query(sql, values) { state.calls.push({ sql, values }); return { rows: [] }; },
  }),
  auth: async (_client, _event, options) => {
    assert.equal(options.permission, "water:write");
    return state.denied ? { errorResponse: { statusCode: 403 } }
      : { authUser: { id: 9, role: state.role }, organizationId: 7 };
  },
  create: async (_client, org, payload) => {
    state.createdIn = org;
    state.payload = payload;
    if (state.fail) throw Object.assign(new Error("Invalid phone"), { statusCode: 400 });
    return { created: state.created, customer: { id: 55, name: "Test" } };
  },
  audit: async (_client, data) => { state.audit = data; },
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === handlerUrl) {
    const source = {
      "./_shared/databaseClient.js": `export const createDatabaseClient = globalThis.${key}.client;`,
      "./_shared/internalApi.js": `export const requireInternalUser = globalThis.${key}.auth; export const hasPermission = () => true; export const respond = (_event, statusCode, body) => ({statusCode, body: JSON.stringify(body)});`,
      "./_shared/requestRateLimit.js": "export const applyWindowRateLimit = async () => ({ allowed: true });",
      "./_shared/auditLog.js": `export const writeAuditLog = globalThis.${key}.audit; export const getEventHeader = () => 'test-request'; export const getEventIpAddress = () => '127.0.0.1';`,
      "../modules/water/customerCreation.js": `export const createWaterCustomer = globalThis.${key}.create;`,
    }[specifier];
    if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { handler } = await import(handlerUrl);
after(() => { hooks.deregister(); delete globalThis[key]; });
const request = () => handler({ httpMethod: "POST", body: JSON.stringify({
  action: "create_customer", name: "Test", organizationId: 99,
}) });
const reset = (extra = {}) => { state = { role: "water", calls: [], created: true, ...extra }; };

test("Water customer creation uses authenticated organization, commits and records an audit", async () => {
  reset();
  const response = await request();
  assert.equal(response.statusCode, 201);
  assert.equal(state.createdIn, 7);
  assert.equal(state.audit.organizationId, 7);
  assert.deepEqual(state.calls.map((call) => call.sql), ["BEGIN", "COMMIT"]);
  assert.equal(JSON.parse(response.body).businessUnit, "WATER");
});

test("existing Water identity is returned without a creation audit", async () => {
  reset({ created: false });
  assert.equal((await request()).statusCode, 200);
  assert.equal(state.audit, undefined);
});

test("customer failure rolls back without writing Water stock or financial tables", async () => {
  reset({ fail: true });
  assert.equal((await request()).statusCode, 400);
  assert.deepEqual(state.calls.map((call) => call.sql), ["BEGIN", "ROLLBACK"]);
});

test("missing permission or an unrelated role cannot create customers through Water", async () => {
  for (const extra of [{ denied: true }, { role: "staff" }, { role: "manager" }]) {
    reset(extra);
    assert.equal((await request()).statusCode, 403);
    assert.equal(state.createdIn, undefined);
    assert.equal(state.calls.length, 0);
  }
});
