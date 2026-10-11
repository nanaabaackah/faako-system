import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { hasPermission, normalizeRole } from "./_shared/internalApi.js";

// Water scheduling is retired, not Core. Old clients must fail without
// rewriting historical schedules or sale snapshots.
const key = "__retiredWaterScheduleTest";
const handlerUrl = new URL("./commercial-config.js", import.meta.url).href;
let role;
let queries;
globalThis[key] = {
  client: () => ({ connect: async () => {}, end: async () => {}, query: async (sql) => {
    queries.push(sql);
    throw new Error("A retired Water schedule request must not execute SQL.");
  } }),
  auth: async () => ({ authUser: { id: 9, role }, organizationId: 7 }),
  hasPermission, normalizeRole,
};
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === handlerUrl) {
    const source = {
      pg: "export class Client { constructor() { return globalThis." + key + ".client(); } }",
      "./_shared/internalApi.js": "export const {hasPermission, normalizeRole} = globalThis." + key + "; export const requireInternalUser = globalThis." + key + ".auth; export const respond = (_event, statusCode, body) => ({statusCode, body: JSON.stringify(body)});",
    }[specifier];
    if (source) return { url: "data:text/javascript," + encodeURIComponent(source), shortCircuit: true };
  }
  return next(specifier, context);
} });
const { handler } = await import(handlerUrl);
after(() => { hooks.deregister(); delete globalThis[key]; });

for (const actor of ["owner", "admin", "manager", "water", "staff"]) {
  test(actor + " cannot revive retired Water schedules via commercial configuration", async () => {
    role = actor;
    queries = [];
    const response = await handler({ httpMethod: "POST", body: JSON.stringify({
      resourceType: "water_price", productKey: "gwater-15pk", priceCents: 2800,
      effectiveFrom: "2026-03-01T00:00:00.000Z", effectiveTo: "2026-06-01T00:00:00.000Z",
    }) });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /resourceType must be commercial_rule/);
    assert.deepEqual(queries, []);
  });
}
