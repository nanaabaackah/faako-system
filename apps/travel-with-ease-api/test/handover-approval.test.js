import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { administrationRoutes } from "../src/auth/administration-routes.js";

test("portal handover routes require CSRF, explicit approval and independently authenticated actors", async (context) => {
  const calls = [];
  const auth = {
    requireMutation: (req, res, next) =>
      req.get("X-CSRF-Token") === "test-csrf" ? next() : res.sendStatus(403),
    requirePermission: () => (_req, _res, next) => next(),
  };
  const service = {
    handoverStatus: async (actor) => ({ id: "status", canApprove: actor.role === "editor" }),
    requestHandover: async (actor, session, identity, input) => {
      calls.push({ type: "request", actor, session, identity, input });
      return { id: "requested" };
    },
    approveHandover: async (actor, session, identity, id) => {
      calls.push({ type: "approve", actor, session, identity, id });
      return { completed: true, sessionsInvalidated: true };
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = "handover-route-test";
    req.staff = {
      id: req.get("X-Actor") || "developer",
      role: req.get("X-Role") || "owner",
      organisationId: "test",
    };
    req.staffSession = { hash: "a".repeat(64) };
    req.staffIdentity = { subject: req.staff.id, assertionHash: "b".repeat(64) };
    next();
  });
  app.use(administrationRoutes(service, auth));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const clientId = "10000000-0000-4000-8000-000000000002";
  const handoverId = "10000000-0000-4000-8000-000000000003";
  const post = (path, body, headers = {}) => fetch(origin + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  assert.equal((await fetch(origin + "/handover", { headers: { "X-Actor": clientId, "X-Role": "editor" } })).status, 200);
  assert.equal((await post("/handover", { clientId, approvalReference: "HANDOVER-1" })).status, 403);
  assert.equal((await post("/handover", { clientId, approvalReference: "HANDOVER-1", developerAssertion: "must-not-be-accepted" }, { "X-CSRF-Token": "test-csrf" })).status, 400);
  assert.equal((await post("/handover", { clientId, approvalReference: "HANDOVER-1" }, { "X-CSRF-Token": "test-csrf" })).status, 200);
  assert.equal((await post(`/handover/${handoverId}/approve`, { approved: false }, { "X-CSRF-Token": "test-csrf", "X-Actor": clientId, "X-Role": "editor" })).status, 400);
  assert.equal((await post(`/handover/${handoverId}/approve`, { approved: true, unexpected: true }, { "X-CSRF-Token": "test-csrf", "X-Actor": clientId, "X-Role": "editor" })).status, 400);
  const approved = await post(`/handover/${handoverId}/approve`, { approved: true }, { "X-CSRF-Token": "test-csrf", "X-Actor": clientId, "X-Role": "editor" });
  assert.equal(approved.status, 200);
  assert.deepEqual((await approved.json()).data, { completed: true, sessionsInvalidated: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].type, "request");
  assert.equal(calls[1].type, "approve");
  assert.equal(calls[1].actor.id, clientId);
  assert.equal(calls[1].id, handoverId);
});
