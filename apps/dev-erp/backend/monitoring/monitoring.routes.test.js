import test from "node:test";
import assert from "node:assert/strict";
import { registerMonitoringRoutes } from "./monitoring.routes.js";

test("monitoring routes require auth and manual checks add admin and rate-limit guards", () => {
  const routes = [];
  const app = {
    get(path, ...handlers) { routes.push({ method: "GET", path, handlers }); },
    post(path, ...handlers) { routes.push({ method: "POST", path, handlers }); },
  };
  const authMiddleware = () => {};
  const requireAdmin = () => {};
  const manualCheckRateLimit = () => {};
  const handler = async () => {};
  registerMonitoringRoutes(app, {
    authMiddleware,
    requireAdmin,
    manualCheckRateLimit,
    controller: { summary: handler, services: handler, service: handler, history: handler, serviceIncidents: handler, incidents: handler, dependencies: handler, runCheck: handler },
  });
  assert.equal(routes.every((route) => route.handlers[0] === authMiddleware), true);
  const manual = routes.find((route) => route.method === "POST");
  assert.deepEqual(manual.handlers.slice(0, 3), [authMiddleware, requireAdmin, manualCheckRateLimit]);
  assert.equal(routes.some((route) => route.path.includes("run-check") && route.method === "GET"), false);
});
