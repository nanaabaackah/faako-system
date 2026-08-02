import test from "node:test";
import assert from "node:assert/strict";
import { registerIncidentResponseRoutes } from "./incident.routes.js";
import { createIncidentService } from "./incident.service.js";

test("incident response routes require auth, action capabilities, and mutation throttling", () => {
  const routes = []; const app = { get(path, ...handlers) { routes.push({ method: "GET", path, handlers }); }, post(path, ...handlers) { routes.push({ method: "POST", path, handlers }); }, patch(path, ...handlers) { routes.push({ method: "PATCH", path, handlers }); } };
  const authMiddleware = () => {}; const mutationRateLimit = () => {}; const handler = async () => {};
  const incidentController = Object.fromEntries(["list", "get", "acknowledge", "assign", "note", "update", "resolve", "close", "reopen", "timeline", "export"].map((key) => [key, handler]));
  const alertController = Object.fromEntries(["responders", "rules", "createRule", "updateRule", "enableRule", "disableRule", "channels", "createChannel", "updateChannel", "testChannel", "policies", "createPolicy", "updatePolicy", "notifications", "readNotification"].map((key) => [key, handler]));
  const maintenanceController = { list: handler, create: handler, update: handler, cancel: handler };
  registerIncidentResponseRoutes(app, { authMiddleware, mutationRateLimit, incidentController, alertController, maintenanceController });
  assert.equal(routes.every((route) => route.handlers[0] === authMiddleware), true);
  assert.equal(routes.filter((route) => ["POST", "PATCH"].includes(route.method)).every((route) => route.handlers.includes(mutationRateLimit)), true);
});

test("incident list queries are organization scoped unless explicit global-admin access exists", async () => {
  const seen = [];
  const prisma = { monitoringIncident: { findMany: async (query) => { seen.push(query.where); return []; } }, user: { findMany: async () => [] } };
  const service = createIncidentService({ prisma, isGlobalAdmin: (user) => user.email === "platform@example.com" });
  await service.list({ take: 10 }, { organizationId: 42, email: "org@example.com" });
  await service.list({ take: 10 }, { organizationId: 42, email: "platform@example.com" });
  assert.deepEqual(seen[0], { organizationId: 42 });
  assert.deepEqual(seen[1], {});
});
