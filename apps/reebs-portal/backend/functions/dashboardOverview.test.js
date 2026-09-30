import test from "node:test";
import assert from "node:assert/strict";
import { handler } from "./dashboardOverview.js";

const parseBody = (response) => response.body ? JSON.parse(response.body) : {};

test("dashboard endpoint rejects non-Core scope before database access", async () => {
  const response = await handler({
    httpMethod: "GET",
    queryStringParameters: { scope: "water" },
    headers: {},
  });
  assert.equal(response.statusCode, 400);
  assert.equal(parseBody(response).code, "DASHBOARD_SCOPE_UNSUPPORTED");
});

test("dashboard endpoint is read only", async () => {
  const response = await handler({
    httpMethod: "POST",
    queryStringParameters: { scope: "core" },
    headers: {},
  });
  assert.equal(response.statusCode, 405);
});
