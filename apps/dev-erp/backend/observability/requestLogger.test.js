import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequestLogger } from "./requestLogger.js";

test("request logger emits structured diagnostics and does not persist them as audit events", () => {
  const records = [];
  const auditEvents = [];
  const middleware = createRequestLogger({
    appKey: "dev-erp",
    environment: "test",
    logger: {
      info(fields, message) {
        records.push({ fields, message });
      },
    },
    auditWriter(event) {
      auditEvents.push(event);
    },
  });
  const req = {
    method: "POST",
    originalUrl: "/api/users?include=role",
    requestId: "request-1",
    headers: {},
    user: { userId: 3, organizationId: 7 },
  };
  const res = Object.assign(new EventEmitter(), {
    statusCode: 201,
    getHeader() {
      return "42";
    },
  });
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });
  res.emit("finish");

  assert.equal(nextCalled, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].fields.eventName, "api.request.completed");
  assert.equal(records[0].fields.requestId, "request-1");
  assert.equal(records[0].fields.path, "/api/users");
  assert.equal(auditEvents.length, 0);
});
