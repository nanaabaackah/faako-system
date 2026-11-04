import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { administrationRoutes } from "../src/auth/administration-routes.js";
import { hasPermission } from "../src/auth/permissions.js";

test("role endpoint requires CSRF, Superadmin and a strict, versioned role request", async (context) => {
  let role = "owner",
    calls = 0;
  const auth = {
    requireMutation: (req, res, next) =>
      req.get("X-CSRF-Token") === "test-csrf" ? next() : res.sendStatus(403),
    requirePermission: (permission) => (req, res, next) => {
      req.staff = { id: "actor", role, organisationId: "test" };
      return hasPermission(req.staff, permission, "test")
        ? next()
        : res.sendStatus(403);
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.requestId = "role-test";
    next();
  });
  app.use(
    administrationRoutes(
      {
        changeRole: async () => {
          calls++;
          return { role: "owner" };
        },
      },
      auth,
    ),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/staff/10000000-0000-4000-8000-000000000001/role`;
  const input = {
    role: "owner",
    expectedRole: "editor",
    approvalReference: "ROLE-TEST",
  };
  const send = (body = input, csrf = true) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrf ? { "X-CSRF-Token": "test-csrf" } : {}),
      },
      body: JSON.stringify(body),
    });
  for (role of ["owner", "editor"]) assert.equal((await send()).status, 403);
  role = "platform_admin";
  assert.equal((await send(input, false)).status, 403);
  for (const change of [
    { role: "platform_admin" },
    { expectedRole: "platform_admin" },
    { approvalReference: "" },
    { organisationId: "foreign" },
  ])
    assert.equal((await send({ ...input, ...change })).status, 400);
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).meta.requestId, "role-test");
  assert.equal(calls, 1);
});
